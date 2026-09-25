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
