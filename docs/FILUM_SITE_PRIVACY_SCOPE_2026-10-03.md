# FILUM per-site privacy controls

## Scope and resolution

Site overrides are keyed by the exact HTTP(S) origin: scheme, host and port.
Paths and query strings do not create separate records; sibling subdomains and
alternate ports remain separate. This matches Gecko's principal/permission
boundary and avoids widening an exception to an eTLD+1.

Resolution order is:

1. Non-negotiable Tor hard constraints.
2. Exact-origin site override where Gecko has a verified native permission.
3. Manual global feature override.
4. Global protection preset.
5. Current mode default.

The UI shows requested, source, effective and verified values. It reports
`PASS` only after Gecko readback. A site-level preset can request a different
value for global-only features, but the effective value remains global and is
reported `UNSUPPORTED`; the UI never presents those as working per-site
switches.

## Controls

| Control | Granularity implemented | Evidence shown |
|---|---|---|
| Protection level | Exact origin; native exceptions only where available | Gecko permission readback per supported feature |
| Canvas/RFP | Exact-origin Gecko permission follows a site level's duration; standalone Canvas-only exception is temporary; blocked while Tor is active | `canvas` permission and RFP state |
| Tracking protection | Exact-origin Gecko `trackingprotection` allow permission | Gecko permission readback |
| JavaScript, WebGL, WebRTC, cookies | Global preference or mode-scoped; no fabricated per-site exception | `UNSUPPORTED` when a site preset differs |
| Ads/malware Smart Toggle | Per-tab/domain DNR session rule | Independent from privacy presets |

The contextual popup opens only when the user presses the current-site control.
FILUM does not claim to identify every blocked request or feature, so it does
not issue speculative prompts. A central manager lists, searches, and removes
site overrides and can restore all sites to the global policy.

## Persistence and Tor

Persistent records live in the FILUM profile's `storage.local`. Temporary
records use `storage.session` and Gecko `EXPIRE_SESSION` permissions, so they
expire with the browser session. Tor activation removes FILUM-managed Canvas
allow permissions before Tor starts, refuses activation if an unmanaged Gecko
Canvas allow permission exists, and restores FILUM-managed exceptions after
Tor stops. Site presets do not change the global mode or global policy.

This feature does not manage Firefox private-window or non-default container
overrides; those tabs are excluded so permission origin attributes are not
collapsed across containers. The FILUM `PRIVATE` protection mode remains
supported. Runtime Windows validation is
still needed for Gecko permission behavior and the contextual popup; static
tests alone do not establish a browser runtime pass. Controls without a native
origin permission are `UNKNOWN` as site-specific capabilities. No verified site-level exception
exists for JavaScript, WebGL, WebRTC, or cookies.
