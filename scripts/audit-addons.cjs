const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag = 'div', id = '') {
    this.tagName = tag;
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.disabled = false;
    this.className = '';
    this._textContent = '';
    this.isConnected = true;
  }
  set textContent(value) {
    this._textContent = String(value);
    if (value === '') this.children = [];
  }
  get textContent() {
    return this._textContent + this.children.map(child => child.textContent).join('');
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  async click() { return this.listeners.click?.(); }
}

function findButton(root, label) {
  if (root.tagName === 'button' && root._textContent === label) return root;
  for (const child of root.children) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return null;
}

const elements = {
  addons: new Element('section', 'addons'),
  'addons-status': new Element('p', 'addons-status'),
  store: new Element('button', 'store')
};
const events = () => ({ addListener() {} });
let installed = [{
  id: 'sample@example', name: 'Sample', type: 'extension', version: '1.0',
  enabled: true, mayDisable: true
}];
const calls = [];

const context = vm.createContext({
  console,
  window: { confirm: () => true },
  document: {
    getElementById: id => elements[id],
    createElement: tag => new Element(tag)
  },
  browser: {
    tabs: { async create() {} },
    management: {
      async getAll() { return installed.map(addon => ({ ...addon })); },
      async getSelf() { return { id: 'resource-controller@matrixneo23.browser' }; },
      onInstalled: events(), onUninstalled: events(), onEnabled: events(), onDisabled: events()
    },
    browserControl: {
      async setAddonEnabled(id, enabled) {
        calls.push(['enabled', id, enabled]);
        installed = installed.map(addon => addon.id === id ? { ...addon, enabled } : addon);
        return { id, enabled };
      },
      async uninstallAddon(id) {
        calls.push(['uninstall', id]);
        installed = installed.filter(addon => addon.id !== id);
        return { id, installed: false };
      }
    }
  }
});

const source = fs.readFileSync(path.join(__dirname, '../extension/addons.js'), 'utf8');
vm.runInContext(source, context);

(async () => {
  await new Promise(resolve => setImmediate(resolve));
  const disable = findButton(elements.addons, 'Disattiva');
  assert.ok(disable, 'active addon must expose Disattiva');
  await disable.click();
  assert.deepEqual(calls[0], ['enabled', 'sample@example', false]);

  const enable = findButton(elements.addons, 'Attiva');
  assert.ok(enable, 'disabled addon must remain visible and expose Attiva');
  await enable.click();
  assert.deepEqual(calls[1], ['enabled', 'sample@example', true]);

  const remove = findButton(elements.addons, 'Rimuovi');
  assert.ok(remove, 'installed addon must expose Rimuovi');
  await remove.click();
  assert.deepEqual(calls[2], ['uninstall', 'sample@example']);
  assert.match(elements.addons.textContent, /Nessun addon trovato/);
  console.log('Addon lifecycle audit passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
