import argparse
import json
import shutil
from pathlib import Path

MARKER = "/* MATRIXNEO23 Browser fork */"

def copy_tree(src: Path, dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.rglob("*"):
        rel = item.relative_to(src)
        target = dst / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)

def patch_extensions_mozbuild(path: Path):
    text = path.read_text(encoding="utf-8")
    if '"browser-core"' in text:
        return
    needle = 'DIRS += ['
    start = text.find(needle)
    if start < 0:
        raise RuntimeError("DIRS list not found in browser/extensions/moz.build")
    end = text.find("]", start)
    if end < 0:
        raise RuntimeError("DIRS list end not found")
    text = text[:end] + '    "browser-core",\n' + text[end:]
    path.write_text(text, encoding="utf-8")

def patch_browser_chrome(path: Path, project: Path):
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        return
    chrome_css = (project / "fork" / "browser-chrome.css").read_text(encoding="utf-8")
    text += "\n" + MARKER + "\n" + chrome_css + "\n"
    path.write_text(text, encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--firefox-source", required=True)
    parser.add_argument("--project-root", default=None)
    parser.add_argument("--mozconfig", default="fork/mozconfig.win64")
    args = parser.parse_args()

    firefox = Path(args.firefox_source).resolve()
    project = Path(args.project_root).resolve() if args.project_root else Path(__file__).resolve().parents[1]

    upstream = json.loads((project / "fork" / "UPSTREAM.json").read_text(encoding="utf-8"))

    branding_base = firefox / "browser" / "branding" / "browser"
    if branding_base.exists():
        shutil.rmtree(branding_base)
    shutil.copytree(firefox / "browser" / "branding" / "unofficial", branding_base)
    copy_tree(project / "fork" / "branding", branding_base)

    core = firefox / "browser" / "extensions" / "browser-core"
    if core.exists():
        shutil.rmtree(core)
    (core / "extension").mkdir(parents=True, exist_ok=True)
    copy_tree(project / "extension", core / "extension")

    (core / "moz.build").write_text('JAR_MANIFESTS += ["jar.mn"]\n', encoding="utf-8")
    (core / "jar.mn").write_text(
        "browser.jar:\n"
        "    builtin-addons/browser-core/ (extension/**)\n",
        encoding="utf-8",
    )

    patch_extensions_mozbuild(firefox / "browser" / "extensions" / "moz.build")
    patch_browser_chrome(
        firefox / "browser" / "themes" / "shared" / "toolbarbuttons.css",
        project,
    )

    shutil.copy2(project / args.mozconfig, firefox / "mozconfig")

    print(f"Applied Browser fork overlay to {firefox}")
    print(f"Pinned upstream: {upstream['commit']}")

if __name__ == "__main__":
    main()
