#!/usr/bin/env python3
"""Check cross-file references that a JS syntax check cannot validate."""
from pathlib import Path
import json
import re
import sys

root = Path(__file__).resolve().parents[1] / 'extension'
errors = []

for html in root.glob('*.html'):
    markup = html.read_text(encoding='utf-8')
    ids = set(re.findall(r'\bid=["\']([^"\']+)["\']', markup))
    for resource in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', markup):
        if resource.endswith(('.js', '.css')) and not (html.parent / resource).is_file():
            errors.append(f'{html.name}: missing resource {resource}')
    script = html.with_suffix('.js')
    if script.exists():
        code = script.read_text(encoding='utf-8')
        referenced = set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', code))
        referenced.update(re.findall(r'querySelector\(["\']#([^"\']+)["\']\)', code))
        for missing in sorted(referenced - ids):
            errors.append(f'{script.name}: #{missing} absent from {html.name}')

manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
for script in manifest['background']['scripts']:
    if not (root / script).is_file():
        errors.append(f'manifest: missing background script {script}')
for ruleset in manifest['declarative_net_request']['rule_resources']:
    if not (root / ruleset['path']).is_file():
        errors.append(f'manifest: missing ruleset {ruleset["path"]}')
for html in [manifest['chrome_url_overrides']['newtab']]:
    if not (root / html).is_file():
        errors.append(f'manifest: missing override {html}')

schema = json.loads((root / 'experiment-apis/browserControl.json').read_text(encoding='utf-8'))
declared = {item['name'] for item in schema[0]['functions']}
api = (root / 'experiment-apis/browserControl.js').read_text(encoding='utf-8')
implemented = set(re.findall(r'^\s+async (\w+)\(', api, re.MULTILINE)) & declared
used = set()
for script in root.glob('*.js'):
    used.update(re.findall(r'browser\.browserControl\??\.(\w+)\b', script.read_text(encoding='utf-8')))
for name in sorted(used - declared):
    errors.append(f'undeclared browserControl API: {name}')
for name in sorted(declared - implemented):
    errors.append(f'unimplemented browserControl API: {name}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    raise SystemExit(1)
print(f'WIRING GATE PASSED: {len(list(root.glob("*.html")))} views; {len(declared)} privileged APIs')
