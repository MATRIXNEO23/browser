#!/usr/bin/env python3
"""Use a newer self-test in an existing Windows artifact without rebuilding Gecko."""

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("omni", type=Path)
    parser.add_argument("--source-sha", required=True)
    args = parser.parse_args()

    entry = "chrome/browser/builtin-addons/browser-core/sidebar.js"
    baseline = subprocess.check_output(
        ["git", "show", f"{args.source_sha}:extension/sidebar.js"]
    )
    replacement = Path("extension/sidebar.js").read_bytes()
    if baseline == replacement:
        raise SystemExit("No newer smoke test to patch")

    with zipfile.ZipFile(args.omni) as source:
        matches = [name for name in source.namelist() if name == entry]
        if len(matches) != 1:
            raise SystemExit(f"Expected exactly one {entry}; found {len(matches)}")
        original = source.read(entry)
        if original != baseline:
            raise SystemExit("Artifact sidebar.js differs from source run; refusing patch")

        handle, temp_name = tempfile.mkstemp(suffix=".ja", dir=args.omni.parent)
        os.close(handle)
        try:
            with zipfile.ZipFile(temp_name, "w") as target:
                for info in source.infolist():
                    target.writestr(
                        info,
                        replacement if info.filename == entry else source.read(info),
                    )
            with zipfile.ZipFile(temp_name) as verify:
                if verify.read(entry) != replacement or verify.testzip() is not None:
                    raise RuntimeError("Patched archive verification failed")
            os.replace(temp_name, args.omni)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    print("Patched smoke-only sidebar.js:", args.omni)
    print("Original SHA256:", hashlib.sha256(original).hexdigest())
    print("Self-test SHA256:", hashlib.sha256(replacement).hexdigest())


if __name__ == "__main__":
    main()
