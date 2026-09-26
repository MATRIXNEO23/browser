#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"

errors = []

def require_file(path):
    p = ROOT / path
    if not p.is_file():
        errors.append(f"missing file: {path}")
    return p

def require_text(path, *needles):
    p = require_file(path)
    if not p.is_file():
        return ""
    text = p.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            errors.append(f"{path}: missing {needle!r}")
    return text

manifest_path = require_file("extension/manifest.json")
if manifest_path.is_file():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    permissions = set(manifest.get("permissions", []))
    required_permissions = {
        "tabs", "storage", "downloads", "theme", "declarativeNetRequest",
        "management", "privacy", "browsingData", "history", "bookmarks",
        "search", "browserSettings", "proxy", "alarms"
    }
    missing = required_permissions - permissions
    if missing:
        errors.append("manifest missing permissions: " + ", ".join(sorted(missing)))
    if "experiment_apis" not in manifest or "browserControl" not in manifest["experiment_apis"]:
        errors.append("manifest missing privileged browserControl experiment API")
    if manifest.get("version") != "0.4.1":
        errors.append("FILUM core version must be 0.4.1")
    if "action" in manifest:
        errors.append("manifest must not expose a duplicate WebExtension toolbar action")
    if "sidebar_action" in manifest:
        errors.append("manifest must not expose Firefox sidebar_action; FILUM uses its native panel")
    if manifest.get("chrome_url_overrides", {}).get("newtab") != "newtab.html":
        errors.append("custom new tab not configured")

sidebar_html = require_text(
    "extension/sidebar.html",
    'data-mode="NORMAL"', 'data-mode="TURBO"', 'data-mode="PRIVATE"', 'data-mode="GHOST"',
    'id="ads"', 'id="enforce"', 'id="smart-search"', 'id="addons-installed"',
    'id="https-only"', 'id="secure-dns"', 'id="dns-provider"', 'id="dns-endpoint"', 'id="apply-dns"',
    'id="dns-status"', 'id="hardware-accel"', 'id="network-mode"',
    'id="resource-stats"', 'id="library"', 'id="tor-toggle"', 'id="tor-status"',
    'id="diagnostics"'
)

sidebar_js = require_text(
    "extension/sidebar.js",
    "set-mode", "set-ads", "enforce-now", "open-smart-search", "open-addons-installed",
    "set-https-only", "set-secure-dns", "set-hardware-acceleration",
    "set-browser-theme", "set-website-appearance", "get-advanced-settings",
    "browser.proxy.settings.set", "set-tor", "set-filum-panel-open",
    "runControlSelfTest", "tor-bootstrap-100", "dns-custom-endpoint",
    "network-direct", "network-system-vpn", "network-socks5",
    "reportControlSelfTest", "dns-cloudflare-preset", "tor-mode-switch-webrtc"
)

require_text("extension/diagnostics.html", 'id="mode"', 'id="tor"', 'diagnostics.js')
require_text("extension/diagnostics.js", "get-mode-diagnostics", "browser.proxy.settings.get", "get-status")

background_js = require_text(
    "extension/background.js",
    "MODE_LIMITS = { NORMAL: 3, TURBO: 3, PRIVATE: 3, GHOST: 3 }",
    "applyRuntimePrivacy", "beginGhostSession", "endGhostSession",
    "set-hardware-acceleration", "set-https-only", "set-secure-dns",
    "set-website-appearance", "get-advanced-settings", "open-internal-page",
    "browser.tabs.discard", "declarativeNetRequest.updateEnabledRulesets",
    "setTorEnabled", "proxyDNS: true", "peerConnectionEnabled.set",
    "set-filum-panel-open", "setFilumPanelOpen"
)

api_js = require_text(
    "extension/experiment-apis/browserControl.js",
    "ChromeUtils.requestProcInfo", "setHardwareAcceleration", "setHttpsOnly",
    "setSecureDns", "setWebsiteAppearance", "openInternalPage", "applyMode",
    "startTor", "stopTor", "getTorStatus", "Subprocess.call",
    "Bootstrapped 100%", "network.trr.uri", "reportControlSelfTest",
    "setFilumPanelOpen", "win.FilumPanel"
)

require_text("extension/newtab.html", 'id="normal-search"', 'id="smart"', 'id="library"', 'id="addons"', "<strong>FILUM</strong>")
require_text(
    "extension/newtab.css",
    'url("assets/filum-background.jpg")',
    ".hero-logo",
    ".wordmark",
    ".quick-actions"
)
require_text("extension/newtab.js", "browser.search.search", "smart-search.html", "library.html", "addons.html")
policies = json.loads((ROOT / "distribution/policies.json").read_text(encoding="utf-8"))
homepage = policies.get("policies", {}).get("Homepage", {})
if homepage.get("URL") != "about:newtab" or homepage.get("StartPage") != "homepage":
    raise SystemExit("FILUM startup homepage policy is missing")
require_text("extension/smart-search.js", "searchCandidates", "scoreCandidate", "inspectPage")
require_text("extension/library.js", "browser.history", "browser.bookmarks", "browser.downloads")
require_text(
    "extension/addons.js",
    "browser.management.getAll",
    "browser.browserControl.setAddonEnabled",
    "browser.browserControl.uninstallAddon",
)
require_text(
    "extension/experiment-apis/browserControl.js",
    "AddonManager.getAddonByID",
    "AddonManager.PERM_CAN_ENABLE",
    "AddonManager.PERM_CAN_DISABLE",
    "AddonManager.PERM_CAN_UNINSTALL",
)
require_file("scripts/audit-addons.cjs")
require_text(
    "fork/mozconfig.win64",
    "--with-app-name=browser",
    "--with-app-basename=Browser",
    "--with-branding=browser/branding/browser",
    "--enable-artifact-builds"
)
require_file("fork/branding/browser-icon.png")
require_file("extension/icons/browser.png")
for i in range(1, 6):
    require_file(f"extension/assets/filum-background.b64.{i:02d}")
require_text(
    "fork/browser-chrome.css",
    "#navigator-toolbox",
    "#urlbar-background",
    "#PersonalToolbar",
    "#firefox-view-button",
    "#filum-sidebar-button",
    "#filum-panel-box",
    "#filum-panel-browser",
    "#resource-controller_matrixneo23_browser-browser-action",
    "data:image/svg+xml,"
)
require_text("scripts/generate-brand-assets.py", "Image.open", "firefox.ico", "default{size}.png")
require_text(
    "scripts/apply-fork-overlay.py",
    "browser-core",
    "MATRIXNEO23 Browser fork",
    "patch_native_filum_button",
    'id="filum-sidebar-button"',
    "patch_filum_panel_markup",
    'id="filum-panel-box"',
    "patch_filum_panel_controller",
    "MATRIXNEO23 FILUM native panel controller",
    'buttonId: "filum-sidebar-button"',
    'button.addEventListener("command"',
    'button.click()',
    'extensionId: "resource-controller@matrixneo23.browser"',
    "ExtensionParent.WebExtensionPolicy.getByID",
    'browser.setAttribute("messagemanagergroup", "webext-browsers")',
    'browser.setAttribute("webextension-view-type", "sidebar")',
    '"extension-browser-inserted"',
    '"chrome://extensions/content/ext-browser-content.js"',
    '"Extension:InitBrowser"',
    "policy.getURL(this.panelPath)",
    "FilumPanel.runSelfTest",
    "navigator-toolbox.inc.xhtml",
    "browser-box.inc.xhtml",
    "browser.js",
    "restore_filum_background",
    "2b2c7f659eaade035375be20f8735ab3daada878645cfb0cda5f7381721c1bc6"
)
require_text(
    "fork/branding/pref/firefox-branding.js",
    'pref("sidebar.position_start", false);',
    'pref("browser.startup.homepage", "about:newtab");',
    'pref("browser.startup.page", 1);'
)
require_text(
    "docs/CANONICAL_PRODUCT_REQUIREMENTS.md",
    "NORMAL / TURBO / PRIVATE / GHOST",
    "SMART SEARCH",
    "maximum of 3 active background",
    "TOR ON starts the bundled Tor daemon",
    ".onion navigation is supported"
)

# Basic UI wiring: every sidebar id expected to be interactive must appear in sidebar.js.
for control_id in re.findall(r'id="([^"]+)"', sidebar_html):
    if control_id in {"status", "resource-stats", "socks-fields", "hardware-note"}:
        continue
    if control_id not in sidebar_js and f"data-{control_id}" not in sidebar_html:
        errors.append(f"sidebar control #{control_id} is not referenced by sidebar.js")

require_text("scripts/apply-fork-overlay.py", "patch_windows_identity", 'name=\"Browser\"', "WIN32_MODULE_COMPANYNAME=MATRIXNEO23")
require_text(
    ".github/workflows/build-windows.yml",
    "resedit-cli@3.1.0",
    "Browser-Windows-x64-final",
    "Apply final Windows identity and FILUM icon",
    'TOR_VERSION="15.0.23"',
    'TOR_FILE="tor-expert-bundle-windows-x86_64-$TOR_VERSION.tar.gz"',
    "231dad6b9cb401a54c260db7046965ef04e4f72ff071b140d423fb5da281ab1e",
    "Verify bundled TOR executable"
)

if errors:
    print("PRODUCT GATE FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("PRODUCT GATE PASSED")
print("Required visual and functional surfaces are present and wired.")
