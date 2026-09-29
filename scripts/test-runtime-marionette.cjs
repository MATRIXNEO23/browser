'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');

const PROFILE_PATH = process.env.BROWSER_PROFILE_PATH;
const PORT_FILE = PROFILE_PATH && path.join(PROFILE_PATH, 'MarionetteActivePort');
const PORT = Number(process.env.MARIONETTE_PORT);
const MAX_LOG_ENTRIES = 200;
const VALID_EVENTS = new Set(['TOR_ENABLE', 'TOR_DISABLE', 'CACHE_CLEAR', 'MODE_CHANGE']);
const VALID_MODES = new Set(['NORMAL', 'TURBO', 'PRIVATE', 'GHOST']);
const VALID_RESULTS = new Set(['SUCCESS', 'ERROR']);
const SOCKS_USER = 'filum-ci-user';
const SOCKS_PASS = 'filum-ci-test-password';
const TARGET_HOST = 'filum-runtime.test';
const TARGET_BODY = 'FILUM_SOCKS_AUTH_RUNTIME_OK';

function assertRuntimeInputs() {
  assert.ok(PROFILE_PATH && fs.existsSync(PROFILE_PATH), 'Smoke profile path is missing.');
  assert.ok(Number.isInteger(PORT) && PORT > 0 && PORT < 65536, 'Marionette port is invalid.');
  assert.ok(fs.existsSync(PORT_FILE), 'MarionetteActivePort was not created.');
  assert.equal(Number(fs.readFileSync(PORT_FILE, 'utf8').trim()), PORT,
    'MarionetteActivePort does not match the verified listener.');
}

class MarionetteClient {
  constructor(port) {
    this.port = port;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.packets = [];
    this.readers = [];
    this.nextId = 1;
    this.closed = false;
  }

  async connect() {
    this.socket = net.createConnection({ host: '127.0.0.1', port: this.port });
    this.socket.setTimeout(30000);
    this.socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.consumePackets();
    });
    this.socket.on('error', error => this.failReaders(error));
    this.socket.on('timeout', () => this.failReaders(new Error('Marionette socket timed out.')));
    this.socket.on('close', () => {
      this.closed = true;
      this.failReaders(new Error('Marionette socket closed.'));
    });
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });

    const hello = await this.readPacket();
    assert.equal(hello?.applicationType, 'gecko', 'Unexpected Marionette greeting.');
    assert.ok(Number.isInteger(hello.marionetteProtocol), 'Missing Marionette protocol version.');
  }

  consumePackets() {
    while (true) {
      const separator = this.buffer.indexOf(58);
      if (separator < 1) return;
      const lengthText = this.buffer.subarray(0, separator).toString('ascii');
      if (!/^\d+$/.test(lengthText)) {
        this.failReaders(new Error('Invalid Marionette packet header.'));
        this.socket.destroy();
        return;
      }
      const length = Number(lengthText);
      if (!Number.isSafeInteger(length) || length > 16 * 1024 * 1024) {
        this.failReaders(new Error('Marionette packet exceeds the allowed size.'));
        this.socket.destroy();
        return;
      }
      const start = separator + 1;
      if (this.buffer.length < start + length) return;
      const payload = this.buffer.subarray(start, start + length).toString('utf8');
      this.buffer = this.buffer.subarray(start + length);
      try {
        this.deliverPacket(JSON.parse(payload));
      } catch (error) {
        this.failReaders(new Error(`Invalid Marionette JSON packet: ${error.message}`));
        this.socket.destroy();
        return;
      }
    }
  }

  deliverPacket(packet) {
    const reader = this.readers.shift();
    if (reader) {
      clearTimeout(reader.timer);
      reader.resolve(packet);
    } else {
      this.packets.push(packet);
    }
  }

  readPacket(timeoutMs = 30000) {
    if (this.packets.length) return Promise.resolve(this.packets.shift());
    if (this.closed) return Promise.reject(new Error('Marionette socket is closed.'));
    return new Promise((resolve, reject) => {
      const reader = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.readers = this.readers.filter(item => item !== reader);
          reject(new Error('Timed out waiting for a Marionette response.'));
        }, timeoutMs)
      };
      this.readers.push(reader);
    });
  }

  failReaders(error) {
    for (const reader of this.readers.splice(0)) {
      clearTimeout(reader.timer);
      reader.reject(error);
    }
  }

  async command(name, parameters = {}, timeoutMs = 30000) {
    const id = this.nextId++;
    const payload = Buffer.from(JSON.stringify([0, id, name, parameters]), 'utf8');
    this.socket.write(Buffer.concat([Buffer.from(`${payload.length}:`, 'ascii'), payload]));
    const response = await this.readPacket(timeoutMs);
    assert.equal(response[0], 1, `Unexpected Marionette response for ${name}.`);
    assert.equal(response[1], id, `Marionette response ID mismatch for ${name}.`);
    if (response[2]) {
      const error = response[2];
      throw new Error(`${name}: ${error.error || 'webdriver error'}: ${error.message || ''}`);
    }
    return response[3];
  }

  async execute(script, args = [], asynchronous = false, timeoutMs = 30000) {
    const command = asynchronous ? 'WebDriver:ExecuteAsyncScript' : 'WebDriver:ExecuteScript';
    const result = await this.command(command, {
      script,
      args,
      newSandbox: true,
      sandbox: 'default',
      line: 0,
      filename: 'filum-runtime-marionette-test'
    }, timeoutMs);
    return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
  }

  async close() {
    if (!this.socket || this.closed) return;
    try {
      await this.command('WebDriver:DeleteSession', {}, 5000);
    } catch (_) {}
    this.socket.end();
  }
}

function extensionAsyncScript(body) {
  return `
    const finish = arguments[arguments.length - 1];
    const input = arguments[0];
    (async () => {
      const page = window.wrappedJSObject || window;
      const api = page.browser;
      if (!api || !api.runtime || !api.storage) throw new Error('FILUM extension page APIs are unavailable.');
      return await (${body})(api, input);
    })().then(value => finish(JSON.stringify({ value })), error =>
      finish(JSON.stringify({ error: String(error && error.message || error) })));
  `;
}

async function extensionCall(client, body, input = null, timeoutMs = 30000) {
  const raw = await client.execute(extensionAsyncScript(body), [input], true, timeoutMs);
  const parsed = JSON.parse(raw);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.value;
}

async function switchToWindow(client, handle) {
  await client.command('WebDriver:SwitchToWindow', { handle });
}

async function waitForExtensionPage(client) {
  const deadline = Date.now() + 15000;
  let seenWindowCount = 0;
  while (Date.now() < deadline) {
    const handles = await client.command('WebDriver:GetWindowHandles');
    seenWindowCount = handles.length;
    for (const handle of handles) {
      try {
        await switchToWindow(client, handle);
        const url = await client.command('WebDriver:GetCurrentURL');
        if (!url.startsWith('moz-extension:')) continue;
        const ready = await client.execute(`
          const page = window.wrappedJSObject || window;
          return Boolean(page.browser && page.browser.runtime && page.browser.storage);
        `);
        if (ready) return { handle, url };
      } catch (_) {}
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`FILUM extension page with browser APIs was not found in ${seenWindowCount} WebDriver window(s).`);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

class Socks5TestServer {
  constructor(httpPort) {
    this.httpPort = httpPort;
    this.stats = { acceptedAuth: 0, rejectedAuth: 0, httpRequests: 0, unexpectedTargets: 0 };
    this.sockets = new Set();
    this.upstreams = new Set();
    this.server = net.createServer(socket => this.handle(socket));
  }

  async start() {
    this.port = await listen(this.server);
    return this.port;
  }

  handle(socket) {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = Buffer.alloc(0);
    let stage = 'greeting';
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (!socket.destroyed) {
        if (stage === 'greeting') {
          if (buffer.length < 2) return;
          const size = 2 + buffer[1];
          if (buffer.length < size) return;
          const greeting = buffer.subarray(0, size);
          buffer = buffer.subarray(size);
          const authMethod = greeting.subarray(2).includes(2) ? 2 : 255;
          socket.write(Buffer.from([5, authMethod]));
          if (authMethod !== 2) return socket.destroy();
          stage = 'auth';
          continue;
        }
        if (stage === 'auth') {
          if (buffer.length < 2) return;
          const userLength = buffer[1];
          if (buffer.length < 2 + userLength + 1) return;
          const passLengthOffset = 2 + userLength;
          const passLength = buffer[passLengthOffset];
          const authSize = passLengthOffset + 1 + passLength;
          if (buffer.length < authSize) return;
          const authVersion = buffer[0];
          const username = buffer.subarray(2, passLengthOffset).toString('utf8');
          const password = buffer.subarray(passLengthOffset + 1, authSize).toString('utf8');
          buffer = buffer.subarray(authSize);
          const accepted = authVersion === 1 && username === SOCKS_USER && password === SOCKS_PASS;
          socket.write(Buffer.from([1, accepted ? 0 : 1]));
          if (!accepted) {
            this.stats.rejectedAuth++;
            stage = 'rejected';
            socket.end();
            return;
          }
          this.stats.acceptedAuth++;
          stage = 'connect';
          continue;
        }
        if (stage === 'connect') {
          if (buffer.length < 4) return;
          const atyp = buffer[3];
          let hostLength;
          let hostOffset;
          if (atyp === 1) {
            hostLength = 4;
            hostOffset = 4;
          } else if (atyp === 3) {
            if (buffer.length < 5) return;
            hostLength = buffer[4];
            hostOffset = 5;
          } else if (atyp === 4) {
            hostLength = 16;
            hostOffset = 4;
          } else {
            socket.write(Buffer.from([5, 8, 0, 1, 0, 0, 0, 0, 0, 0]));
            return socket.destroy();
          }
          const requestLength = hostOffset + hostLength + 2;
          if (buffer.length < requestLength) return;
          let host;
          if (atyp === 1) host = [...buffer.subarray(hostOffset, hostOffset + hostLength)].join('.');
          else if (atyp === 3) host = buffer.subarray(hostOffset, hostOffset + hostLength).toString('utf8');
          else host = buffer.subarray(hostOffset, hostOffset + hostLength).toString('hex');
          const portOffset = hostOffset + hostLength;
          const port = buffer.readUInt16BE(portOffset);
          buffer = buffer.subarray(requestLength);
          if (host !== TARGET_HOST || port !== this.httpPort) {
            this.stats.unexpectedTargets++;
            socket.write(Buffer.from([5, 4, 0, 1, 0, 0, 0, 0, 0, 0]));
            return socket.destroy();
          }
          const upstream = net.createConnection({ host: '127.0.0.1', port: this.httpPort });
          this.upstreams.add(upstream);
          upstream.on('close', () => this.upstreams.delete(upstream));
          upstream.on('error', () => socket.destroy());
          upstream.on('connect', () => {
            socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, this.httpPort >> 8, this.httpPort & 255]));
            socket.pipe(upstream);
            upstream.pipe(socket);
            this.stats.httpRequests++;
            if (buffer.length) upstream.write(buffer);
            buffer = Buffer.alloc(0);
            stage = 'tunnel';
          });
          return;
        }
        return;
      }
    });
  }

  async stop() {
    for (const socket of this.sockets) socket.destroy();
    for (const upstream of this.upstreams) upstream.destroy();
    if (this.server.listening) {
      await new Promise(resolve => this.server.close(() => resolve()));
    }
  }
}

async function testProxyAuthentication(client, extensionPage) {
  let httpRequests = 0;
  const httpServer = http.createServer((request, response) => {
    httpRequests++;
    response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    response.end(TARGET_BODY);
  });
  const httpPort = await listen(httpServer);
  const goodProxy = new Socks5TestServer(httpPort);
  const badProxy = new Socks5TestServer(httpPort);
  let extensionRestored = false;
  let testWindow = null;

  try {
    const goodPort = await goodProxy.start();
    const goodConfig = { host: '127.0.0.1', port: goodPort, user: SOCKS_USER, pass: SOCKS_PASS };
    const configured = await extensionCall(client,
      '(api, config) => api.runtime.sendMessage({ type: "set-proxy-auth", config })', goodConfig);
    assert.equal(configured.success, true, 'Browser Control Core rejected valid SOCKS5 credentials.');
    const saved = await extensionCall(client,
      'async (api) => (await api.storage.local.get("socks_auth_profile")).socks_auth_profile');
    assert.deepEqual(saved, goodConfig, 'SOCKS5 credentials were not persisted in the temporary profile.');

    const createdWindow = await client.command('WebDriver:NewWindow', { type: 'tab' });
    testWindow = createdWindow.handle;
    await client.command('WebDriver:Navigate', { url: `http://${TARGET_HOST}:${httpPort}/valid` }, 60000);
    const validBody = await client.execute('return document.body && document.body.innerText;');
    assert.ok(String(validBody).includes(TARGET_BODY), 'Valid SOCKS5 credentials did not reach the local test endpoint.');
    assert.ok(goodProxy.stats.acceptedAuth > 0, 'SOCKS5 server did not accept the expected credentials.');
    assert.ok(httpRequests > 0, 'The authenticated SOCKS5 tunnel did not reach the local endpoint.');
    const validRequestCount = httpRequests;

    await switchToWindow(client, extensionPage.handle);
    const badPort = await badProxy.start();
    const badConfig = { host: '127.0.0.1', port: badPort, user: SOCKS_USER, pass: `${SOCKS_PASS}-wrong` };
    const badConfigured = await extensionCall(client,
      '(api, config) => api.runtime.sendMessage({ type: "set-proxy-auth", config })', badConfig);
    assert.equal(badConfigured.success, true, 'Core did not accept a syntactically valid test profile with wrong credentials.');

    await switchToWindow(client, testWindow);
    await client.command('WebDriver:Navigate', { url: `http://${TARGET_HOST}:${httpPort}/invalid` }, 60000).catch(() => {});
    const failureDeadline = Date.now() + 10000;
    while (Date.now() < failureDeadline && badProxy.stats.rejectedAuth === 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(badProxy.stats.rejectedAuth > 0, 'Invalid SOCKS5 credentials were not rejected by the local mock.');
    assert.equal(badProxy.stats.httpRequests, 0, 'Invalid SOCKS5 credentials opened an HTTP tunnel.');
    assert.equal(httpRequests, validRequestCount, 'The invalid credential request reached the HTTP test endpoint.');

    await switchToWindow(client, extensionPage.handle);
    extensionRestored = true;
    console.log('PASS: SOCKS5 auth accepted valid credentials and rejected invalid credentials.');
  } finally {
    if (!extensionRestored) {
      try {
        await switchToWindow(client, extensionPage.handle);
        extensionRestored = true;
      } catch (_) {}
    }
    if (extensionRestored) {
      await extensionCall(client,
        '(api) => api.runtime.sendMessage({ type: "set-network-proxy", config: { mode: "direct" } })')
        .catch(() => {});
    }
    if (testWindow) {
      await switchToWindow(client, testWindow).catch(() => {});
      await client.command('WebDriver:CloseWindow').catch(() => {});
      await switchToWindow(client, extensionPage.handle).catch(() => {});
    }
    await goodProxy.stop();
    await badProxy.stop();
    httpServer.closeAllConnections?.();
    await new Promise(resolve => httpServer.close(() => resolve()));
  }
}

function sameEntries(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function testSecurityLogger(client) {
  const normalized = await extensionCall(client,
    '(api) => api.runtime.sendMessage({ type: "set-mode", mode: "NORMAL" })');
  assert.equal(normalized.ok, true, 'Could not set NORMAL baseline before logger runtime test.');
  await extensionCall(client,
    '(api) => api.storage.local.set({ security_audit_log: [] })');

  let logs = [];
  const expectedEvents = [];
  const transitions = 134;
  for (let index = 0; index < transitions; index++) {
    const mode = index % 2 === 0 ? 'TURBO' : 'NORMAL';
    const eventCount = mode === 'TURBO' ? 2 : 1;
    const result = await extensionCall(client,
      '(api, mode) => api.runtime.sendMessage({ type: "set-mode", mode })', mode, 60000);
    assert.equal(result.ok, true, `Runtime mode transition to ${mode} did not pass modeHealth.`);

    const deadline = Date.now() + 15000;
    let current = logs;
    let delta = [];
    while (Date.now() < deadline) {
      current = await extensionCall(client,
        'async (api) => (await api.storage.local.get("security_audit_log")).security_audit_log || []');
      const newLength = Math.min(MAX_LOG_ENTRIES, logs.length + eventCount);
      const dropped = Math.max(0, logs.length + eventCount - MAX_LOG_ENTRIES);
      const retained = logs.slice(dropped);
      if (current.length === newLength &&
          sameEntries(current.slice(0, retained.length), retained)) {
        delta = current.slice(retained.length);
        const types = new Set(delta.map(event => event.event_type));
        const expectedTypes = mode === 'TURBO'
          ? new Set(['MODE_CHANGE', 'CACHE_CLEAR'])
          : new Set(['MODE_CHANGE']);
        if (delta.length === eventCount && delta.every(event => event.mode === mode) &&
            expectedTypes.size === types.size && [...expectedTypes].every(type => types.has(type))) {
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(delta.length, eventCount, `Expected ${eventCount} persisted logger event(s) for ${mode}.`);
    expectedEvents.push(...delta);
    logs = current;
  }

  assert.equal(expectedEvents.length, 201, 'Runtime test did not generate more than 200 logger events.');
  assert.equal(logs.length, MAX_LOG_ENTRIES, 'Security logger did not cap runtime storage at 200 events.');
  assert.deepEqual(logs, expectedEvents.slice(-MAX_LOG_ENTRIES), 'Security logger did not retain the newest 200 events in FIFO order.');

  const allowedKeys = new Set(['timestamp', 'event_type', 'result', 'mode', 'metadata']);
  for (const event of logs) {
    assert.ok(event && typeof event === 'object' && !Array.isArray(event), 'Logger wrote a non-object event.');
    assert.ok(Object.keys(event).every(key => allowedKeys.has(key)), 'Logger wrote a field outside the approved schema.');
    assert.ok(!Number.isNaN(Date.parse(event.timestamp)), 'Logger wrote an invalid timestamp.');
    assert.ok(VALID_EVENTS.has(event.event_type), 'Logger wrote an event outside its whitelist.');
    assert.ok(VALID_RESULTS.has(event.result), 'Logger wrote an invalid result.');
    assert.ok(VALID_MODES.has(event.mode), 'Logger wrote an invalid mode.');
    if (event.metadata !== undefined) {
      assert.deepEqual(Object.keys(event.metadata), ['discarded'], 'Logger wrote unapproved metadata.');
      assert.ok(Number.isSafeInteger(event.metadata.discarded) && event.metadata.discarded >= 0,
        'Logger wrote invalid discarded metadata.');
    }
  }
  assert.ok(logs.some(event => event.event_type === 'CACHE_CLEAR'), 'Runtime logger did not persist TURBO cache-clear events.');
  assert.ok(logs.some(event => event.event_type === 'MODE_CHANGE'), 'Runtime logger did not persist mode-change events.');
  assert.ok(!JSON.stringify(logs).includes(SOCKS_USER) && !JSON.stringify(logs).includes(SOCKS_PASS),
    'Security log contains test proxy credentials.');
  console.log('PASS: Gecko storage contains valid logger events and the newest 200 entries in FIFO order.');

  const restore = await extensionCall(client,
    '(api) => api.runtime.sendMessage({ type: "set-mode", mode: "NORMAL" })').catch(() => null);
  if (restore && !restore.ok) throw new Error('Could not restore NORMAL mode after logger runtime test.');
}

async function main() {
  assertRuntimeInputs();
  const client = new MarionetteClient(PORT);
  try {
    await client.connect();
    await client.command('WebDriver:NewSession', {
      capabilities: { alwaysMatch: { pageLoadStrategy: 'eager' }, firstMatch: [{}] }
    });
    await client.command('WebDriver:SetTimeouts', { script: 30000, pageLoad: 60000, implicit: 0 });
    const extensionPage = await waitForExtensionPage(client);
    console.log('Marionette connected to the temporary FILUM profile.');
    await testProxyAuthentication(client, extensionPage);
    await testSecurityLogger(client);
    console.log('Runtime integration tests completed successfully.');
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error(`Runtime integration test failed: ${error.message}`);
  process.exitCode = 1;
});
