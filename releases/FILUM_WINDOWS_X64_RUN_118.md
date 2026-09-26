# FILUM Windows x64 — build #118, security review open

## Immutable build identity

- Repository: `MATRIXNEO23/browser`; source branch: `fix/tor-first-bootstrap`.
- Exact source commit: `77a1c1f65db6aeb9e9757d10e44a42d590b4ebce`.
- Source tree: `073f949680f82fb310238f84e43e628f44951e0b`.
- Pinned Firefox upstream: `effb626ff45cbaa0bd3a4bbabc66fe2eb2380338` (`fork/UPSTREAM.json`).
- GitHub Actions workflow `build-windows-browser-fork`, run [#118](https://github.com/MATRIXNEO23/browser/actions/runs/36208276499): build and Windows smoke succeeded; built-in release job was skipped by its explicit `if: false`.
- Final Actions artifact: `Browser-Windows-x64-final`, ID `10894398075`. Its downloadable wrapper SHA-256 is `8d62890d04e3ac845db34a67690c36fc16bd2adb1b1570002dea428d853e6e0d`.
- Inner `Browser-Windows-x64.zip` SHA-256: `78f2160d1014d5da89645b4c73bb414524d3c51e874293c558319fb1b34bc63b`. The bundled `SHA256SUMS.txt` agrees with this value.
- `Browser/browser.exe` SHA-256: `7619adf588c57f40b241bb26938a6317b72f2218d2d63756a1477e2a038451bf`; 729,600 bytes, PE32+ Windows x64. This is byte-identical to the executable in release `fork-3044309` (build #117).

The compiled ZIP is stored as an asset of release `fork-77a1c1f`, pointed at the exact source commit. The Git source archive at that tag is the complete project; this report records the validation and limitations. Do not substitute this report's later documentation commit for the compiled source commit.

## Implementations represented by this build

Build #117 introduced the custom addon lifecycle fix: privileged `AddonManager` operations for enable, disable and uninstall; direction-specific permission checks; state readback; confirmation on removal; and catalog refresh. `scripts/audit-addons.cjs` covers enabled → disabled → enabled → removed. Build #118 carries that code and additionally pins the requested FILUM initial page inside packaged policy and browser defaults to `moz-extension://5db2d283-fbda-489c-9f1f-f77a0a674080/newtab.html`, with a matching WebExtension UUID mapping. The control is profile-sensitive; existing user preferences can still affect startup.

The package also carries the approved FILUM sidebar/new-tab appearance, NORMAL/TURBO/PRIVATE/GHOST modes, DNS and proxy controls, and bundled Tor. See the exact source tree, `docs/ARCHITECTURE.md`, `docs/CANONICAL_PRODUCT_REQUIREMENTS.md`, and `docs/FILUM_FUNCTIONAL_AUDIT_2026-09-25.md` for implementation details.

## Technical validation and limits

- CI source/product gates, native Windows build and smoke job passed. The runtime self-test reported `passed=true`, 41 checks, zero failures: fresh-profile startup resolved to the requested extension page; repeated mode switches and privacy readbacks passed; Tor reached 100%, proxy/DNS/WebRTC checks passed and the Tor exit probe returned `HTTP 200; IsTor=true`.
- Local `scripts/audit-addons.cjs` and `scripts/validate-product.py` passed again while preparing this report.
- The Windows runner is not Alberto's machine. The addon lifecycle audit is a scripted gate; the Windows runtime smoke checks the addon catalog but does not install, disable, re-enable and remove an arbitrary third-party addon in the user's profile. The visual first window and live behavior on the user's network require a separate user-machine check.
- The final executable is modified by `resedit-cli` for FILUM icon and Windows version resources and contains no embedded Authenticode certificate table. Static inspection found Mozilla/Firefox strings and expected `mozglue.dll` import, but static inspection cannot certify it as malware-free.
- On 2026-09-26, Microsoft Defender on Alberto's PC classified copies of `browser.exe` as `Trojan:Win32/Bearfoos.B!ml`. A separate `Trojan:HTML/Redirector.JBA!MTB` alert concerned Firefox's web cache. The user reported a completed scan with no current threats and subsequently restored a browser copy without an immediate repeat alert. The original executable detection remains unexplained. CI smoke tests and hashes establish provenance and function, **not antivirus clearance**. This release is retained for reproducibility and marked as a prerelease pending security review. Do not infer safety from the lack of immediate re-detection.

No file was submitted to Microsoft, no antivirus exclusion was added, and no security fix is claimed here.
