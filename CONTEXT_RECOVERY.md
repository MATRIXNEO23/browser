# FILUM native browser — CONTEXT RECOVERY

Updated: 2026-09-28 (Europe/Rome). This file is the fast recovery index for the native Windows Gecko browser. The Chrome/Edge add-on is a separate project and must not be mixed into this work.

## Engagement rules

- Analyze only repository files and evidence supplied or explicitly linked by Alberto; do not invent code, APIs, files, or behavior.
- Before any code change, map the full transitive file/dependency chain and present the exact file-level plan. Wait for Alberto's explicit approval before writing code.
- Make only surgical changes to necessary lines; preserve unrelated bytes and behavior.
- If required source or test evidence is missing or ambiguous, stop and ask.
- After an approved code step, provide the exact Git checkpoint command and update this recovery file.

## Repository and build source identity

- Repository: `MATRIXNEO23/browser`.
- Native browser branch: `fix/tor-first-bootstrap`. Branch HEAD observed on 2026-09-28: `ad5dce7cb53c6a3d6b5270fc4e438fe27d248c3b`.
- Build workflow: `.github/workflows/build-windows.yml`, workflow name `build-windows-browser-fork`.
- Canonical per-build technical records: [`releases/FILUM_WINDOWS_X64_RUN_117.md`](https://github.com/MATRIXNEO23/browser/blob/fix/tor-first-bootstrap/releases/FILUM_WINDOWS_X64_RUN_117.md) and [`releases/FILUM_WINDOWS_X64_RUN_118.md`](https://github.com/MATRIXNEO23/browser/blob/fix/tor-first-bootstrap/releases/FILUM_WINDOWS_X64_RUN_118.md). Read these before analyzing either build.

| Build | Run | Source branch and commit | Persistent release ZIP SHA-256 |
| --- | --- | --- | --- |
| #117 | [36206348167](https://github.com/MATRIXNEO23/browser/actions/runs/36206348167) | `fix/tor-first-bootstrap`, `3044309c6c72160d0423e76f19a202628285c93d`; tag `fork-3044309` | `13e2b8583026cbf4d7a07cdb378124a9f11aec5db7f1e43d6c77de77bf65d52d` |
| #118 | [36208276499](https://github.com/MATRIXNEO23/browser/actions/runs/36208276499) | `fix/tor-first-bootstrap`, `77a1c1f65db6aeb9e9757d10e44a42d590b4ebce`; tag `fork-77a1c1f` | `78f2160d1014d5da89645b4c73bb414524d3c51e874293c558319fb1b34bc63b` |

Both runs completed successfully. Their Windows build and smoke jobs passed; the normal workflow release job was skipped. The permanent native releases and their checksum assets are documented in the two run manifests above.

## ZIPs stored on `main/releases`

- `releases/FILUM-Windows-x64-117.zip`: Git LFS object, payload size 161,828,205 bytes; LFS SHA-256/OID equals the #117 release ZIP SHA above.
- `releases/FILUM-Windows-x64-118.zip`: Git LFS object, payload size 161,828,383 bytes; LFS SHA-256/OID equals the #118 release ZIP SHA above.
- These are LFS pointer entries in Git; the 134-byte pointer size is not the payload size.

## GitHub Actions artifact references

| Build | Artifact | ID | Wrapper digest | Retention noted by Actions |
| --- | --- | --- | --- | --- |
| #117 | `Browser-Windows-x64-final` | `10893779557` | `sha256:fc6304bdfa49711ef2ff5468e94077c6283bae6c279df6471e3993989f094cf9` | 2026-10-26 UTC |
| #117 | `Browser-Windows-x64` | `10893759480` | `sha256:1d5ae65be335fd4cccd4d3bf74c6b8dc02675b56691e900dc80f3c38353df1c8` | 2026-10-03 UTC |
| #118 | `Browser-Windows-x64-final` | `10894398075` | `sha256:8d62890d04e3ac845db34a67690c36fc16bd2adb1b1570002dea428d853e6e0d` | 2026-10-26 UTC |
| #118 | `Browser-Windows-x64` | `10894372737` | `sha256:13ea4fc93b9018c607a9012a093ded9f8059092066d897da0faf14c4e568a718` | 2026-10-03 UTC |

Action artifact digests are for the downloaded ZIP wrappers. They are not interchangeable with the inner installable ZIP SHA-256 values above or with the SHA-256 of `browser.exe` (`7619adf588c57f40b241bb26938a6317b72f2218d2d63756a1477e2a038451bf`).

## Known differences and evidence limits

- #117 source is commit `3044309...`; #118 source is commit `77a1c1f...`. The run manifests say `browser.exe` is byte-identical, but the complete ZIPs/configurations differ.
- #117 uses `about:newtab` with a profile-generated extension UUID. #118 pins the packaged startup page to `moz-extension://5db2d283-fbda-489c-9f1f-f77a0a674080/newtab.html` with a matching mapping.
- #118's recorded changed files include `distribution/policies.json`, `fork/branding/pref/firefox-branding.js`, `extension/sidebar.js`, and `scripts/validate-product.py`; inspect the exact source commit before relying on those notes.
- User-reported state to investigate: Tor exit appears to be a Tor node; DNS and HTTP-header tests report no leak; WIMIA/WebRTC and location tests report TRUE. These reports have not been independently reproduced in this checkpoint.

## Source map status and next step

- No source code was inspected or changed in creating this file; the complete transitive dependency graph for WebRTC/location settings is not mapped yet.
- The build reports name relevant source files including `extension/sidebar.js`, `extension/experiment-apis/browserControl.js`, `extension/background.js`, `distribution/policies.json`, and the branding preference file. Treat these as file leads, not as a verified call graph.
- Next: at the exact selected source commit (#117 or #118), inspect the repository tree and the concrete files that set Tor/proxy/DNS, WebRTC, geolocation, and Control Center state. Map every direct and transitive link before proposing any code change.
- Do not change code until the file-level plan is shown and Alberto explicitly approves it.