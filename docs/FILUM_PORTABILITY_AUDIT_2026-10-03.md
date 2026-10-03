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
- Windows runtime and move test: pending. The launcher and profile relocation are not declared verified until the Windows workflow succeeds.

## Boundaries

The portable profile is used when starting `Start-FILUM.cmd`. Direct execution of the bundled `browser.exe` bypasses this launcher and may use Gecko's normal Windows profile paths. The host snapshot covers conventional Mozilla/Firefox/Browser/FILUM paths and named registry/service/task entries; it does not claim exhaustive observation of every possible Windows write. Any residual reported by the runner must be classified before calling the package fully portable.
