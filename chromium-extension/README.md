# FILUM for Chromium — installable prototype 0.1

This is an isolated Chromium Manifest V3 extension. It does not replace the Firefox-based Windows FILUM release.

## Install locally

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable Developer mode, select **Load unpacked**, and choose this `chromium-extension` directory.
3. Open a new tab and pin the FILUM extension button to the toolbar.

The prototype implements a FILUM new tab, search using the browser's default search provider, direct links to built-in bookmarks/history/extensions pages, ADS ruleset toggle with state readback, and NORMAL/TURBO tab management. TURBO retains up to three non-active tabs, protecting pinned, audible and non-discardable tabs where possible. Changing back to NORMAL stops future discards; discarded tabs reload when selected.

The extension cannot reproduce the Firefox fork's privileged `browserControl` API, native toolbar, Tor process launcher, direct DNS settings, or whole-browser PRIVATE/GHOST semantics. Those controls are deliberately absent. Chromium may also restrict new-tab overrides in incognito windows. No claim of feature parity or Tor anonymity is made.

No native binary is bundled. Load it only from this exact source directory and keep the original FILUM Windows build separate. The Firefox release's Defender alert is a separate unresolved investigation.

## Source and next gate

The first milestone is an unpacked-extension smoke test on a Windows Chrome/Edge profile: new tab, search, ADS on/off, more than three background tabs under TURBO, and return to NORMAL. Passing static tests alone does not prove browser runtime behavior. Expand the port only after those controls are observed on a real browser.
