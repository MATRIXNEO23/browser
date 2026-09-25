# FILUM WORK CONTINUITY

Captured: 2026-09-25 Europe/Rome
Repository: MATRIXNEO23/browser
Canonical branch: main
Captured source HEAD before this continuity checkpoint: 923857f975fe696dbf2897d39e9209500ba42c88

## Scope and non-negotiable constraints

- Work only in MATRIXNEO23/browser.
- DO NOT modify MATRIXNEO23/scodinzolina-conntinuity.
- Do not make autonomous product changes.
- If a requirement is ambiguous, ask Alberto before changing it.
- Preserve the currently approved New Tab/background exactly as-is.
- Approved visual: very dark FILUM skin, active tab slightly illuminated, current cyber-tech digital background with blue/cyan circuits, no mountains.
- The current background is explicitly approved and MUST NOT be modified unless Alberto asks.
- The FILUM sidebar should be slightly narrower and controls more compact so nearly all controls fit with little/no scrolling.
- The toolbar button that opens/closes the sidebar must visually use the FILUM icon.
- Do not declare a function fixed merely because its button exists. Verify state change/effect.

## User-reported problem that led to current work

On the installable Windows build:
- FILUM sidebar opens.
- Controls originally appeared dead: clicking modes/toggles did not visibly select or change state.
- DNS lacked a user-selectable/custom endpoint field.
- TOR did not work.
- Screenshot showed the concrete runtime error: `Rete: browser is not defined`.
- User requested verification of ALL functions shown in the sidebar.
- User later requested the sidebar slightly narrower and buttons smaller.
- User explicitly said the current New Tab background is liked and must not be changed.

## Structural root cause found

The native FILUM panel was loading `sidebar.html` inside a chrome-created `<browser>`, but that browser was not initialized as a real WebExtension view.

Therefore the page did not receive WebExtension APIs and `browser.*` was undefined. This explained why many controls appeared dead at once.

The panel controller in `scripts/apply-fork-overlay.py` was changed to initialize the native panel using the Firefox WebExtension-view path:
- `messagemanagergroup="webext-browsers"`
- `webextension-view-type="sidebar"`
- `ExtensionParent.apiManager.emit("extension-browser-inserted", ...)`
- load `chrome://extensions/content/ext-browser-content.js`
- send `Extension:InitBrowser`

This change is persisted in git.

## Relevant persisted implementation changes

Core version:
- `extension/manifest.json` bumped to FILUM core `0.4.1`.

Sidebar functionality:
- `extension/sidebar.js` now gives persistent selected-state feedback for modes/toggles.
- Errors are surfaced instead of swallowed silently.
- Functional self-test implemented.
- DNS UI now includes:
  - DNS mode selection
  - custom DoH HTTPS endpoint field
  - Apply DNS button
  - visible DNS status
- `extension/experiment-apis/browserControl.js`:
  - custom DNS URI support through `network.trr.uri`
  - TOR bootstrap tracking
  - TOR considered ready only after `Bootstrapped 100%`
  - control self-test result persisted to pref `filum.selftest.controls`
- `extension/background.js`:
  - get-status hardened so TOR errors do not kill the entire sidebar refresh
  - TOR stale state/restart cleanup improved
  - previous proxy and previous custom DNS URI preserved/restored
- `fork/browser-chrome.css`:
  - FILUM panel narrowed to ~304 px (min 286 / max 360)
  - toolbar FILUM icon slightly emphasized
- `extension/sidebar.css`:
  - padding/gaps/control heights reduced to minimize scrolling
- New Tab/background were NOT changed in this workstream.

## TOR behavior currently implemented

Bundled Tor Expert Bundle is present and `tor.exe --version` works.

TOR start now:
1. launches bundled `tor.exe`
2. reads stdout
3. waits for `Bootstrapped 100%`
4. only then marks TOR ready
5. applies SOCKS5 `127.0.0.1:19050`
6. enables proxy DNS
7. disables WebRTC where possible
8. restores prior proxy/DNS when TOR stops or fails

If bootstrap does not complete, the code times out and exposes the error/log instead of pretending TOR is ON.

## Build/run status

### Full build run #99
GitHub Actions run:
- run id: 36116396358
- source trigger commit: 97b3bf244eacaa02f3a898ca47f2ecaf8dda64d0
- build job: PASS
- product gate: PASS
- ESR clone/overlay: PASS
- native Windows build: PASS
- package assembly: PASS
- build artifact `Browser-Windows-x64`: created
- Windows smoke job: FAILED before the new full functional report was consumed
- reason of that first smoke failure: old panel-selftest wait/check path did not observe `filum.selftest.panel` in time; this did NOT prove individual controls failed.

Important: reuse the run #99 build artifact for smoke-only validation when possible; do NOT rebuild Gecko unnecessarily.

### Smoke-only promotion run #2
Workflow:
- `.github/workflows/promote-existing-artifact.yml`
- run id: 36117318277
- HEAD that triggered it: 923857f975fe696dbf2897d39e9209500ba42c88
- source artifact run: 36116396358
- source SHA: 97b3bf244eacaa02f3a898ca47f2ecaf8dda64d0
- checksum/unpack: PASS
- final Windows identity: PASS
- built-in FILUM core: PASS
- bundled Tor executable/version: PASS
- functional sidebar smoke: FAILED

This smoke run is the strongest evidence so far because it exercised real state changes and read them back.

## Exact functional self-test result from run 36117318277

PASSED:
- mode-normal
- mode-turbo
- mode-private
- mode-ghost
- ads-toggle
- https-only
- dns-custom-endpoint
- website-appearance
- browser-theme
- hardware-acceleration
- free-ram
- network-direct
- network-system-vpn
- network-socks5

FAILED:
- `exception: Timeout self-test.`

Where the timeout occurred:
- immediately after `network-socks5`
- next operation in the test is TOR start/bootstrap
- therefore current blocker is TOR bootstrap/test path

NOT YET REACHED in that run because the TOR timeout aborted the sequence:
- tor-bootstrap-100
- tor-proxy
- tor-stop
- smart-search
- addons-installed
- addons-catalog
- library
- internal-settings
- internal-privacy
- internal-passwords
- internal-profiles
- internal-processes

Do NOT claim those later functions are verified yet.

## Current blocker

TOR did not reach the expected ready state within the self-test timeout.

Evidence:
- bundled `tor.exe` exists and reports:
  `Tor version 0.4.9.12 (git-78923280eed3eff6)`
- the runtime self-test timed out after all non-TOR controls listed above had passed.
- No specific TOR diagnostic was recorded in that run because the self-test wait helper collapsed the failure into generic `Timeout self-test.`.

Therefore the next task is NOT to rewrite the panel and NOT to rebuild everything.

## Exact next action

1. Keep the current approved UI/background unchanged.
2. Reuse the existing run #99 artifact if possible.
3. Improve only TOR diagnostic/self-test so a TOR failure reports:
   - whether `tor.exe` process is running
   - `bootstrapped` flag
   - last Tor log lines from `getTorStatus().lastLog`
   - current browser proxy settings
   - elapsed bootstrap time
   - whether timeout is network-environment related or application wiring
4. Run smoke-only again from the existing artifact if no packaged code change is required.
5. If a packaged code change is required, change only the TOR-related code and then rebuild once.
6. Once TOR passes or a concrete environment limitation is proven, continue the same self-test so the still-unreached launcher/internal-page controls are verified.
7. Do not deliver a new user build until all required sidebar functions are either:
   - verified PASS, or
   - explicitly identified with a concrete blocker and not falsely claimed fixed.

## Current repository state after smoke-only setup

At capture time:
- branch: main
- HEAD: `923857f975fe696dbf2897d39e9209500ba42c88`
- `build/PROMOTE_TRIGGER` points to:
  - `source_run=36116396358`
  - `source_sha=97b3bf244eacaa02f3a898ca47f2ecaf8dda64d0`
- `.github/workflows/promote-existing-artifact.yml` has a full functional sidebar smoke test and release job disabled.
- No final validated artifact was uploaded from smoke-only run #2 because the functional test failed at TOR.

## Key commits in this workstream

- `3afd8a4723f41e1824f372a2db3ed9efa270a9ca` — initialize FILUM panel as real WebExtension view
- `bcb0bd2e07e5ca9cb949fa9e09df227da1e3ffa5` — persist control self-test result immediately
- `722d3e0c28234734b788bd13c3c87453f8912296` — make panel slightly narrower and emphasize FILUM icon
- `1b746b666dc4814ee4e19e881d54a8111c1f4458` — compact sidebar controls
- `e74279add618e8d316cf1959ca7b35399d2ce88a` — verify all sidebar controls including TOR
- `ca4f30e733a6895c6eacc7d4699d10f7dd34bd04` — complete TOR failure-state cleanup
- `583451d4618cf1b94783e15182caa58642143929` — avoid ADS/TOR self-test races
- `97b3bf244eacaa02f3a898ca47f2ecaf8dda64d0` — trigger full build #99
- `89a4e2737bcf7de0941e07f4530253d5db63cda6` — add smoke-only full control validation on existing artifact
- `923857f975fe696dbf2897d39e9209500ba42c88` — point smoke-only workflow at run #99 artifact

## Recovery instruction for next instance

Read this file first, then verify current `main` HEAD and latest Actions run before doing any work. Continue from the TOR bootstrap blocker. Do not restart architecture work, do not change the approved background, and do not rerun the expensive full build unless TOR code/package contents actually change.

## 2026-09-25 TOR diagnostic checkpoint (work in progress)

- Verified remote `main` at `492df357371a70e96850f22a700c6a706b7d21e6` before edits. Read this file completely.
- Rechecked Actions run `36116396358`: build succeeded, `Browser-Windows-x64` artifact `10854569035` remains available; its Windows smoke failed. Rechecked run `36117318277`: functional smoke succeeded through SOCKS5, then failed with generic `Timeout self-test.`; no final artifact.
- Root of generic report: sidebar self-test waits 90 seconds for `torEnabled && bootstrapped`, but packaged TOR code rejects at 45 seconds. The self-test did not record the available TOR status/log before throwing.
- Prepared a smoke-only update to `extension/sidebar.js`: sample `getStatus()` during TOR bootstrap, record process observed/running, bootstrap flag, recent `lastLog`, proxy, elapsed time, process failure, exit code if available, and error; continue launcher tests after failed TOR bootstrap. This changes only the self-test section, not the normal sidebar behavior or TOR engine.
- Prepared `scripts/patch-smoke-sidebar.py` to replace only `chrome/browser/builtin-addons/browser-core/sidebar.js` in the run #99 staged `omni.ja`, verifying the original bytes against source SHA before replacement. A synthetic archive round trip passed. Gecko will not be rebuilt for this diagnostic.
- Prepared smoke-only workflow changes to patch that test, probe bundled `tor.exe` against the runner network using a separate data directory and port, report its log/running/bootstrap/exit code, and allow 220 seconds for the complete test.
- Next: commit/publish these changes plus a new `build/PROMOTE_TRIGGER` value to run the smoke-only workflow; inspect the TOR diagnostic and all later controls. Do not deliver any build from a failed smoke. If TOR engine/package code really needs a fix, do that alone and build once.
- The approved New Tab/background, skin and sidebar design have not been edited.
- Smoke-only run `36122840981` failed before TOR was exercised: the archive patch script attempted `git show` of source SHA in the runner's depth-1 checkout; that commit was absent. Core and TOR version verification passed. No inference about TOR from this run.
- Replaced that lookup with a fixed SHA-256 comparison of the artifact's original `sidebar.js` (`83b337916eb503ee9de0b7f3395f0774a9c30f077884a960002a4d82614f1b85`), retaining fail-closed verification without needing Git history. Next trigger `smoke_revision=tor-diagnostics-20260925-b` reruns the same artifact.
- Run `36123113474` reached the patch and passed the hash check, but Windows denied replacing `omni.ja` while the source `ZipFile` handle was still open (and the extracted target may be read-only). It did not run the TOR probe or browser test. The script now closes the archive and makes the target writable before replacing; trigger `tor-diagnostics-20260925-c` is next. The build #99 artifact remains the sole source.
- Run `36123295091` successfully patched the staged artifact and completed browser smoke. TOR failed: `elapsedMs=60259`, `processObserved=false`, `processRunning=false`, `bootstrapped=false`, `lastLog=""`, browser proxy remained `system`, exit code not available through current API. `tor-proxy` was blocked; `tor-stop` reported clean. Smart Search, installed Addons, catalog, Library, Settings, Privacy, Passwords, Profiles, and Processes returned PASS in this smoke, but some checks only confirm tab creation or API acknowledgment, not target URL/content.
- The separate TOR probe exited `1` in 1.1 seconds, but its PowerShell argument quoting did not capture stdout/stderr; do not classify as network failure yet. Added `scripts/probe-tor-runner.py` to launch with an exact argv array and capture early output/exit code. The smoke-only sidebar records the click handler's actual TOR exception before UI refresh clears it. Next trigger is `tor-diagnostics-20260925-d`. Do not publish a build yet.
- Run `36123672020`: stand-alone bundled Tor on the same Windows runner reached `Bootstrapped 100%` in 11 seconds, so runner network is not the blocker. FILUM's `startTor` failed in 873 ms with WebExtension's generic `An unexpected error occurred`; no running process or Tor log, proxy still `system`. This is FILUM/TOR privileged wiring, before bootstrap. All post-TOR launch checks returned PASS as currently defined; these checks need stronger URL/content assertions before final delivery.
- Prepared TOR-only privileged API diagnostics (`torStage`, `torLastError`, exit code) in `extension/experiment-apis/browserControl.js` and smoke-only archive patch for that file plus sidebar self-test, both source hashes checked. Synthetic archive round trip and JS syntax checks passed. Next trigger `tor-diagnostics-20260925-e` uses run #99 artifact to identify the exact failure stage. Do not rebuild Gecko until the fix is known; then one new build if packaged TOR code must change.
- Run `36124036476` identified the exact code defect: `bootstrap-failed: setTimeout is not defined`, exit code `-9` from cleanup; no Tor log because the privileged API threw as it constructed the timeout immediately after process launch. Separate Tor reached 100% in 13.5 seconds. Importing `setTimeout`/`clearTimeout` from Gecko's `Timer.sys.mjs` is the targeted TOR fix. The test also saw occasional visual timing failures for PRIVATE/GHOST after mode state changed; the smoke now waits for visual selected state before recording. Trigger `tor-timer-fix-smoke-20260925-f` tests patched source against run #99 artifact. If TOR passes, strengthen later page URL checks, then do exactly one new full build for the packaged TOR change.
- Run `36124279512` PASS: TOR bootstrapped 100% in 17.7 seconds inside FILUM, process running, manual SOCKS5 `127.0.0.1:19050` with `proxyDNS=true`, stop PASS. Every existing control smoke check passed, including post-TOR launchers. Validated final artifact was uploaded for this smoke-only run, but this is a patched copy of build #99, not yet the canonical full build from current source.
- Strengthened smoke to verify actual sidebar launcher clicks and the newly opened tab's expected URL for Smart Search, Addons installed/catalog, Library, Settings, Privacy, Passwords, Profiles, Processes. TOR stop checks restoration of initial proxy. Added Tor Project `/api/ip` egress check requiring `IsTor=true` through the browser proxy. Trigger `tor-full-effect-smoke-20260925-g` reruns build #99 with these stronger assertions before starting one full build. No UI/background changes.
- Run `36124699404`: TOR bootstrap PASS in 13.0 seconds, proxy/DNS PASS, Tor Project egress `HTTP 200; IsTor=true`, stop restored `system` proxy. Every real sidebar launcher opened its expected URL except the Addons catalog assertion: Mozilla redirected the requested `/firefox/extensions/` to `/en-US/firefox/extensions/`. This is a valid catalog destination, not a product failure. The smoke now permits the locale segment while requiring the exact Mozilla Addons host and extensions path. Next trigger `tor-full-effect-smoke-20260925-h`; then one full build if all checks pass.
- Smoke-only run `36124964466` completed SUCCESS with the strict gate: TOR bootstrap/proxy/`IsTor=true`/stop and all remaining sidebar launcher URLs PASS; final patched-artifact ID `10858843228`. This establishes source behavior before rebuilding.
- The full-build workflow's Windows smoke previously read `filum.selftest.panel` after a fixed 9-second sleep and failed prematurely in run #99. Updated the test to wait up to 45 seconds for panel report and up to 220 seconds for the complete control report. Next: trigger exactly one full native build from current source, inspect its build and Windows smoke results, then deliver only the resulting validated artifact. No further product/UI edits are planned.
- Full native build triggered once at source commit `f8e44880a7985784b2331e45f66913c629a7f8ab`, Actions run `36125372652`. At this checkpoint, product completeness gate and ESR overlay passed; native Windows build is in progress. No second full build has been started. Next: wait for build/package and Windows functional smoke, verify the exact run logs and final artifact before delivery.
- Run `36125372652` build/package SUCCESS; artifact `Browser-Windows-x64` ID `10858828619` from current source. Its Windows smoke failed before reading controls: it checked `filum.selftest.panel` in `prefs.js` before the extension reported/saved control results, so the pref was absent after 45 seconds. This does not prove a product failure; the same real panel/control gate passed on the previous patched-artifact run. Do not rebuild Gecko.
- Smoke-only workflow now points to source run `36125372652`, source SHA `f8e44880a7985784b2331e45f66913c629a7f8ab`. Archive patch script recognizes exact current sidebar/TOR bytes and leaves the newly built package unchanged. Smoke now checks panel pref after control results are persisted, alongside strict functional checks. Trigger `tor-final-build-validation-20260925-i` is next. Deliver only if this run passes and uploads final artifact.
- Run `36126675406` stopped before TOR probe: the packaged `sidebar.js` differs from both expected run #99 baseline and current source bytes. Need identify its actual SHA before any patching or delivery. The fail-closed script now prints actual, old, and current SHA-256; next trigger `tor-final-build-hash-diagnostic-20260925-j` uses the same new build artifact. Do not rebuild Gecko or silently patch unexpected source.
- Run `36127089684` exposed the packaged sidebar SHA-256 `495e1062ef9bc62effaf0c22c2b869e9ee23dff629fba065358f7a9450c71d8d`, exactly matching `git show f8e4488:extension/sidebar.js`. The current smoke-only sidebar differs because tests were revised after the native build. Packaged TOR API SHA-256 is expected `15588ccd2e46eae8d755c886c40a25528e23c2c8c9835b4fef5f5bb675ad77b4` from the same build commit. The patch script now accepts those explicit source hashes as well as the old #99 hashes and still fails closed on any other bytes. Trigger `tor-final-build-validation-20260925-k` will repack only the smoke test into this exact build; no new Gecko compilation.
- Run `36127269159`: patched exact build-source bytes successfully. Standalone Tor probe PASS. Browser control report `passed=true` for every item: TOR bootstrap 100% in 11.1 s, running process/log, manual SOCKS5 with proxy DNS, real Tor egress `HTTP 200; IsTor=true`, stop restored `system`; all modes, toggles and launcher URLs PASS. The workflow failed solely because it expected `filum.selftest.panel` to be flushed to on-disk `prefs.js` while the browser was still running. The complete control report is generated inside the native sidebar view after actual clicks. Removed that premature on-disk panel preference gate from smoke-only workflow; all functional assertions remain. Trigger `tor-final-build-validation-20260925-l` to upload only after the strict report passes. No product code change or Gecko rebuild.
- Final validation run `36127495627` SUCCESS from `main` commit `43f41e16381c60a1b6aab43bb774564eaafdd05a`, reusing native build run `36125372652` at source `f8e44880a7985784b2331e45f66913c629a7f8ab`. Artifact integrity, Windows identity, bundled core/Tor, standalone Tor probe, actual browser smoke, repack and upload all PASS. Control report `passed=true` for NORMAL/TURBO/PRIVATE/GHOST, ADS, HTTPS-only, custom DNS, site/browser appearance, acceleration, RAM, DIRECT/SYSTEM/SOCKS5, TOR 100% in 19.3 s with running process, SOCKS5 proxy DNS, real Tor Project egress `IsTor=true`, stop restoring system proxy, and actual launcher tab URLs for Smart Search, installed Addons, Mozilla Addons catalog, Library, Settings, Privacy, Passwords, Profiles and Processes. Launcher checks assert destination URL, not loaded page content or every feature inside those pages. Final Actions artifact `Browser-Windows-x64-final` ID `10860237708`, download `https://github.com/MATRIXNEO23/browser/actions/runs/36127495627/artifacts/10860237708`, expires 2026-10-25. Inner `Browser-Windows-x64.zip` SHA-256 `cdd28c4712c3bbbac7f65b5a7e532fe8ef84c9cbc3b620c2bc91eed0d08190ff`; Actions artifact wrapper digest `f235bec4703d2c55bcf60dd674f6fa3fe163f8822b2a245df45a3afa4dcc9a4f`. Only one new native Gecko build was performed. Approved UI/background untouched. No further work is required for this TOR blocker.

## 2026-09-25 user first-run TOR bootstrap report

- The delivered build failed on Alberto's Windows machine at the hard 45-second timeout. The supplied Tor log reached 50% (`loading_descriptors`) after discovering consensus and beginning relay descriptor downloads. This is evidence of progress, not evidence of a wiring failure or a completed bootstrap. The CI runner had reached 100% faster; that does not prove the first run on Alberto's network fits 45 seconds.
- Recovery checkout from remote `main` `65b4568b7d19a070288cdbb1ec4a78f1331a350f` was isolated in a separate worktree to preserve prior local uncommitted work. Targeted changes: increase privileged TOR bootstrap timeout to 180 seconds, sidebar self-test observation to 195 seconds, and workflow control-report wait to 360 seconds. No proxy, UI, background, or Tor binary changes.
- JavaScript syntax and `git diff --check` passed. Pending: commit/publish, run native build and Windows functional validation, then obtain a user-machine retest. Do not claim the slow first bootstrap is proven fixed by a fast CI runner. The prior artifact retains its 45-second timeout.
- Local commit `452a64c` contains the timeout change. A direct push to `main` was rejected by automatic approval review as an unauthorized protected-branch/workflow publication. Do not assume it was published; verify remote before any later operation.
- Alberto then requested an in-browser diagnostic window that checks actual mode settings and Tor, and a more legible FILUM F on the toolbar toggle. In the isolated worktree, added `diagnostics.html/js/css` opened by a compact sidebar button. It reads privileged mode preferences, WebExtension privacy settings, current proxy, Tor process/bootstrap/stage/error/log, and marks mismatches without asserting anonymity. Sidebar self-test now reads actual settings for each mode and checks the diagnostics launcher URL. The native toolbar button uses a larger vector F, leaving the approved New Tab/background and sidebar width untouched. Pending native Windows build and visual/function check; do not claim this version delivered.
- Alberto requested well-known selectable DNS resolvers. Added Cloudflare 1.1.1.1, Google Public DNS, and Quad9 DoH presets using provider-published HTTPS endpoints, while retaining system, browser default, and custom endpoint. Selection fills the endpoint and requires explicit Apply; the handler rereads the effective DNS mode/URI. No networking is changed until Apply. Alberto also requested VPN selections; unlike DoH endpoints, VPN services need a client/account or a system tunnel, so the existing SYSTEM/VPN setting can use an already active Windows VPN, but cannot activate arbitrary named providers. Obtain the desired VPN integration/provider details before implementing a functional selector. No fake VPN toggles.
- Alberto requested a functional audit before publication. Findings and gates are in `docs/FILUM_FUNCTIONAL_AUDIT_2026-09-25.md`. Fixed a concrete Tor mode-switch WebRTC regression, added readback checks for modes, DNS preset, and Tor-mode WebRTC, and removed the known premature panel-pref gate from the full-build smoke. Open product decisions: GHOST cleanup may affect pre-existing site data and can lose its retry marker; individual privacy-setting failures are currently swallowed by `safeSet`; SYSTEM/VPN cannot certify an active VPN. Do not publish or claim a validated Windows build until the new smoke and user-machine Tor retest.
- Further source audit: all extension JS syntax, API JSON parsing, product gate, and diff checks passed. A mocked background message-handler test confirmed Tor-active mode switch keeps WebRTC off and DNS edits are blocked. The sidebar now disables DNS controls during Tor and states the GHOST cleanup scope honestly. Diagnostics treats the independent HTTPS-only toggle as informational instead of falsely marking an override as a mode failure. Product gate recognizes the new diagnostics button and vector F. Remaining issues and limits are recorded in the audit document; no remote publication has occurred.
- Fixed an additional Tor status inconsistency: the main TOR button now requires readback of the actual SOCKS5 proxy and proxy DNS before showing ON; if Tor is running but routing differs it shows ERRORE and remains stoppable. Windows runtime validation is still pending.
- Alberto required a warning on the sidebar if a mode only partly starts or becomes interrupted. Added `getModeHealth` readback in background for mode-critical prefs, privacy settings, Tor-aware WebRTC and GHOST session marker; the sidebar displays a sticky warning with specific mismatches and refreshes every five seconds. The mode smoke includes health readback. A mocked handler test confirmed later fingerprint-setting drift triggers the warning. This is local only and awaits Windows runtime verification.
- Alberto required the first normal browser window to show the approved FILUM New Tab instead of a neutral page. Set branded defaults `browser.startup.page=1` and `browser.startup.homepage=about:newtab`; the approved New Tab assets were not edited. Windows smoke now launches without an explicit URL and asserts the active startup tab resolves to built-in `newtab.html`. Existing profiles with user-set startup preferences may override branded defaults. Native Windows result pending.
- Alberto requested intelligent filtering across multiple search engines, excluding recognizable advertisements and attempting to avoid deceptive sites. Current Smart Search has only DuckDuckGo HTML candidates. Added local ad-node filtering, duplicate avoidance already present, conservative URL risk signals (credentials in URL, punycode, raw IP, unusually complex host), a default hide switch with a visible count and reversibility, and explicit wording that this is not a factual truth check. Sample classifier checks pass. Multi-engine aggregation is still unimplemented: Bing Web Search APIs were retired; Brave Search API requires a separate key/quota and does not consume ChatGPT tokens. Asked Alberto which engine integration to use; his reply asked whether free APIs consume tokens, so provider selection remains open. Do not claim multi-engine support or verified fake-news detection. No remote publication.
- Alberto explicitly declined Brave and asked for an API key with a no-card quota. Any uncommitted Brave integration was discarded. Tavily documentation states 1,000 free credits/month without card and basic search uses 1 credit. Added optional Tavily integration: user enters/removes `tvly-` key locally; separate explicit button per search; default remains DuckDuckGo only; one basic Tavily request with 10 results, no auto parameters/deep answer/raw content/retry, 20 local attempts/day and 3-second throttle; local merge/dedupe and same ad/URL filters. Mocked background handler verified no request on key save, exactly one on explicit search, throttle and removal. No real API key is in source or test; live Tavily search and Windows runtime UI remain unverified. API key is stored in the local browser profile, so a person with profile filesystem access can retrieve it. No remote publication.
- Alberto raised the Tavily daily limit to 33 and requested an increase control. Default now 33; Smart Search accepts a manual local daily limit from 1 to 1000 and reports daily and calendar-month counters. A separate conservative local calendar-month cap of 1000 attempts guards the published free-credit quantity; Tavily's actual billing period/quota is authoritative and may differ. Mocked test confirmed 33 default, saving 65, rejecting 1001, and one explicit call increments daily/monthly counters. No remote publication or real API test.
- Alberto requested a per-result fake-site button and exclusion from later searches. Added a local domain blocklist with “Segna come fake · escludi sito”, immediate hide, future candidate filtering before deep reads, subdomain coverage, and a remove control that does not automatically consume Tavily credit. Mocked add/filter/count/subdomain/remove check and product gate passed. This is a user judgment, not verified fake classification; Windows rendering remains untested. No remote publication.
- Alberto requires an in-depth functional audit and fixes before even proposing a local build. Follow-up audit found Tor lost-bootstrap state was wrongly displayed OFF because `get-status` conflated saved ownership with process readiness. Fixed sidebar error/warning and stop affordance; expanded mode privacy readbacks and made GHOST WebRTC policy explicit. All JS/JSON syntax, product gate, diff hygiene, and mocked mode-health drift cases pass. Windows runtime gate, Tor process-exit recovery, actual page rendering/search and live Tavily remain outstanding. No build proposal or remote publication until these are verified; see functional audit.
- Second audit: Tor restore paths now retain state on proxy/DNS failure and validate SOCKS on repeat start; mode switch commits after settings and rolls back thrown failures; effective mismatch returns `ok=false` with sidebar warning; manual HTTPS-only survives mode changes; GHOST cleanup is time-bounded and retryable; Tavily day counter uses local calendar time. Focused `scripts/audit-functional.cjs` covers GHOST, Tor restore failures, mode rollback/readback, HTTPS override, quota date, and blocklist. Product/syntax/diff gates pass. No Windows native test, build, publication, or live API call. Review the second conflict audit before deciding on release.
- Independent review supplied by Alberto found Tor recovery at startup could re-enable WebRTC after a failed proxy/DNS restore. Fixed and added mocked startup regression check. Documented fail-closed WebRTC setter during mode changes and tested rollback on setter failure. GHOST rollback after completed cleanup now records a session-restarted warning. Source/schema checks passed; Windows runtime and build remain outstanding. No publication.
- Further audit found Tor start swallowed WebRTC setter errors and persisted ON without effective readback. Added proxy/DNS/WebRTC readback as an activation gate and as the sidebar Tor-routing condition; failed rollback preserves prior settings for retry. Mocked success/mismatch/failure/retry pass. Windows runtime and network egress still unverified; do not propose a build yet.
- Whole-codebase regression pass after Alberto requested rigorous tests: diagnostics now shares the main Tor verdict; Smart Search redirect decode and superseded-search paid-request race fixed; Tor bootstrap displayed as AVVIO rather than unexpected; mode/DNS/Tor commands serialized and network controls locked during bootstrap; GHOST host cap removed, writes serialized and errors surfaced; Library/Addons errors visible. Added `scripts/audit-wiring.py`, expanded functional state tests, and made both tests mandatory in the Windows build workflow. Asset reconstruction/checksum pass. See whole-codebase audit for remaining native/runtime blockers. No build or remote publication.

## 2026-09-25 validated Windows checkpoint

- Branch `fix/tor-first-bootstrap`, complete source commit `0ceb64348c178a2073f326678de0bbcc557a82c7` passed native Windows build and strict runtime smoke in run #116 (`36191598652`). Three GHOST → NORMAL cycles and all mode readbacks passed; Tor reached 100%, used SOCKS5 with remote DNS, kept WebRTC off after mode change, and returned `IsTor=true` at Tor Project's API. Final artifact ID `10888797730`, inner ZIP SHA-256 `ab9e648226b2bde4b3d988a623c9faf7565773073572f77cbf012dfeed55c08f`. See `releases/FILUM_WINDOWS_X64_RUN_116.md` for exact provenance, audit scope and remaining user-machine checks.
- The Actions artifact expires 2026-10-25. A permanent GitHub Release asset for this exact binary has not yet been created. Do not call it durably archived until the release exists and its downloaded ZIP hash is checked. The full project source remains at the exact Git commit above. User-machine visual and network checks remain open.
