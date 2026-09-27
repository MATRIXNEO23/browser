# Audit and integration record: Controllo WebRTC.crx

## Source

- User-provided file: `Controllo WebRTC.crx`
- SHA-256: `490e8957c66294b2b0e2d3fa8e2cdfecc07212f9ca56c64b909ac8adfc4630e1`
- Manifest version: `1.2.0`, Manifest V3
- Static inspection only; no browser installation or network behavior was executed.

## Mode behavior found in the CRX

`background.js` stores the selected mode as `webrtc_mode` in `chrome.storage.local` and applies it at install/startup:

| Source mode | Source implementation | Meaning |
| --- | --- | --- |
| `off` (shown as Default) | Clears `chrome.privacy.network.webRTCIPHandlingPolicy` | Leaves Chrome's normal WebRTC policy in control. |
| `partial` (shown as Balanced protection) | Sets `disable_non_proxied_udp` | Prevents WebRTC from using non-proxied UDP paths; behavior depends on the browser's proxy/network configuration. |
| `full` (shown as Strict protection) | Registers `inject-webrtc-block.js` at `document_start` in the page's MAIN world | Replaces WebRTC peer-connection APIs and rejects `getUserMedia`; can break calling and peer-to-peer functions. |

The original popup reloads the active tab after applying a mode. It also includes rate prompts, support/review links, a welcome page, an uninstall feedback URL, and a DNS-test promotion. FILUM does not import those popup and promotion paths.

## FILUM implementation

- `chromium-extension/popup.html` and `popup.js` provide adjacent Default / Medium / Full buttons in the FILUM panel. Selection state is read from the worker and marked using `aria-pressed` and `.active`.
- `chromium-extension/worker.js` validates modes, uses `chrome.privacy.network.webRTCIPHandlingPolicy` for Default/Medium, checks that Medium took control, registers or unregisters the Full script, stores the selection as `filumWebRTCMode`, restores it after browser startup/extension update, and reloads the active tab when a mode changes.
- `chromium-extension/webrtc-full-block.js` is the reviewed Full-mode script. It runs in the page's main world, blocks the WebRTC constructors and media APIs, and also attempts to block peer-connection methods on the original prototypes. It runs in all matching frames. Browser-internal pages and Chrome Web Store restrictions still apply.
- `chromium-extension/manifest.json` adds the `privacy` permission. `scripting` and `<all_urls>` were already present for existing FILUM features.

## Limits

- Default removes FILUM's own WebRTC policy and leaves Chrome or another extension/policy in control; it does not force every other owner back to a specific value.
- Medium and Full alter browser-wide WebRTC behavior for the regular profile, rather than only one tab. Full can interrupt calls, streaming and P2P. Incognito behavior depends on the browser's extension setting and was not separately enabled or verified.
- A green/selected button confirms FILUM's stored mode, not that every website is protected from all IP leaks. Real Chrome/Edge Windows verification remains outstanding.
