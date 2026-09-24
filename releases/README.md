# Build persistence policy

Every Windows browser build that is considered deliverable must be persisted in this repository in two ways:

1. source/configuration committed on `main`;
2. compiled ZIP published as a GitHub Release asset for the exact commit.

Workflow artifacts are temporary and are not considered canonical delivery storage.

## Release contents

Each persistent build release contains:

- `Browser-Windows-x64.zip`
- `SHA256SUMS.txt`

Release tag format:

`build-<short commit sha>`

The release points to the exact source commit used to produce the binary.

## Rule

A build is not considered delivered until the corresponding GitHub Release exists successfully.


## Native fork rule

Legacy tags named `build-*` are wrapper/prototype builds and are superseded.

Canonical Browser releases use:

`fork-<short commit sha>`

A native fork release is valid only if CI verifies that the package contains `browser.exe`. A package containing only `firefox.exe` must fail and must not be published as a Browser release.
