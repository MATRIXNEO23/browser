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
    action = manifest.get("action", {})
    if action.get("default_area") != "navbar":
        errors.append("Browser Control action is not pinned to navbar by default")
    if action.get("default_icon") != "icons/browser.svg":
        errors.append("Browser Control action does not use canonical Browser icon")
    if manifest.get("chrome_url_overrides", {}).get("newtab") != "newtab.html":
        errors.append("custom new tab not configured")

sidebar_html = require_text(
    "extension/sidebar.html",
    'data-mode="NORMAL"', 'data-mode="TURBO"', 'data-mode="PRIVATE"', 'data-mode="GHOST"',
    'id="ads"', 'id="enforce"', 'id="smart-search"', 'id="addons-installed"',
    'id="https-only"', 'id="secure-dns"', 'id="hardware-accel"', 'id="network-mode"',
    'id="resource-stats"', 'id="library"'
)

sidebar_js = require_text(
    "extension/sidebar.js",
    "set-mode", "set-ads", "enforce-now", "open-smart-search", "open-addons-installed",
    "set-https-only", "set-secure-dns", "set-hardware-acceleration",
    "set-browser-theme", "set-website-appearance", "get-advanced-settings",
    "browser.proxy.settings.set"
)

background_js = require_text(
    "extension/background.js",
    "MODE_LIMITS = { NORMAL: 3, TURBO: 3, PRIVATE: 3, GHOST: 3 }",
    "applyRuntimePrivacy", "beginGhostSession", "endGhostSession",
    "set-hardware-acceleration", "set-https-only", "set-secure-dns",
    "set-website-appearance", "get-advanced-settings", "open-internal-page",
    "browser.tabs.discard", "declarativeNetRequest.updateEnabledRulesets"
)

api_js = require_text(
    "extension/experiment-apis/browserControl.js",
    "ChromeUtils.requestProcInfo", "setHardwareAcceleration", "setHttpsOnly",
    "setSecureDns", "setWebsiteAppearance", "openInternalPage", "applyMode"
)

require_text("extension/newtab.html", 'id="normal-search"', 'id="smart"', 'id="library"', 'id="addons"')
require_text("extension/newtab.js", "browser.search.search", "smart-search.html", "library.html", "addons.html")
require_text("extension/smart-search.js", "searchCandidates", "scoreCandidate", "inspectPage")
require_text("extension/library.js", "browser.history", "browser.bookmarks", "browser.downloads")
require_text("extension/addons.js", "browser.management.getAll", "browser.management.uninstall")
require_text(
    "fork/mozconfig.win64",
    "--with-app-name=browser",
    "--with-app-basename=Browser",
    "--with-branding=browser/branding/browser",
    "--enable-artifact-builds"
)
require_text("fork/branding/browser-icon.svg", 'viewBox="0 0 256 256"', "data:image/jpeg;base64,")
require_text("extension/icons/browser.svg", 'viewBox="0 0 256 256"', "data:image/jpeg;base64,")
require_text("fork/browser-chrome.css", "#navigator-toolbox", "#urlbar-background", "#PersonalToolbar", "#firefox-view-button")
require_text("scripts/generate-brand-assets.py", "cairosvg", "firefox.ico", "default{size}.png")
require_text("scripts/apply-fork-overlay.py", "browser-core", "MATRIXNEO23 Browser fork")
require_text("docs/CANONICAL_PRODUCT_REQUIREMENTS.md", "NORMAL / TURBO / PRIVATE / GHOST", "SMART SEARCH", "maximum of 3 active background")

# Basic UI wiring: every sidebar id expected to be interactive must appear in sidebar.js.
for control_id in re.findall(r'id="([^"]+)"', sidebar_html):
    if control_id in {"status", "resource-stats", "socks-fields", "hardware-note"}:
        continue
    if control_id not in sidebar_js and f"data-{control_id}" not in sidebar_html:
        errors.append(f"sidebar control #{control_id} is not referenced by sidebar.js")

require_text("scripts/apply-fork-overlay.py", "patch_windows_identity", 'name=\"Browser\"', "WIN32_MODULE_COMPANYNAME=MATRIXNEO23")
require_text(".github/workflows/build-windows.yml", "resedit-cli@3.1.0", "Browser-Windows-x64-final", "Apply final Windows identity and FILUM icon")

if errors:
    print("PRODUCT GATE FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("PRODUCT GATE PASSED")
print("Required visual and functional surfaces are present and wired.")

