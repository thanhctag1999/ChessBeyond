#!/usr/bin/env python3
"""Rebuild game.html from editable sources and local assets (Python standard library only).
Run from any folder: python3 /path/to/Chess-Beyond/source/build.py
"""
from pathlib import Path
import argparse
import base64
import json
import re

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parent

def build(output: Path) -> None:
    assets_dir = ROOT / 'assets'
    if not assets_dir.is_dir():
        raise FileNotFoundError(f'Missing assets directory: {assets_dir}')
    assets: dict[str, str] = {}
    for path in sorted(assets_dir.iterdir()):
        if path.suffix.lower() not in ('.png', '.webp'):
            continue
        mime = 'image/png' if path.suffix.lower() == '.png' else 'image/webp'
        assets[path.stem] = 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
    html = (SOURCE / 'template.html').read_text(encoding='utf-8')
    def replace_asset(match: re.Match) -> str:
        name = Path(match.group(1)).stem
        if name not in assets:
            raise ValueError(f'Asset referenced by template does not exist: {name}')
        return assets[name]
    html = re.sub(r'@asset:([^@]+)@', replace_asset, html)
    def browser_source(filename: str) -> str:
        code = (SOURCE / filename).read_text(encoding='utf-8')
        return re.sub(r"^if\(typeof module[^\n]+", '', code, flags=re.MULTILINE)
    replacements = {
        '/* @CORE@ */': browser_source('engine.js'),
        '/* @AI@ */': browser_source('ai.js'),
        '/* @ASSETS@ */': json.dumps(assets, separators=(',', ':')),
        '/* @APP@ */': (SOURCE / 'app.js').read_text(encoding='utf-8'),
    }
    for marker, content in replacements.items():
        if html.count(marker) != 1:
            raise ValueError(f'Expected exactly one template marker: {marker}')
        html = html.replace(marker, content)
    if '@asset:' in html:
        raise ValueError('Unresolved asset marker in output')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding='utf-8')
    print(f'Created {output}: {output.stat().st_size:,} bytes; {len(assets)} embedded images.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'game.html', help='Output HTML path')
    args = parser.parse_args()
    try:
        build(args.output.resolve())
    except (OSError, ValueError) as error:
        raise SystemExit(f'Build failed: {error}') from error
