#!/usr/bin/env python3
"""Probe bundled Tor with its actual argv and preserve early stderr/stdout."""

import argparse
from collections import deque
from pathlib import Path
import subprocess
import tempfile
import threading
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    parser.add_argument("--seconds", type=int, default=55)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="filum-tor-probe-") as data_dir:
        argv = [
            str(args.executable),
            "--SocksPort", "127.0.0.1:19051",
            "--DataDirectory", data_dir,
            "--ClientOnly", "1",
            "--SafeSocks", "1",
            "--TestSocks", "1",
            "--AvoidDiskWrites", "1",
            "--Log", "notice stdout",
        ]
        root = args.executable.parent.parent
        for name, option in (("geoip", "--GeoIPFile"), ("geoip6", "--GeoIPv6File")):
            file = root / "data" / name
            if file.exists():
                argv.extend((option, str(file)))

        start = time.monotonic()
        lines = deque(maxlen=24)
        ready = threading.Event()
        proc = subprocess.Popen(
            argv,
            cwd=args.executable.parent,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

        def collect():
            for line in proc.stdout:
                lines.append(line.rstrip())
                if "Bootstrapped 100%" in line:
                    ready.set()

        reader = threading.Thread(target=collect, daemon=True)
        reader.start()
        try:
            while time.monotonic() - start < args.seconds:
                if proc.poll() is not None or ready.is_set():
                    break
                time.sleep(0.25)
            print(
                "TOR runner probe:",
                f"elapsed={time.monotonic() - start:.1f}s",
                f"running={proc.poll() is None}",
                f"bootstrapped={ready.is_set()}",
                f"exitCode={proc.poll()}",
                flush=True,
            )
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
            reader.join(timeout=2)
            print("TOR runner output (last lines):", flush=True)
            for line in lines:
                print(line, flush=True)


if __name__ == "__main__":
    main()
