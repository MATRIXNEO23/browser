# CANONICAL PRODUCT REQUIREMENTS

This file is the binding product specification for the browser.

## Product identity

- This is a standalone personal browser, not a Firefox addon product.
- Gecko/Firefox may be used as the web engine/runtime, but the product UI, controls, defaults and behavior belong to this browser.
- No startup mode chooser.
- The browser opens directly.
- NORMAL / TURBO / PRIVATE / GHOST must be selectable while the browser is already running.
- No restart is required just to change mode.
- The browser must remain usable as a normal full browser.

## Core browser functions

- Multiple tabs and multiple windows.
- Global maximum of 3 active background content contexts across all windows.
- Tabs beyond the global budget are frozen/discarded when possible.
- Foreground tab remains fully active.
- Audio/video and pinned tabs receive priority but still count toward the global budget.
- Downloads must continue through the browser download manager where possible.
- Automatic restore of discarded tabs on selection.
- History: searchable and deletable.
- Bookmarks and bookmark manager.
- Thin, non-invasive bookmarks bar.
- Downloads manager.
- Password manager / Gecko password infrastructure.
- Configurable search engine.
- Session restore.
- Private windows and private-browsing capabilities.
- Zoom and fullscreen.
- DevTools available.
- Import/export for bookmarks and other browser data where supported by Gecko.
- Cookie and site-data management.
- Hardware acceleration toggle.
- Performance / memory-saver controls.
- Certificate and connection-security management.
- Site permissions: camera, microphone, location, notifications, clipboard and popups.
- Optional normal user profiles may exist for separation such as personal/work use, but modes are never tied to a profile selector at startup.
- Normal Firefox/WebExtensions addon compatibility.
- Addon button with:
  - installed addon manager;
  - direct link to addon catalogue.

## UI

- Dark interface by default.
- Compact browser chrome.
- Collapsible settings/control sidebar.
- Sidebar contains live mode selection.
- Visible independent ADS ON/OFF control.
- Visible SMART SEARCH entry.
- Visible Free RAM action.
- Background activity counter, e.g. BG 2/3.
- Minimal visual clutter.
- Optional resource indicators for RAM/CPU.
- Forced dark websites must be optional because it can break pages.

## Modes — live switching

### NORMAL
- Persistent history, cookies, sessions and logins.
- Strong baseline tracking protection.
- Maximum compatibility.
- Background activity budget <= 3.

### TURBO
- Same browser session; switchable live.
- Aggressive tab discard and timer throttling.
- Autoplay disabled where possible.
- Prefetch/preload disabled.
- Background work minimized.
- Optional heavy-content reduction.
- ADS control remains independent.
- Background activity budget <= 3.

### PRIVATE
- Switchable live.
- Stronger tracking protection.
- Partitioned / restricted storage.
- Stronger fingerprint protection.
- Reduced referrer exposure.
- WebRTC leak reduction.
- Existing browser remains open; privacy rules change for subsequent activity.
- Background activity budget <= 3.

### GHOST
- Switchable live.
- Strongest privacy mode available without claiming anonymity.
- Non-persistent cookies/session data for activity performed in the mode where technically possible.
- Strong anti-fingerprinting configuration.
- WebRTC disabled or constrained aggressively.
- Referrer minimized.
- Optional network privacy layer.
- On leaving GHOST, ephemeral GHOST data should be cleared when technically safe.
- GHOST is not equivalent to Tor Browser.
- Background activity budget <= 3.

## ADS

- ADS ON/OFF is independent of browser mode.
- Blocking must happen at request level where possible, not only cosmetic CSS.
- Built-in lightweight blocker.
- Firefox addon ecosystem remains available, including full blockers such as uBlock Origin where supported.
- Per-site exceptions are planned.

## Privacy and security

- No claim of being invisible online.
- Prefer fingerprint normalization/reduction over random fingerprint rotation.
- Cookie/storage partitioning.
- Tracking protection.
- Tracking-parameter stripping where possible.
- WebRTC leak protection.
- HTTPS-first / HTTPS-only options.
- Secure DNS / DoH option.
- Proxy support.
- Network modes planned: DIRECT / SYSTEM PROXY / SOCKS / VPN integration.
- TOR is an independent live network control, combinable with NORMAL / TURBO / PRIVATE / GHOST.
- The Windows distribution includes a checksum-verified Tor Expert Bundle.
- TOR ON starts the bundled Tor daemon, routes browser traffic through SOCKS5 with remote DNS, disables WebRTC, and must not silently fall back to DIRECT.
- TOR OFF restores the network and DNS settings that were active before TOR was enabled.
- .onion navigation is supported while TOR is active.
- FILUM must clearly state that routing through Tor does not make it equivalent to Tor Browser's anonymity protections.
- Site permission controls for camera, microphone, location, notifications, clipboard and popups.
- Advanced WebRTC / DNS / proxy controls.
- Compatibility-for-this-site path to relax protections per site without disabling them globally.
- Optional appearance choices: DARK / SYSTEM / BLACK; forced-dark websites remains optional.
- No project telemetry by default.

## SMART SEARCH

- User can choose normal web search or SMART SEARCH.
- SMART SEARCH obtains a bounded candidate set rather than endless results.
- Local ranking based on the user's query.
- Duplicate removal.
- Support required terms, excluded terms and exact phrases.
- Optional preference for direct/technical/official sources.
- Optional penalties for shopping/social/SEO-heavy results.
- Only the best small subset is opened/read more deeply.
- Explain why each result ranked highly.
- Do not require a heavy local LLM.
- Do not send query/page text to an external AI model by default.
- Search history for SMART SEARCH is not persisted by default.

## Performance target

- Windows x64.
- Old Core i3-class hardware.
- Keep the browser usable on low-spec PCs.
- Avoid Electron.
- Avoid a second browser engine.
- Minimize background services.
- Bound caches where practical.
- Benchmark rather than claim performance improvements.

## Build / persistence

- Source and configuration must be committed to the repository.
- Deliverable Windows ZIPs must also be persisted as GitHub Release assets, not only temporary workflow artifacts.
- Every release includes SHA256 checksum.
- A build is not considered delivered until its persistent repository Release exists.
