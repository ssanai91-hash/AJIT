"""Package source art and landmark data. No cropping, drawing or face warping:
the SVG renderer applies the recorded transforms and masks at runtime.
Run from any working directory. Requires Pillow (as do the existing art tools).
"""
from pathlib import Path
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-src/rig-v2'
OUT = ROOT / 'demo/img/rig-v2'

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    registration = json.loads((SOURCE / 'registration.json').read_text())
    data = {}
    for n, record in registration.items():
        r = {k: record[k] for k in ['width', 'height', 'waist', 'landmarks']}
        r['poses'] = {'rest': {'file': f'bust{n}.webp', 'width': r['width'], 'height': r['height']}}
        for pose, points in record['poses'].items():
            path = SOURCE / f'c{n}_{pose}.webp'
            with Image.open(path) as im:
                assert im.mode == 'RGBA', path
                width, height = im.size
            shutil.copyfile(path, OUT / path.name)
            r['poses'][pose] = {'file': f'rig-v2/{path.name}', 'width': width, 'height': height, 'landmarks': points}
        r['expressions'] = {}
        for emo, info in record['expressions'].items():
            source = ROOT / f'art-src/work/cells/{record["who"]}_{emo}.png'
            dest = OUT / f'c{n}_{emo}.webp'
            # Only encode the existing full source cell; the cream background
            # stays outside the renderer's facial-feature mask.
            with Image.open(source) as im:
                width, height = im.size
                im.save(dest, 'WEBP', quality=92, method=6)
            ox, oy = info['origin']
            r['expressions'][emo] = {'file': f'rig-v2/{dest.name}', 'width': width, 'height': height,
                'landmarks': [[x-ox, y-oy] for x, y in info['points']]}
        data[n] = r
    (ROOT / 'demo/rig-data.js').write_text('window.AJIT_RIG_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('built registered poses and 27 facial-feature layers')

if __name__ == '__main__':
    build()
