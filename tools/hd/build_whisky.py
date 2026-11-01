"""Encode the supplied, unchanged bottle PNGs for the web; no crop or resize.
Placement uses the source manifest's frame in an SVG viewBox at runtime.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-src/whisky-v1'
OUT = ROOT / 'demo/img/whisky'

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for info in json.loads((SOURCE / 'manifest.json').read_text()).values():
        path = SOURCE / Path(info['file']).name
        with Image.open(path) as im:
            assert im.mode == 'RGBA' and im.size == (info['width'], info['height'])
            im.save(OUT / (path.stem + '.webp'), 'WEBP', quality=94, method=6)
    print('Encoded two full-resolution transparent bottle assets')
