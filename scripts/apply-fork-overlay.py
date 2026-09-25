import argparse
import base64
import hashlib
import json
import shutil
from pathlib import Path

MARKER = "/* MATRIXNEO23 Browser fork */"

def copy_tree(src: Path, dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.rglob("*"):
        rel = item.relative_to(src)
        target = dst / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def restore_filum_background(project: Path, core: Path):
    parts = [
        project / "extension" / "assets" / f"filum-background.b64.{i:02d}"
        for i in range(1, 6)
    ]
    missing = [str(p) for p in parts if not p.is_file()]
    if missing:
        raise RuntimeError("Missing FILUM background payload parts: " + ", ".join(missing))

    encoded = "".join(p.read_text(encoding="ascii").strip() for p in parts)
    data = base64.b64decode(encoded, validate=True)
    digest = hashlib.sha256(data).hexdigest()
    expected = "2b2c7f659eaade035375be20f8735ab3daada878645cfb0cda5f7381721c1bc6"

    if digest != expected:
        raise RuntimeError(f"FILUM background SHA256 mismatch: {digest}")

    target = core / "extension" / "assets" / "filum-background.jpg"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)

def patch_extensions_mozbuild(path: Path):
    text = path.read_text(encoding="utf-8")
    if '"browser-core"' in text:
        return
    needle = 'DIRS += ['
    start = text.find(needle)
    if start < 0:
        raise RuntimeError("DIRS list not found in browser/extensions/moz.build")
    end = text.find("]", start)
    if end < 0:
        raise RuntimeError("DIRS list end not found")
    text = text[:end] + '    "browser-core",\n' + text[end:]
    path.write_text(text, encoding="utf-8")

def patch_browser_chrome(path: Path, project: Path):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return
    chrome_css = (project / "fork" / "browser-chrome.css").read_text(encoding="utf-8")
    text += "\n" + MARKER + "\n" + chrome_css + "\n"
    path.write_text(text, encoding="utf-8")


def patch_native_filum_button(path: Path):
    text = path.read_text(encoding="utf-8")
    if 'id="filum-sidebar-button"' in text:
        return

    needle = '      <toolbarbutton id="downloads-button"'
    if needle not in text:
        raise RuntimeError("downloads toolbar button anchor not found")

    button = """      <toolbarbutton id="filum-sidebar-button"
                     class="toolbarbutton-1 chromeclass-toolbar-additional"
                     label="FILUM"
                     tooltiptext="Apri/chiudi pannello FILUM"
                     removable="false"
                     overflows="false"
                     cui-areatype="toolbar"/>

"""
    text = text.replace(needle, button + needle, 1)
    path.write_text(text, encoding="utf-8")


def patch_filum_panel_markup(path: Path):
    text = path.read_text(encoding="utf-8")
    if 'id="filum-panel-box"' in text:
        return

    needle = '  <splitter id="ai-window-splitter"'
    if needle not in text:
        raise RuntimeError("AI window splitter anchor not found in browser-box.inc.xhtml")

    markup = """  <splitter id="filum-panel-splitter"
            class="chromeclass-extrachrome sidebar-splitter"
            resizebefore="none"
            resizeafter="sibling"
            hidden="true"/>
  <vbox id="filum-panel-box"
        hidden="true"
        class="chromeclass-extrachrome chrome-block">
    <browser id="filum-panel-browser"
             flex="1"
             type="content"
             autoscroll="false"
             disablehistory="true"
             disablefullscreen="true"
             maychangeremoteness="true"/>
  </vbox>

"""

    text = text.replace(needle, markup + needle, 1)
    path.write_text(text, encoding="utf-8")


def patch_filum_panel_controller(path: Path):
    text = path.read_text(encoding="utf-8")
    marker = "/* MATRIXNEO23 FILUM native panel controller */"
    if marker in text:
        return

    helper = r"""
/* MATRIXNEO23 FILUM native panel controller */
var FilumPanel = {
  extensionId: "resource-controller@matrixneo23.browser",
  panelPath: "sidebar.html",
  buttonId: "filum-sidebar-button",
  _bound: false,

  get box() {
    return document.getElementById("filum-panel-box");
  },

  get splitter() {
    return document.getElementById("filum-panel-splitter");
  },

  get browser() {
    return document.getElementById("filum-panel-browser");
  },

  get button() {
    return document.getElementById(this.buttonId);
  },

  bindButton() {
    if (this._bound) {
      return true;
    }

    const button = this.button;
    if (!button) {
      console.error("FILUM native toolbar button is unavailable");
      return false;
    }

    button.addEventListener("command", () => {
      this.toggle();
    });

    this._bound = true;
    return true;
  },

  async resolvePanelURL() {
    const { ExtensionParent } = ChromeUtils.importESModule(
      "resource://gre/modules/ExtensionParent.sys.mjs"
    );

    for (let attempt = 0; attempt < 40; attempt++) {
      const policy = ExtensionParent.WebExtensionPolicy.getByID(this.extensionId);
      if (policy) {
        if (policy.readyPromise) {
          try {
            await policy.readyPromise;
          } catch (_) {}
        }
        return policy.getURL(this.panelPath);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error("FILUM core policy is not ready");
  },

  async show() {
    const box = this.box;
    const splitter = this.splitter;
    const browser = this.browser;

    if (!box || !splitter || !browser) {
      throw new Error("FILUM native panel markup is unavailable");
    }

    const url = await this.resolvePanelURL();
    if (browser.getAttribute("src") !== url) {
      browser.setAttribute("src", url);
    }

    box.hidden = false;
    splitter.hidden = false;
    document.documentElement.setAttribute("filum-panel-open", "true");
    return { open: true, url };
  },

  hide() {
    if (this.box) {
      this.box.hidden = true;
    }
    if (this.splitter) {
      this.splitter.hidden = true;
    }
    document.documentElement.removeAttribute("filum-panel-open");
    return { open: false };
  },

  async toggle() {
    try {
      if (!this.box || this.box.hidden) {
        return await this.show();
      }
      return this.hide();
    } catch (error) {
      console.error("FILUM native panel toggle failed", error);
      return { open: false, error: String(error) };
    }
  },

  async waitForPanelLoad(expected) {
    const browser = this.browser;

    await new Promise(resolve => {
      if (browser.currentURI?.spec === expected) {
        resolve();
        return;
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      browser.addEventListener("load", finish, { once: true, capture: true });
      setTimeout(finish, 5000);
    });

    return browser.currentURI?.spec || browser.getAttribute("src") || "";
  },

  async runSelfTest() {
    try {
      if (!this.bindButton()) {
        throw new Error("FILUM toolbar button could not be bound");
      }

      this.hide();

      const expected = await this.resolvePanelURL();
      const button = this.button;
      const command = document.createEvent("Events");
      command.initEvent("command", true, true);
      button.dispatchEvent(command);

      const current = await this.waitForPanelLoad(expected);
      const passed =
        !this.box.hidden &&
        current.startsWith("moz-extension://") &&
        current.endsWith("/sidebar.html");

      Services.prefs.setStringPref(
        "filum.selftest.panel",
        passed ? "PASS" : "FAIL:" + current
      );

      this.hide();
      return { passed, current };
    } catch (error) {
      Services.prefs.setStringPref(
        "filum.selftest.panel",
        "FAIL:" + String(error)
      );
      this.hide();
      return { passed: false, error: String(error) };
    }
  },
};

window.addEventListener(
  "load",
  () => {
    FilumPanel.bindButton();

    if (Services.prefs.getBoolPref("filum.selftest.enabled", false)) {
      setTimeout(() => FilumPanel.runSelfTest(), 1500);
    }
  },
  { once: true }
);
"""

    path.write_text(text + "\n" + helper + "\n", encoding="utf-8")

def patch_windows_identity(firefox: Path):
    manifest = firefox / "browser" / "app" / "firefox.exe.manifest"
    text = manifest.read_text(encoding="utf-8")
    text = text.replace('name="Firefox"', 'name="Browser"')
    text = text.replace("<description>Firefox</description>", "<description>Browser</description>")
    manifest.write_text(text, encoding="utf-8")

    module_ver = firefox / "browser" / "app" / "module.ver"
    module_ver.write_text(
        "WIN32_MODULE_COMPANYNAME=MATRIXNEO23\n"
        "WIN32_MODULE_COPYRIGHT=Browser contributors; Gecko/Firefox code under MPL 2.0.\n"
        "WIN32_MODULE_PRODUCTVERSION=@MOZ_APP_WINVERSION@\n"
        "WIN32_MODULE_PRODUCTVERSION_STRING=@MOZ_APP_VERSION@\n"
        "WIN32_MODULE_TRADEMARKS=\n"
        "WIN32_MODULE_DESCRIPTION=@MOZ_APP_DISPLAYNAME@\n"
        "WIN32_MODULE_PRODUCTNAME=@MOZ_APP_DISPLAYNAME@\n"
        "WIN32_MODULE_NAME=@MOZ_APP_DISPLAYNAME@\n",
        encoding="utf-8",
    )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--firefox-source", required=True)
    parser.add_argument("--project-root", default=None)
    parser.add_argument("--mozconfig", default="fork/mozconfig.win64")
    args = parser.parse_args()

    firefox = Path(args.firefox_source).resolve()
    project = Path(args.project_root).resolve() if args.project_root else Path(__file__).resolve().parents[1]

    upstream = json.loads((project / "fork" / "UPSTREAM.json").read_text(encoding="utf-8"))

    branding_base = firefox / "browser" / "branding" / "browser"
    if branding_base.exists():
        shutil.rmtree(branding_base)
    shutil.copytree(firefox / "browser" / "branding" / "unofficial", branding_base)
    copy_tree(project / "fork" / "branding", branding_base)

    core = firefox / "browser" / "extensions" / "browser-core"
    if core.exists():
        shutil.rmtree(core)
    (core / "extension").mkdir(parents=True, exist_ok=True)
    copy_tree(project / "extension", core / "extension")
    restore_filum_background(project, core)

    (core / "moz.build").write_text('JAR_MANIFESTS += ["jar.mn"]\n', encoding="utf-8")
    (core / "jar.mn").write_text(
        "browser.jar:\n"
        "    builtin-addons/browser-core/ (extension/**)\n",
        encoding="utf-8",
    )

    patch_extensions_mozbuild(firefox / "browser" / "extensions" / "moz.build")
    patch_browser_chrome(
        firefox / "browser" / "themes" / "shared" / "toolbarbuttons.css",
        project,
    )
    patch_native_filum_button(
        firefox / "browser" / "base" / "content" / "navigator-toolbox.inc.xhtml"
    )
    patch_filum_panel_markup(
        firefox / "browser" / "base" / "content" / "browser-box.inc.xhtml"
    )
    patch_filum_panel_controller(
        firefox / "browser" / "base" / "content" / "browser.js"
    )
    patch_windows_identity(firefox)

    shutil.copy2(project / args.mozconfig, firefox / "mozconfig")

    print(f"Applied Browser fork overlay to {firefox}")
    print(f"Pinned upstream: {upstream['commit']}")

if __name__ == "__main__":
    main()
