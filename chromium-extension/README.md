# FILUM for Chrome/Edge Windows — installable prototype 0.6.0

This is an isolated Chromium Manifest V3 extension. It does not replace the Firefox-based Windows FILUM release.

## Install locally

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable Developer mode, select **Load unpacked**, and choose this `chromium-extension` directory.
3. Open a new tab and pin the FILUM icon. Click it to open the FILUM side panel.
4. Optionally load `../chrome-windows-theme` as a second unpacked package to color the browser frame dark navy/cyan. Only one Chrome/Edge theme can be active at a time.

The bundled FILUM new-tab home opens without an Internet connection. The ordinary Search button uses the browser's default search provider. SMART SEARCH offers exact phrases, required and excluded terms, source preferences, shopping/social penalties, suspicious-URL filtering, a locally stored excluded-domain list and an optional deep read of five candidate pages. Deep read asks for access to websites when enabled. The no-key search first requests DuckDuckGo's HTML page and ranks up to 50 results locally, displaying every candidate returned. The 50-result cap does not force DuckDuckGo to provide 50 results on one page. If that endpoint rejects the request or yields no results, the extension opens a temporary background DuckDuckGo tab, reads visible result titles/URLs/snippets and closes the tab. This requires DuckDuckGo host access and Chrome's scripting permission. If the normal page is also blocked or changes its markup, the UI reports the error and offers a direct search link. An optional Tavily key can be saved in the browser profile, with local daily/monthly limits and an explicitly labelled button that uses a credit. No Tavily request runs from the no-key button. The home remains available offline. Opening Chrome/Edge with its startup option set to “New tab” shows this home.

The extension also provides direct links to built-in bookmarks/history/extensions pages, a persistent side panel, ADS ruleset toggle with state readback, and NORMAL/TURBO tab management. TURBO retains up to three non-active tabs, protecting pinned, audible and non-discardable tabs where possible. Changing back to NORMAL stops future discards; discarded tabs reload when selected.

The network section offers an explicit connection to the third-party GoodExtensions HTTPS proxy used by the user-supplied `Browser Tor.crx`. Its controls and connection state appear in the existing FILUM side panel; the CRX popup, advertisements and telemetry are not included. On click, FILUM requests a proxy configuration, applies it to Chrome/Edge, and checks whether Tor Project reports `IsTor=true` for a request. It checks again about once per minute and when the panel opens. A failed check outside the initial connection marks Tor unverified and leaves the proxy configured. If Chrome reports the proxy setting changed/removed, or two consecutive Tor checks fail, FILUM automatically requests fresh proxy credentials and reconnects. It tries at most three times; failed initial connection rolls back the proxy, and a user disconnect disables recovery. Both the regular-profile proxy and recovery alarms operate independently of whether the FILUM side panel is open or minimized. Chrome may delay alarms while the computer is asleep; they do not wake it. This feature depends on a third-party service and has not been verified on the user's Windows installation. It does not bundle or launch Tor, prove that all traffic avoids leaks, or provide Tor Browser's privacy protections. Connection sends a stable random client ID to the service; transient proxy credentials are held in browser session storage. The added proxy and webRequest permissions can prompt broad access warnings. See `docs/FILUM_CHROMIUM_CODE_MAP.md` for file-by-file behavior and the required modification log.

The extension still cannot reproduce the Firefox fork's privileged `browserControl` API, native toolbar, direct DNS settings, or whole-browser PRIVATE/GHOST semantics. Chromium may restrict new-tab overrides in incognito windows. The optional theme changes supported frame colors, not tab geometry or Chrome's built-in controls.

No native binary is bundled. Load it only from this exact source directory and keep the original FILUM Windows build separate. The Firefox release's Defender alert is a separate unresolved investigation.

## Source and next gate

The next milestone is an unpacked-extension smoke test on Windows Chrome and Edge profiles: new tab, search, side panel opened from FILUM icon, ADS on/off, more than three background tabs under TURBO, return to NORMAL, and separate theme installation. Passing static tests alone does not prove browser runtime behavior.
