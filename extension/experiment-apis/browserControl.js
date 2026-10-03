"use strict";

/* global ExtensionAPI, Services, ChromeUtils, Components */

const { Subprocess } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs"
);
const { setTimeout, clearTimeout } = ChromeUtils.importESModule(
  "resource://gre/modules/Timer.sys.mjs"
);
const { AddonManager } = ChromeUtils.importESModule(
  "resource://gre/modules/AddonManager.sys.mjs"
);

const Ci = Components.interfaces;
const TOR_BOOTSTRAP_TIMEOUT_MS = 180000;
const GHOST_HARDENING_SNAPSHOT_PREF = "filum.ghostHardening.snapshot";
const GHOST_HARDENING_PREFS = {
  "network.cookie.cookieBehavior": { type: "int", fallback: 5 },
  "privacy.firstparty.isolate": { type: "bool", fallback: false },
  "javascript.enabled": { type: "bool", fallback: true },
  "javascript.options.wasm": { type: "bool", fallback: true },
  "network.http.http3.enable": { type: "bool", fallback: true },
  "network.http.altsvc.enabled": { type: "bool", fallback: true }
};
let torProcess = null;
let torWaitPromise = null;
let torBootstrapped = false;
let torLastLog = "";
let torLastError = "";
let torStage = "idle";
let torLastExitCode = null;

function childPath(base, parts) {
  const file = base.clone();
  for (const part of parts) file.append(part);
  return file;
}

function getAppRoot() {
  return Services.dirsvc.get("XREExeF", Ci.nsIFile).parent;
}

function findTorExecutable() {
  const root = getAppRoot();
  const candidates = [
    ["tor-expert", "tor", "tor.exe"],
    ["tor-expert", "tor.exe"],
    ["tor", "tor.exe"]
  ];

  for (const parts of candidates) {
    const file = childPath(root, parts);
    if (file.exists() && file.isFile()) return file;
  }

  throw new Error("Bundled Tor executable not found");
}

function ensureTorDataDirectory() {
  const profile = Services.dirsvc.get("ProfD", Ci.nsIFile);
  const dir = childPath(profile, ["filum-tor-data"]);

  if (!dir.exists()) {
    dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
  }

  return dir;
}

function torResourcePath(parts) {
  return childPath(getAppRoot(), ["tor-expert", ...parts]);
}

async function startBundledTor() {
  torLastError = "";
  torLastExitCode = null;
  torStage = "starting";
  if (torProcess && torBootstrapped) {
    return {
      running: true,
      bootstrapped: true,
      socksHost: "127.0.0.1",
      socksPort: 19050,
      alreadyRunning: true
    };
  }

  if (torProcess) {
    try {
      torProcess.kill(1000);
    } catch (_) {}
    try {
      await torWaitPromise;
    } catch (_) {}
    torProcess = null;
  }

  torStage = "find-executable";
  const executable = findTorExecutable();
  torStage = "create-data-directory";
  const dataDir = ensureTorDataDirectory();
  const args = [
    "--SocksPort", "127.0.0.1:19050",
    "--DataDirectory", dataDir.path,
    "--ClientOnly", "1",
    "--SafeSocks", "1",
    "--TestSocks", "1",
    "--AvoidDiskWrites", "1",
    "--Log", "notice stdout"
  ];

  const geoip = torResourcePath(["data", "geoip"]);
  const geoip6 = torResourcePath(["data", "geoip6"]);

  if (geoip.exists()) {
    args.push("--GeoIPFile", geoip.path);
  }
  if (geoip6.exists()) {
    args.push("--GeoIPv6File", geoip6.path);
  }

  torStage = "subprocess-call";
  const proc = await Subprocess.call({
    command: executable.path,
    arguments: args,
    workdir: executable.parent.path,
    stdout: "pipe",
    stderr: "stdout",
    disclaim: true
  });

  torProcess = proc;
  torStage = "reading-bootstrap";
  torBootstrapped = false;
  torLastLog = "";

  torWaitPromise = proc.wait().then(
    result => {
      torLastExitCode = result?.exitCode ?? null;
      if (torProcess === proc) {
        torProcess = null;
        torBootstrapped = false;
      }
      return result;
    },
    error => {
      if (torProcess === proc) {
        torProcess = null;
        torBootstrapped = false;
      }
      throw error;
    }
  );

  let resolveBootstrap;
  let rejectBootstrap;
  const bootstrapPromise = new Promise((resolve, reject) => {
    resolveBootstrap = resolve;
    rejectBootstrap = reject;
  });

  (async () => {
    let signaled = false;
    try {
      let chunk;
      while ((chunk = await proc.stdout.readString())) {
        torLastLog = (torLastLog + chunk).slice(-16000);

        if (!signaled && /Bootstrapped 100%/.test(torLastLog)) {
          signaled = true;
          torBootstrapped = true;
          resolveBootstrap();
        }
      }

      if (!signaled) {
        rejectBootstrap(new Error("Tor ended before bootstrap completed."));
      }
    } catch (error) {
      if (!signaled) {
        rejectBootstrap(error);
      }
    }
  })();

  const exitedBeforeBootstrap = torWaitPromise.then(result => {
    if (!torBootstrapped) {
      const code = result?.exitCode ?? "unknown";
      throw new Error("Tor exited before bootstrap. Exit code: " + code);
    }
  });

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Tor bootstrap timeout after 180 seconds.")),
      TOR_BOOTSTRAP_TIMEOUT_MS
    );
  });

  try {
    await Promise.race([bootstrapPromise, exitedBeforeBootstrap, timeout]);
  } catch (error) {
    torStage = "bootstrap-failed";
    try {
      proc.kill(1000);
    } catch (_) {}
    try {
      await torWaitPromise;
    } catch (_) {}

    const detail = torLastLog.trim().split("\n").slice(-8).join(" | ");
    torProcess = null;
    torBootstrapped = false;
    throw new Error(
      detail ? error.message + " Tor: " + detail : error.message
    );
  } finally {
    clearTimeout(timeoutId);
  }

  torStage = "ready";
  return {
    running: true,
    bootstrapped: true,
    socksHost: "127.0.0.1",
    socksPort: 19050,
    alreadyRunning: false
  };
}

async function stopBundledTor() {
  if (!torProcess) {
    torBootstrapped = false;
    return { running: false, bootstrapped: false };
  }

  const proc = torProcess;
  const waitPromise = torWaitPromise;
  torProcess = null;
  torWaitPromise = null;
  torBootstrapped = false;

  try {
    proc.kill(1500);
  } catch (_) {}

  try {
    await waitPromise;
  } catch (_) {}

  return { running: false, bootstrapped: false };
}

this.browserControl = class extends ExtensionAPI {
  onShutdown() {
    if (torProcess) {
      try {
        torProcess.kill(1000);
      } catch (_) {}
      torProcess = null;
    }
  }

  getAPI() {
    const setBool = (name, value) => Services.prefs.setBoolPref(name, value);
    const setInt = (name, value) => Services.prefs.setIntPref(name, value);
    const readGhostHardeningSnapshot = () => {
      if (!Services.prefs.prefHasUserValue(GHOST_HARDENING_SNAPSHOT_PREF)) return null;
      try {
        const snapshot = JSON.parse(Services.prefs.getStringPref(GHOST_HARDENING_SNAPSHOT_PREF));
        return snapshot && typeof snapshot === "object" ? snapshot : null;
      } catch (_) {
        throw new Error("GHOST hardening snapshot is invalid; preferences were left unchanged.");
      }
    };
    const captureGhostHardeningSnapshot = () => Object.fromEntries(
      Object.entries(GHOST_HARDENING_PREFS).map(([name, definition]) => {
        const hasUserValue = Services.prefs.prefHasUserValue(name);
        const value = definition.type === "int"
          ? Services.prefs.getIntPref(name, definition.fallback)
          : Services.prefs.getBoolPref(name, definition.fallback);
        return [name, { hasUserValue, value }];
      })
    );
    const writeGhostHardeningValue = (name, entry) => {
      const definition = GHOST_HARDENING_PREFS[name];
      if (!definition || !entry) throw new Error(`Invalid GHOST hardening snapshot entry: ${name}`);
      if (!entry.hasUserValue) {
        if (Services.prefs.prefHasUserValue(name)) Services.prefs.clearUserPref(name);
      } else if (definition.type === "int") {
        Services.prefs.setIntPref(name, entry.value);
      } else {
        Services.prefs.setBoolPref(name, entry.value);
      }
    };
    const restoreGhostHardeningSnapshot = snapshot => {
      const errors = [];
      // Drop FPI before restoring the cookie policy, then restore the remaining prefs.
      for (const name of [
        "privacy.firstparty.isolate",
        "network.cookie.cookieBehavior",
        "javascript.enabled",
        "javascript.options.wasm",
        "network.http.http3.enable",
        "network.http.altsvc.enabled"
      ]) {
        try { writeGhostHardeningValue(name, snapshot[name]); }
        catch (error) { errors.push(`${name}: ${error?.message || error}`); }
      }
      if (errors.length) throw new Error(`GHOST hardening rollback incomplete: ${errors.join("; ")}`);
    };
    const applyGhostHardening = isActive => {
      if (typeof isActive !== "boolean") throw new TypeError("isActive must be boolean");
      const existingSnapshot = readGhostHardeningSnapshot();
      if (!isActive) {
        if (!existingSnapshot) return { active: false, restored: false };
        restoreGhostHardeningSnapshot(existingSnapshot);
        Services.prefs.clearUserPref(GHOST_HARDENING_SNAPSHOT_PREF);
        Services.prefs.savePrefFile(null);
        return { active: false, restored: true };
      }

      // Keep the first pre-GHOST state across repeated calls and browser restarts.
      const snapshot = existingSnapshot || captureGhostHardeningSnapshot();
      if (!existingSnapshot) {
        Services.prefs.setStringPref(GHOST_HARDENING_SNAPSHOT_PREF, JSON.stringify(snapshot));
        Services.prefs.savePrefFile(null);
      }
      try {
        // Cookie policy must be compatible before enabling first-party isolation.
        setInt("network.cookie.cookieBehavior", 1);
        setBool("privacy.firstparty.isolate", true);
        setBool("javascript.enabled", false);
        setBool("javascript.options.wasm", false);
        setBool("network.http.http3.enable", false);
        setBool("network.http.altsvc.enabled", false);
        Services.prefs.savePrefFile(null);
        return { active: true, restored: false };
      } catch (error) {
        try {
          restoreGhostHardeningSnapshot(snapshot);
          Services.prefs.clearUserPref(GHOST_HARDENING_SNAPSHOT_PREF);
          Services.prefs.savePrefFile(null);
        } catch (rollbackError) {
          throw new Error(`${error?.message || error}; ${rollbackError?.message || rollbackError}`);
        }
        throw error;
      }
    };
    const applyPrivacyPreferences = serializedPolicy => {
      let policy;
      try { policy = JSON.parse(serializedPolicy); }
      catch (_) { throw new TypeError("Privacy policy must be valid JSON"); }
      if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
        throw new TypeError("Privacy policy must be an object");
      }
      const definitions = {
        "javascript.enabled": ["javascriptEnabled", "bool"],
        "privacy.resistFingerprinting": ["fingerprintingResistance", "bool"],
        "webgl.disabled": ["webglDisabled", "bool"],
        "webgl.enable-webgl2": ["webgl2Enabled", "bool"]
      };
      const writes = Object.entries(definitions).filter(([, [key]]) =>
        Object.prototype.hasOwnProperty.call(policy, key));
      for (const key of Object.keys(policy)) {
        if (!Object.values(definitions).some(([allowed]) => allowed === key)) {
          throw new TypeError(`Unsupported native privacy preference: ${key}`);
        }
      }
      for (const [name, [key]] of writes) {
        if (typeof policy[key] !== "boolean") throw new TypeError(`${key} must be boolean`);
      }
      const snapshot = Object.fromEntries(writes.map(([name]) => [name, {
        hasUserValue: Services.prefs.prefHasUserValue(name),
        value: Services.prefs.getBoolPref(name, false)
      }]));
      const restore = () => {
        const errors = [];
        for (const [name, entry] of Object.entries(snapshot)) {
          try {
            if (entry.hasUserValue) Services.prefs.setBoolPref(name, entry.value);
            else if (Services.prefs.prefHasUserValue(name)) Services.prefs.clearUserPref(name);
          } catch (error) { errors.push(`${name}: ${error?.message || error}`); }
        }
        if (errors.length) throw new Error(`Privacy policy rollback incomplete: ${errors.join("; ")}`);
      };
      try {
        for (const [name, [key]] of writes) Services.prefs.setBoolPref(name, policy[key]);
        Services.prefs.savePrefFile(null);
      } catch (error) {
        try { restore(); Services.prefs.savePrefFile(null); }
        catch (rollbackError) {
          throw new Error(`${error?.message || error}; ${rollbackError?.message || rollbackError}`);
        }
        throw error;
      }
      return {
        javascriptEnabled: Services.prefs.getBoolPref("javascript.enabled", true),
        fingerprintingResistance: Services.prefs.getBoolPref("privacy.resistFingerprinting", false),
        webglDisabled: Services.prefs.getBoolPref("webgl.disabled", false),
        webgl2Enabled: Services.prefs.getBoolPref("webgl.enable-webgl2", true)
      };
    };

    return {
      browserControl: {
        async applyMode(mode) {
          setBool("network.prefetch-next", false);
          setBool("network.dns.disablePrefetch", true);
          // cookieConfig.nonPersistentCookies has no effect in current Firefox.
          setBool("network.cookie.noPersistentStorage", mode === "GHOST");

          if (mode === "NORMAL") {
            setInt("media.autoplay.default", 1);
            setBool("dom.security.https_only_mode", false);
          } else if (mode === "TURBO") {
            setInt("media.autoplay.default", 5);
            setBool("dom.security.https_only_mode", false);
          } else if (mode === "PRIVATE") {
            setInt("media.autoplay.default", 1);
            setBool("dom.security.https_only_mode", true);
          } else if (mode === "GHOST") {
            setInt("media.autoplay.default", 5);
            setBool("dom.security.https_only_mode", true);
          }

          return { mode, applied: true };
        },

        async applyGhostHardening(isActive) {
          return applyGhostHardening(isActive);
        },

        async setGhostJavascriptEnabled(enabled) {
          if (typeof enabled !== "boolean") {
            throw new TypeError("enabled must be boolean");
          }
          setBool("javascript.enabled", enabled);
          Services.prefs.savePrefFile(null);
          return { enabled: Services.prefs.getBoolPref("javascript.enabled", true) };
        },

        async applyPrivacyPreferences(serializedPolicy) {
          return applyPrivacyPreferences(serializedPolicy);
        },

        async startTor() {
          try {
            return await startBundledTor();
          } catch (error) {
            torLastError = `${torStage}: ${error?.message || error}` +
              (error?.errorCode ? ` [${error.errorCode}]` : "");
            throw error;
          }
        },

        async stopTor() {
          return stopBundledTor();
        },

        async getTorStatus() {
          return {
            running: !!torProcess,
            bootstrapped: !!torProcess && torBootstrapped,
            socksHost: "127.0.0.1",
            socksPort: 19050,
            lastLog: torLastLog.split("\n").slice(-4).join(" | "),
            stage: torStage,
            error: torLastError || null,
            exitCode: torLastExitCode
          };
        },

        async setFilumPanelOpen(open) {
          const win = Services.wm.getMostRecentWindow("navigator:browser");
          if (!win?.FilumPanel) {
            throw new Error("FILUM native panel controller is unavailable");
          }

          return open ? win.FilumPanel.show() : win.FilumPanel.hide();
        },

        async getProcessStats() {
          const info = await ChromeUtils.requestProcInfo();
          let memoryBytes = Number(info.memory || 0);
          let cpuTimeNs = Number(info.cpuTime || 0);
          let processCount = 1;

          for (const child of info.children || []) {
            memoryBytes += Number(child.memory || 0);
            cpuTimeNs += Number(child.cpuTime || 0);
            processCount += 1;
          }

          return { memoryBytes, cpuTimeNs, processCount };
        },

        async setHardwareAcceleration(enabled) {
          setBool("layers.acceleration.disabled", !enabled);
          return { enabled, restartRequired: true };
        },

        async setHttpsOnly(enabled) {
          setBool("dom.security.https_only_mode", enabled);
          return { enabled };
        },

        async setSecureDns(level, uri = "") {
          const mode = level === "strict" ? 3 : level === "balanced" ? 2 : 5;
          const trimmed = String(uri || "").trim();

          if (level === "off") {
            if (Services.prefs.prefHasUserValue("network.trr.uri")) {
              Services.prefs.clearUserPref("network.trr.uri");
            }
          } else if (trimmed) {
            const parsed = Services.io.newURI(trimmed);
            if (parsed.scheme !== "https") {
              throw new Error("Custom DNS endpoint must use HTTPS.");
            }
            Services.prefs.setStringPref("network.trr.uri", trimmed);
          } else if (Services.prefs.prefHasUserValue("network.trr.uri")) {
            Services.prefs.clearUserPref("network.trr.uri");
          }

          setInt("network.trr.mode", mode);
          return {
            level,
            mode,
            uri: Services.prefs.getStringPref("network.trr.uri", "")
          };
        },

        async setWebsiteAppearance(mode) {
          const value = mode === "dark" ? 0 : mode === "light" ? 1 : 2;
          setInt("layout.css.prefers-color-scheme.content-override", value);
          return { mode, value };
        },

        async setAddonEnabled(id, enabled) {
          const addon = await AddonManager.getAddonByID(String(id));
          if (!addon) throw new Error("Addon non trovato.");
          if (addon.id === "resource-controller@matrixneo23.browser") {
            throw new Error("Il componente FILUM integrato non può essere disattivato.");
          }
          const requiredPermission = enabled
            ? AddonManager.PERM_CAN_ENABLE
            : AddonManager.PERM_CAN_DISABLE;
          if (!addon.permissions || !(addon.permissions & requiredPermission)) {
            throw new Error(enabled
              ? "Questo addon è gestito dal browser e non può essere attivato."
              : "Questo addon è gestito dal browser e non può essere disattivato.");
          }

          if (enabled) await addon.enable();
          else await addon.disable();

          const updated = await AddonManager.getAddonByID(addon.id);
          if (!updated || Boolean(updated.isActive) !== Boolean(enabled)) {
            throw new Error(enabled
              ? "Attivazione dell'addon non confermata dal browser."
              : "Disattivazione dell'addon non confermata dal browser.");
          }
          return { id: addon.id, enabled: Boolean(updated.isActive) };
        },

        async uninstallAddon(id) {
          const addon = await AddonManager.getAddonByID(String(id));
          if (!addon) return { id: String(id), installed: false };
          if (addon.id === "resource-controller@matrixneo23.browser") {
            throw new Error("Il componente FILUM integrato non può essere rimosso.");
          }
          if (!addon.permissions || !(addon.permissions & AddonManager.PERM_CAN_UNINSTALL)) {
            throw new Error("Questo addon è gestito dal browser e non può essere rimosso.");
          }

          await addon.uninstall();
          const remaining = await AddonManager.getAddonByID(addon.id);
          if (remaining) throw new Error("Rimozione dell'addon non confermata dal browser.");
          return { id: addon.id, installed: false };
        },

        async getSettings() {
          const trrMode = Services.prefs.getIntPref("network.trr.mode", 0);
          const websiteAppearanceValue = Services.prefs.getIntPref(
            "layout.css.prefers-color-scheme.content-override",
            2
          );
          const secureDnsUri = Services.prefs.getStringPref(
            "network.trr.uri",
            ""
          );

          return {
            hardwareAcceleration: !Services.prefs.getBoolPref(
              "layers.acceleration.disabled",
              false
            ),
            httpsOnly: Services.prefs.getBoolPref(
              "dom.security.https_only_mode",
              false
            ),
            secureDns:
              trrMode === 3
                ? "strict"
                : trrMode === 2
                  ? "balanced"
                  : "off",
            secureDnsUri,
            websiteAppearance:
              websiteAppearanceValue === 0
                ? "dark"
                : websiteAppearanceValue === 1
                  ? "light"
                  : "auto"
          };
        },

        async getModeDiagnostics() {
          return {
            cookieNoPersistentStorage: Services.prefs.getBoolPref("network.cookie.noPersistentStorage", false),
            startupHomepage: Services.prefs.getStringPref("browser.startup.homepage", ""),
            startupPage: Services.prefs.getIntPref("browser.startup.page", 0),
            httpsOnly: Services.prefs.getBoolPref("dom.security.https_only_mode", false),
            fingerprintResistance: Services.prefs.getBoolPref("privacy.resistFingerprinting", false),
            ghostCookieBehavior: Services.prefs.getIntPref("network.cookie.cookieBehavior", 5),
            ghostFpi: Services.prefs.getBoolPref("privacy.firstparty.isolate", false),
            javascriptEnabled: Services.prefs.getBoolPref("javascript.enabled", true),
            webglDisabled: Services.prefs.getBoolPref("webgl.disabled", false),
            webgl2Enabled: Services.prefs.getBoolPref("webgl.enable-webgl2", true),
            ghostWasm: Services.prefs.getBoolPref("javascript.options.wasm", true),
            ghostHttp3: Services.prefs.getBoolPref("network.http.http3.enable", true),
            ghostAltSvc: Services.prefs.getBoolPref("network.http.altsvc.enabled", true),
            autoplay: Services.prefs.getIntPref("media.autoplay.default", 1),
            prefetch: Services.prefs.getBoolPref("network.prefetch-next", true),
            dnsPrefetch: Services.prefs.getBoolPref("network.dns.disablePrefetch", false)
          };
        },

        async reportControlSelfTest(result) {
          Services.prefs.setStringPref("filum.selftest.controls", result);
          Services.prefs.savePrefFile(null);
          return { stored: true };
        },

        async openInternalPage(page) {
          const targets = {
            settings: "about:preferences",
            privacy: "about:preferences#privacy",
            passwords: "about:logins",
            profiles: "about:profiles",
            processes: "about:processes"
          };

          const url = targets[page];
          if (!url) throw new Error("Unsupported internal page");

          const win = Services.wm.getMostRecentWindow("navigator:browser");
          if (!win) throw new Error("No browser window");

          win.openTrustedLinkIn(url, "tab");
          return { page, opened: true };
        }
      }
    };
  }
};
