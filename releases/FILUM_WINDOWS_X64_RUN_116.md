# FILUM Windows x64 — validated build #116

## Identity and download

- Source repository: `MATRIXNEO23/browser`
- Branch: `fix/tor-first-bootstrap`
- Complete source commit: `0ceb64348c178a2073f326678de0bbcc557a82c7`
- Source tree: `7d10ecf8cd5a3ccce73574712bed10c6309abf2f`
- Workflow: `build-windows-browser-fork`, run `36191598652`, attempt 1, **success**
- Windows build job `108257765850`: success
- Windows runtime smoke job `108261344177`: success
- Final Actions artifact: `Browser-Windows-x64-final`, ID `10888797730`
- Artifact URL: https://github.com/MATRIXNEO23/browser/actions/runs/36191598652/artifacts/10888797730
- Artifact wrapper SHA-256: `0001e52bfd2dfeb6add2c58606a3127885644b43983720e0a4970777cdc79dab`
- Inner `Browser-Windows-x64.zip` SHA-256: `ab9e648226b2bde4b3d988a623c9faf7565773073572f77cbf012dfeed55c08f`
- The artifact also contains `SHA256SUMS.txt` for the inner ZIP.
- Actions retention expires on 2026-10-25 at 21:40 UTC. This file preserves provenance, not the binary bytes.

## Audit evidence

The source completeness gate passed syntax, product, wiring, functional mock and native toolbar checks. The native build and the Windows smoke both passed. The runtime report was `passed=true` for all checks, including:

- Thirteen mode selections covering three GHOST → NORMAL exits, with effective preference and privacy API readback and no mode-health issues.
- ADS toggle, HTTPS-only, custom and Cloudflare DNS, site appearance, browser theme, hardware acceleration and RAM command.
- Direct, system/VPN and custom SOCKS5 proxy setting and readback.
- Bundled Tor bootstrap to 100% in 13.983 seconds; SOCKS5 `127.0.0.1:19050`, `proxyDNS=true`, WebRTC disabled after a mode switch, Tor Project API `HTTP 200; IsTor=true`, and successful proxy restoration after stop.
- New-tab resource and launch destinations for Smart Search, addons, Library, diagnostics, preferences, privacy, passwords, profiles and processes.
- Windows executable identity, built-in core registration and bundled Tor executable.

The smoke runs in a headless Windows GitHub runner. It does not establish visual appearance of the first normal window or the F button on the user's display, behavior on the user's network, live Tavily with a user key, or that visited fake/ad sites are factually classified. Those require separate user-machine checks. The GHOST cleanup mock exercises a visited hostname, Firefox's rejection of `since` with `localStorage`, and retry on cleanup failure; the Windows smoke changes modes but does not visit a site during GHOST.

## Reproduction and provenance

The complete project source is the Git tree at the source commit above. The workflow pins the Firefox upstream revision in `fork/UPSTREAM.json`, applies the project overlay and packages the Windows build. Read `.github/workflows/build-windows.yml`, `docs/ARCHITECTURE.md`, `docs/CANONICAL_PRODUCT_REQUIREMENTS.md`, and `docs/FILUM_FUNCTIONAL_AUDIT_2026-09-25.md` for build, design and audit context. Do not use a later branch HEAD as a substitute for the exact source commit.
