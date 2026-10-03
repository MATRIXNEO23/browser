# FILUM native Firefox app menu audit — 2026-10-03

## Surface inspected

The target is Firefox's native app menu (`#appMenu-popup` / `#appMenu-mainView`), not the FILUM sidebar. Its pinned Gecko markup is `browser/base/content/appmenu-viewcache.inc.xhtml` at upstream commit `effb626ff45cbaa0bd3a4bbabc66fe2eb2380338`.

## Item classification

| Classification | Native menu items | Decision |
|---|---|---|
| Useful | New tab/window/private window; bookmarks; history; downloads; passwords; extensions and themes; settings; help; quit | Keep visible. These are core browser tasks and remain reachable in the Firefox menu. |
| Technical/advanced | Print; save page; find; translate; zoom/fullscreen; More Tools | Keep available. They are not replaced by FILUM privacy controls. |
| Unavailable product-specific variants | New AI window; new classic window; chats history | Hide these three controls in the native app menu because FILUM does not expose or support the AI-window workflow. |
| Account/sync and recovery | Firefox account, profile, session restore, recently closed tabs/windows | Preserve. They may carry user data or recovery functions. |
| Firefox app updater | Update banner and native update controls | `DisableAppUpdate` policy disables the mechanism/UI; the standalone updater payload is removed from FILUM's final package. |

The app-menu verification runs against the actual `#appMenu-popup` in Windows
smoke. It confirms the three unsupported AI entries are hidden and checks that
tab/window, bookmarks, history, downloads, passwords, add-ons, settings, more,
and help commands remain visible. It does not count the FILUM sidebar as proof
of a native menu change.

No settings page or FILUM sidebar controls were changed in this menu pass. The native Firefox Settings entry remains available.

## Implementation and proof

- `fork/browser-chrome.css` hides only the three unsupported native AI-related menu entries.
- `scripts/apply-fork-overlay.py` checks the exact pinned Gecko app-menu IDs at build time and fails if the source changes or a preserved core command is targeted by the FILUM stylesheet.
- The native chrome self-test opens Firefox's actual app menu, reads computed visibility for those three entries, and confirms the core browser commands remain visible. The Windows smoke gate requires this native-menu assertion to report PASS.
- Local verification: Python syntax, injected native controller JavaScript syntax, product completeness gate, native menu source-guard positive/negative fixture, portable-launcher product gate, workflow YAML parse and `git diff --check` pass.
- Runtime result: pending the next Windows CI run. Until that smoke passes, this change is not considered runtime-verified.

## Limits

This is a focused simplification of unsupported AI-only choices. It does not re-label or replace Firefox Settings, hide general browser tools, or claim that all native Firefox UI has been simplified.
