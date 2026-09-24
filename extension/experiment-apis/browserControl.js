"use strict";

/* global ExtensionAPI, Services, ChromeUtils */

this.browserControl = class extends ExtensionAPI {
  getAPI() {
    const setBool = (name, value) => Services.prefs.setBoolPref(name, value);
    const setInt = (name, value) => Services.prefs.setIntPref(name, value);

    return {
      browserControl: {
        async applyMode(mode) {
          // These settings are deliberately limited to the Browser product modes.
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
          // Firefox evaluates this fully on restart; keep the UI honest about that.
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
            hardwareAcceleration: !Services.prefs.getBoolPref("layers.acceleration.disabled", false),
            httpsOnly: Services.prefs.getBoolPref("dom.security.https_only_mode", false),
            secureDns: trrMode === 3 ? "strict" : trrMode === 2 ? "balanced" : "off",
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
          if (!url) {
            throw new Error("Unsupported internal page");
          }

          const win = Services.wm.getMostRecentWindow("navigator:browser");
          if (!win) {
            throw new Error("No browser window");
          }

          win.openTrustedLinkIn(url, "tab");
          return { page, opened: true };
        }
      }
    };
  }
};
