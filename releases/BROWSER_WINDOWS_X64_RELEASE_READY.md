# Browser Windows x64 — release-ready manifest

Status: VALIDATED / RELEASE PUBLICATION BLOCKED BY GITHUB ACTIONS TOKEN PERMISSION

## Validated build

- Source build run: 36079879226
- Smoke/promote run: 36080563841
- Source commit: cfe51552d1adda1f7f153186660d47b6154d0299
- Final artifact name: Browser-Windows-x64-final
- Final payload: Browser-Windows-x64.zip
- Final payload size: 161760622 bytes
- SHA-256: 0898d1015007420dd97759dbe0241027b436475ab5ef04400eed4fe9782b3091

## Gates passed

- Product completeness gate
- Native Windows build
- Package assembly
- Windows identity: ProductName=Browser
- Windows identity: FileDescription=Browser
- Windows identity: CompanyName=MATRIXNEO23
- FILUM icon post-processing
- Built-in Browser core verification
- Bundled Tor executable verification
- Browser runtime launch smoke
- Browser profile initialization smoke

## Release publication blocker

The GitHub Actions release step failed after all validation gates passed because the workflow token received:

`HTTP 403: Resource not accessible by integration`

This is a repository/workflow permission issue affecting only creation of the GitHub Release entry. It is not a browser build or smoke-test failure.

## Canonical repository state

All source code, build pipeline, TOR integration, UI, branding assets and validation logic are persisted in `MATRIXNEO23/browser`.
