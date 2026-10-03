# FILUM Windows portability audit — 2026-10-03

## Concrete blocker found

The validated #146 archive had no user-facing portable launcher. Its Windows smoke started `browser.exe` with a profile under `%RUNNER_TEMP%`, so that run did not prove package-local profile storage or folder relocation.

## Implementation prepared

- `packaging/Start-FILUM.cmd` derives all paths from `%~dp0`, passes `-no-remote -profile <package>\profile`, and sets `TEMP` and `TMP` to `<package>\temp`.
- `packaging/README-PORTABLE.txt` identifies the supported entry point and warns that launching `browser.exe` directly bypasses the portable profile.
- The Windows build packages both files. The runtime smoke now starts FILUM through the launcher and places a unique user preference in the package-local profile.
- A second Windows step verifies `prefs.js`, `places.sqlite`, and `extensions.json`, removes the test-only self-test switch, moves the package folder A→B, launches FILUM again, and checks that the process uses the moved profile path and retains the sentinel preference.
- After all Windows checks, the workflow removes the temporary smoke profile/temp directory, moves the tested package back to its stage path, rebuilds the downloadable ZIP from that exact Windows-tested folder, and recalculates `SHA256SUMS.txt`. This avoids uploading the earlier pre-smoke archive.
- `scripts/test-portable-host.ps1` compares common Mozilla/Firefox/Browser/FILUM paths under `%APPDATA%`, `%LOCALAPPDATA%`, `%PROGRAMDATA%` and the runner temp directory, relevant Mozilla/Browser/FILUM registry roots, services and scheduled tasks before and after the runtime test. It reports detected external changes for classification.

## Verification status

- Local checks PASS: product gate, overlay Python compilation, workflow YAML parsing, and `git diff --check`.
- CI #147: native Firefox app-menu assertion, startup, and updater absence passed. The first host snapshot correctly exposed Gecko startup artifacts in `%APPDATA%\\Mozilla\\Firefox` (crash-helper log/directories and `Pending Pings`) and per-user Mozilla registry keys; the strict zero-difference gate failed at host audit, so profile A→B and final ZIP recreation did not run.\n- The host audit now classifies only the exact startup artifacts/registry keys observed in #147. CI #149 passed build and menu/updater/runtime smoke, but the host audit found an ephemeral `MozillaBackgroundTask-...-defaultagent` profile with crash/Glean temp folders. Gecko's pinned background-task runtime uses ephemeral profiles, so forced termination in the smoke cleanup may have interrupted its normal cleanup; this is an inference, not yet proven. The workflow now requests a graceful browser close, waits for all Gecko processes and the default-agent ephemeral profile to exit, and fails if cleanup does not complete. No A→B or final ZIP/hash was produced by #149; retest pending.

## Boundaries

The portable profile is used when starting `Start-FILUM.cmd`. Direct execution of the bundled `browser.exe` bypasses this launcher and may use Gecko's normal Windows profile paths. The host snapshot covers conventional Mozilla/Firefox/Browser/FILUM paths and named registry/service/task entries; it does not claim exhaustive observation of every possible Windows write. Any residual reported by the runner must be classified before calling the package fully portable.
