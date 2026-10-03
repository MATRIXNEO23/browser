# FILUM site-level privacy controls — 2026-10-03

## Verified scope

FILUM must describe a control as site-specific only when Gecko applies it to
the relevant origin or tab. Existing controls are not evidence that every
privacy preference has per-site scope.

| Control | Scope verified | Current conclusion |
|---|---|---|
| Ads/malware Smart Toggle | DNR session rule scoped to current tab and initiator domain | Per-tab/domain. It does not change Tor or Gecko privacy preferences. |
| Tracking protection | Gecko has an origin permission/allow-list path for `trackingprotection`; private-browsing entries can be session-scoped | Native per-site exception exists. FILUM should retain the native shield/site-permission route; do not label a global pref as a per-site toggle. |
| JavaScript | Current FILUM setting changes `javascript.enabled` | Global preference. No verified site permission API wired by FILUM. |
| Canvas / RFP | Current mode changes Gecko fingerprinting preferences | Global/mode scope. No verified site-level exception wired by FILUM. |
| WebGL | Current mode changes Gecko preferences | Global/mode scope. No verified site-level exception wired by FILUM. |
| WebRTC | Current mode changes Gecko preferences | Global/mode scope. No verified site-level exception wired by FILUM. |
| Cookies | FILUM hardening changes `network.cookie.cookieBehavior` | Global preference. Per-origin cookie permission support in the pinned build has not been verified here; classify as `UNKNOWN`, do not promise per-site control. |

## UI and product decision

Keep independent preferences independently configurable in the FILUM controls,
but label them as browser-wide or mode-scoped unless Gecko provides a verified
origin permission. Preserve native Firefox site-permission surfaces for the
permissions Gecko already supports. Do not add a custom per-site JavaScript,
Canvas, WebGL, WebRTC, or cookie toggle based only on a preference name.

## Evidence and limits

- The pinned source audit found Gecko's `ContentBlockingAllowList` permission
  path for tracking-protection exceptions.
- The extension schemas in the pinned checkout do not provide a general
  `contentSettings` API that could transparently turn global preferences into
  site-specific ones.
- Runtime confirmation of the native tracking-protection shield remains part
  of the Windows UI smoke; no new per-site controls are claimed by this change.
