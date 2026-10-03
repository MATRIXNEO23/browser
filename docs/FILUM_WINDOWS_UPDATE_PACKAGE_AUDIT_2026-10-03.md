# FILUM Windows update and package audit — 2026-10-03

## Result

FILUM uses `distribution/policies.json` to set Gecko's enterprise policy
`DisableAppUpdate: true`. This disables Firefox application updates and their
update UI. Extension updates and Gecko system add-on updates are controlled by
separate policies and remain untouched. The build copies the policy into
`Browser/distribution/policies.json` and checks its values before creating the
ZIP.

The product is currently distributed as a portable ZIP. The build workflow does
not run an installer or register a Windows service or scheduled task. No updater
binary was deleted in this change. The Windows smoke test is still required for
this source checkpoint; the static policy check alone does not prove Gecko's
runtime policy handling.

## Update-related package candidates

The inventory below was taken from `releases/FILUM-Windows-x64-118.zip` and
checked against the packaging workflow and pinned Gecko revision
`effb626ff45cbaa0bd3a4bbabc66fe2eb2380338`.

| Package path | Classification | Dependency / decision | Test and result |
|---|---|---|---|
| `Browser/updater.exe` | `LEGACY_FIREFOX` | Mozilla MAR application updater; not part of browser startup. Retained pending smoke coverage of the new policy and a separate FILUM updater design. | Package policy assertions added; runtime smoke pending. |
| `Browser/updater.ini` | `LEGACY_FIREFOX` | Configuration consumed by Mozilla's updater. Kept paired with `updater.exe`. | Same as above. |
| `Browser/update-settings.ini` | `LEGACY_FIREFOX` | Mozilla updater settings; upstream package manifest includes it under `MOZ_UPDATER`. Kept with updater payload. | Same as above. |
| `Browser/maintenanceservice.exe` | `LEGACY_FIREFOX` | Mozilla Maintenance Service executable for privileged application updates. The portable workflow does not install or register it as a service. Retained in this pass. | Workflow inspection confirms no service-install or task-registration step; runtime smoke pending. |
| `Browser/maintenanceservice_installer.exe` | `LEGACY_FIREFOX` | Installer for Mozilla Maintenance Service; not invoked by the portable ZIP assembly or launch flow. Retained in this pass. | Same as above. |
| `Browser/default-browser-agent.exe` | `OPTIONAL` | Firefox default-browser agent, separate from Gecko runtime and updates. `DisableDefaultBrowserAgent` is already enabled. Not removed in this scope. | Existing package policy. |

The policy reference documents `DisableAppUpdate` for Firefox ESR. `ExtensionUpdate`
controls extension updates and `DisableSystemAddonUpdate` controls Gecko system
add-on updates. FILUM leaves both unset; add-on and system-component security
updates are not disabled by this change.

## Runtime and recovery files preserved

No files were removed. `Browser/omni.ja` (both runtime archives), `Browser/xul.dll`,
NSS libraries, `Browser/application.ini`, `Browser/platform.ini`,
`Browser/precomplete`, `Browser/removed-files`, the Tor executable/data and
FILUM's built-in extension remain untouched. These cover Gecko startup/runtime,
certificate/security, Tor, or package recovery. A broad size-reduction pass is
not justified by this updater task.

## Verification

- Product validation requires `DisableAppUpdate: true` and rejects disabling
  extension or Gecko system add-on updates.
- Windows package assembly checks the copied policy values before ZIP creation.
- Workflow review found no service or scheduled-task registration in the
  portable package path.
- Build and Windows runtime smoke are pending for the combined source checkpoint.
