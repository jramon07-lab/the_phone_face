"""Collect review candidates from CRM source; presence is never a passing test."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/crm-audit/source-inventory.json'
files = [ROOT / 'index.html', ROOT / 'movil/index.html']
for folder in ['js', 'api', 'lib', 'supabase/functions', 'tests/e2e']:
    files += sorted((ROOT / folder).rglob('*.js'))
    files += sorted((ROOT / folder).rglob('*.ts'))
files = [p for p in files if p.exists() and 'vendor' not in p.parts]
patterns = {
    'views': r'data-view=[\"\']([^\"\']+)',
    'actions': r'data-action=[\"\']([^\"\']+)',
    'rpcs': r'\.rpc\(\s*[\"\']([^\"\']+)',
    'tables': r'\.from\(\s*[\"\']([^\"\']+)',
    'modules': r'\.register\(\s*[\"\']([^\"\']+)',
    'api_actions': r'\baction\s*===?\s*[\"\']([^\"\']+)',
    'tests': r'\btest\(\s*[\"\']([^\"\']+)',
}
result = {'schema': 1, 'scope': 'Static candidates requiring review, not coverage or proof of passing', 'files': []}
for p in sorted(set(files)):
    text = p.read_text()
    row = {'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(text.encode()).hexdigest()}
    for key, pattern in patterns.items():
        values = sorted(set(re.findall(pattern, text)))
        if values:
            row[key] = values
    controls = []
    for match in re.finditer(r'<(button|input|select|textarea|form|a)\b([^>]+)>', text, re.I):
        attrs = dict(re.findall(r'\b(id|data-action|data-view|data-sheet|type|onclick)=[\"\']([^\"\']*)', match.group(2)))
        if attrs:
            # Event source is represented by its function name, never its values.
            if 'onclick' in attrs:
                attrs['onclick'] = re.split(r'\(|;', attrs['onclick'])[0][:100]
            controls.append({'tag': match.group(1).lower(), **attrs})
    if controls:
        row['controls'] = controls
    result['files'].append(row)
result['summary'] = {'files': len(result['files']), 'control_candidates': sum(len(x.get('controls', [])) for x in result['files'])}
for key in patterns:
    result['summary'][key] = len({v for x in result['files'] for v in x.get(key, [])})
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result['summary'], ensure_ascii=False))
