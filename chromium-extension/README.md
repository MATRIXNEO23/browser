# FILUM for Chrome/Edge Windows — installable prototype 0.2

This is an isolated Chromium Manifest V3 extension. It does not replace the Firefox-based Windows FILUM release.

## Install locally

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable Developer mode, select **Load unpacked**, and choose this `chromium-extension` directory.
3. Open a new tab and pin the FILUM icon. Click it to open the FILUM side panel.
4. Optionally load `../chrome-windows-theme` as a second unpacked package to color the browser frame dark navy/cyan. Only one Chrome/Edge theme can be active at a time.

The prototype implements a FILUM new tab, search using the browser's default search provider, direct links to built-in bookmarks/history/extensions pages, a persistent side panel, ADS ruleset toggle with state readback, and NORMAL/TURBO tab management. TURBO retains up to three non-active tabs, protecting pinned, audible and non-discardable tabs where possible. Changing back to NORMAL stops future discards; discarded tabs reload when selected.

The extension cannot reproduce the Firefox fork's privileged `browserControl` API, native toolbar, Tor process launcher, direct DNS settings, or whole-browser PRIVATE/GHOST semantics. Tor and DNS are shown as unavailable explanations, never as active controls. A verified Windows native companion would be needed for the Tor process; Chrome's proxy API alone does not launch Tor or prove DNS isolation. Chromium may also restrict new-tab overrides in incognito windows. No claim of feature parity or Tor anonymity is made. The optional theme changes supported frame colors, not tab geometry or Chrome's built-in controls.

No native binary is bundled. Load it only from this exact source directory and keep the original FILUM Windows build separate. The Firefox release's Defender alert is a separate unresolved investigation.

## Source and next gate

The next milestone is an unpacked-extension smoke test on Windows Chrome and Edge profiles: new tab, search, side panel opened from FILUM icon, ADS on/off, more than three background tabs under TURBO, return to NORMAL, and separate theme installation. Passing static tests alone does not prove browser runtime behavior.
