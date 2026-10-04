# FILUM contextual protection events — 2026-10-04

## Repository baseline

- Requested baseline: `a5c524f7313e7e05a4a767da43673a0dd83dc711`.
- The isolated worktree's starting tree was `216a8d97f39bb654cc18fd2540aa6197cde0469f`, matching the requested baseline tree recorded in recovery. The live `git ls-remote` recheck failed because the configured network proxy was unreachable.
- The existing per-origin Policy Engine, site popup, override manager, diagnostics, and Tor guards are preserved.

## Mechanism review

| Mechanism studied | Usable? | Finding |
|---|---|---|
| Firefox `webRequest.onErrorOccurred` | Yes, for Firefox content-classifier blocks | Firefox reports classifier-specific errors including tracking, malware, phishing, fingerprinting, cryptomining, unwanted, harmful, and generic blocked URI. The listener is informational and requires `webRequest` plus matching host permission. FILUM already has `<all_urls>` host access. |
| DNR `onRuleMatchedDebug` / `getMatchedRules` | No, not as a production signal in the pinned Gecko build | The pinned Gecko extension schema does not expose these debug methods as a supported production event. Firefox documents the feedback preference as debugging/test support. DNR cancellation cannot safely be attributed to FILUM from a generic request error. |
| Gecko chrome content-blocking progress events | No, not from this WebExtension | The browser chrome receives native content-blocking state flags, but this extension has no supported WebExtension bridge to those privileged browser UI events. |
| SitePermissions / PermissionManager | No, as event detection | These APIs can read/write supported per-origin permissions; they do not notify FILUM that a content request was blocked. The existing per-origin editor remains the action surface. |
| `browser.notifications` and click handler | Yes, as contextual UX | A generic system notification can be shown when an exact Gecko classifier error is observed; click opens the existing site-protection window. The operating-system notification contains no site or request hostname. |
| Firefox `browserAction` / tab badge | Not selected | It would require a persistent toolbar affordance and an additional action surface. A notification better matches the requirement to signal without opening the sidebar. |
| NoScript / uBlock request handling | Not reusable for FILUM's independent static DNR matches | Those extensions can signal decisions made by their own request engines. Their UI/state does not expose another extension's DNR match. No third-party filtering code was copied. |

## Implemented path

- Observe only exact Firefox classifier block errors in `webRequest.onErrorOccurred`; ignore generic network failures and unknown error strings.
- Limit attribution to subrequests in the top frame, exact HTTP(S) origin, a matching current tab, and the default non-private container. Ignore blocked main-frame navigations and subframes whose attribution could be misleading.
- Notify once per `tab + exact origin + event class` per 90 seconds. State is in memory only and stale tab/origin notifications are cleared.
- The OS notification omits the origin. Clicking it revalidates the same tab and exact origin and opens the existing `site-protection.html`, passing the verified class for an explanatory message.
- Existing Policy Engine/Tor checks remain the only way to change protection. The notification cannot bypass a Tor hard constraint.

## Known scope limit

Firefox's pinned Gecko build does not expose FILUM's static Ads/URLhaus DNR rule-match event to this production extension. Therefore this signal does not claim to report those DNR blocks. Nor does it claim to identify global JavaScript, Canvas, WebGL, WebRTC, cookie, or WASM preference effects when Gecko emits no reliable per-origin event. These cases remain silent rather than speculative.

## Verification state

- Added `scripts/audit-protection-events.cjs` for classifier-code mapping, origin/tab isolation, cooldown, unknown-error suppression, notification click routing, stale-tab rejection, and cleanup.
- Added a Windows Marionette runtime step that raises FILUM's tracking policy to its strict preset in the temporary profile, opens Mozilla's tracking-protection test page, and requires an actual Gecko classifier block to produce the expected extension notification. It restores the previous policy and closes the test tab in `finally`.
- Local syntax, functional, per-site policy, product, and wiring checks passed after the focused changes.
- The mock-backed test proves routing and policy logic; it is not a real Gecko classifier event test.
- Windows runtime/CI has not yet run in this environment. The Marionette test validates a real classifier event and generated notification but cannot exercise a human click on the operating-system notification; click routing remains covered by the mocked callback test until a real Windows click-through is performed.
- Decisive manual test for the Windows candidate: open Mozilla's Firefox Tracking Protection test page at `https://www.itisatrap.org/firefox/its-a-tracker.html`, confirm FILUM shows the notification without opening its sidebar, click it, verify the page names that exact origin and tracking event, change the level, and confirm only that origin changes. This test was not performed here.
- No release was created or published.
