"use strict";

/* global ExtensionAPI, Services, ChromeUtils, Components */

const { Subprocess } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs"
);

const Ci = Components.interfaces;
let torProcess = null;
let torWaitPromise = null;
let torBootstrapped = false;
let torLastLog = "";

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

  const executable = findTorExecutable();
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

  const proc = await Subprocess.call({
    command: executable.path,
    arguments: args,
    workdir: executable.parent.path,
    stdout: "pipe",
    stderr: "stdout",
    disclaim: true
  });

  torProcess = proc;
  torBootstrapped = false;
  torLastLog = "";

  torWaitPromise = proc.wait().then(
    result => {
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

  const timeout = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("Tor bootstrap timeout after 45 seconds.")),
      45000
    );
  });

  try {
    await Promise.race([bootstrapPromise, exitedBeforeBootstrap, timeout]);
  } catch (error) {
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
  }

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

    return {
      browserControl: {
        async applyMode(mode) {
          setBool("network.prefetch-next", false);
          setBool("network.dns.disablePrefetch", true);

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

        async startTor() {
          return startBundledTor();
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
            lastLog: torLastLog.split("\n").slice(-4).join(" | ")
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

          if (level !== "off") {
            if (trimmed) {
              const parsed = Services.io.newURI(trimmed);
              if (parsed.scheme !== "https") {
                throw new Error("Custom DNS endpoint must use HTTPS.");
              }
              Services.prefs.setStringPref("network.trr.uri", trimmed);
            } else if (Services.prefs.prefHasUserValue("network.trr.uri")) {
              Services.prefs.clearUserPref("network.trr.uri");
            }
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
