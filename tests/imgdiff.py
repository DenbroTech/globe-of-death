"""Pixel diff for tests/parity.mjs output: python3 tests/imgdiff.py tests/out/parity"""
import json, sys, os
from PIL import Image, ImageChops

d = sys.argv[1]
rows = json.load(open(os.path.join(d, 'pairs.json')))
worst = 0
for r in rows:
    a = Image.open(r['a']).convert('RGB'); b = Image.open(r['b']).convert('RGB')
    diff = ImageChops.difference(a, b)
    px = sum(1 for p in diff.getdata() if max(p) > 8)
    total = a.size[0] * a.size[1]
    worst = max(worst, px / total)
    bbox = diff.getbbox()
    print(f"{r['name']:<16} differing px (>8/255): {px:6d} ({100*px/total:5.2f}%)  bbox={bbox}")
    if px:
        diff.point(lambda v: min(255, v * 8)).save(os.path.join(d, r['name'] + '-diff.png'))
print('worst %.3f%%' % (100 * worst))
