#!/usr/bin/env python3
"""Use a newer self-test in an existing Windows artifact without rebuilding Gecko."""

import argparse
import hashlib
import os
from pathlib import Path
import stat
import tempfile
import zipfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("omni", type=Path)
    parser.add_argument("--baseline-sha256", required=True)
    parser.add_argument("--tor-baseline-sha256", required=True)
    args = parser.parse_args()

    replacements = {
        "chrome/browser/builtin-addons/browser-core/sidebar.js": (
            Path("extension/sidebar.js").read_bytes(), args.baseline_sha256.lower()
        ),
        "chrome/browser/builtin-addons/browser-core/experiment-apis/browserControl.js": (
            Path("extension/experiment-apis/browserControl.js").read_bytes(),
            args.tor_baseline_sha256.lower(),
        ),
    }

    changed = {}
    with zipfile.ZipFile(args.omni) as source:
        for entry, (replacement, baseline_sha) in replacements.items():
            matches = [name for name in source.namelist() if name == entry]
            if len(matches) != 1:
                raise SystemExit(f"Expected exactly one {entry}; found {len(matches)}")
            original = source.read(entry)
            if original == replacement:
                continue
            actual_sha = hashlib.sha256(original).hexdigest()
            if actual_sha != baseline_sha:
                raise SystemExit(
                    f"Artifact hash differs from source run: {entry}; "
                    f"actual={actual_sha}; old={baseline_sha}; "
                    f"current={hashlib.sha256(replacement).hexdigest()}"
                )
            changed[entry] = replacement

    if not changed:
        print("Artifact already contains the current FILUM self-test and TOR code:", args.omni)
        return

    handle, temp_name = tempfile.mkstemp(suffix=".ja", dir=args.omni.parent)
    os.close(handle)
    try:
        with zipfile.ZipFile(args.omni) as source:
            with zipfile.ZipFile(temp_name, "w") as target:
                for info in source.infolist():
                    target.writestr(
                        info,
                        changed[info.filename]
                        if info.filename in changed else source.read(info),
                    )

        with zipfile.ZipFile(temp_name) as verify:
            if (any(verify.read(name) != content for name, content in changed.items())
                    or verify.testzip() is not None):
                raise RuntimeError("Patched archive verification failed")
        args.omni.chmod(args.omni.stat().st_mode | stat.S_IWRITE)
        os.replace(temp_name, args.omni)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)

    print("Patched smoke-only sidebar and TOR diagnostics:", args.omni)
    for name, content in changed.items():
        print(name, "original SHA256:", replacements[name][1],
              "diagnostic SHA256:", hashlib.sha256(content).hexdigest())


if __name__ == "__main__":
    main()
