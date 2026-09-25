"use strict";

/* global ExtensionAPI, Services, ChromeUtils, Components */

const { Subprocess } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs"
);

const Ci = Components.interfaces;
let torProcess = null;

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
  if (torProcess) {
    return {
      running: true,
      socksHost: "127.0.0.1",
      socksPort: 19050,
      alreadyRunning: true
    };
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
    stdout: "ignore",
    stderr: "ignore",
    disclaim: true
  });

  torProcess = proc;
  proc.wait().then(
    () => {
      if (torProcess === proc) torProcess = null;
    },
    () => {
      if (torProcess === proc) torProcess = null;
    }
  );

  return {
    running: true,
    socksHost: "127.0.0.1",
    socksPort: 19050,
    alreadyRunning: false
  };
}

async function stopBundledTor() {
  if (!torProcess) return { running: false };

  const proc = torProcess;
  torProcess = null;

  try {
    proc.kill(1500);
  } catch (_) {}

  try {
    await proc.wait();
  } catch (_) {}

  return { running: false };
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
            socksHost: "127.0.0.1",
            socksPort: 19050
          };
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

        async setSecureDns(level) {
          const mode = level === "strict" ? 3 : level === "balanced" ? 2 : 5;
          setInt("network.trr.mode", mode);
          return { level, mode };
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
            websiteAppearance:
              websiteAppearanceValue === 0
                ? "dark"
                : websiteAppearanceValue === 1
                  ? "light"
                  : "auto"
          };
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
