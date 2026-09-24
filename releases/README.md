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
