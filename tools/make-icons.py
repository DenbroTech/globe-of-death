"""Make every app icon / splash file from one square artwork.
Usage (repo root): python tools/make-icons.py art/app-icon-source.png
Android shows the launcher icon and the startup splash through a CIRCLE mask that only shows the middle
~2/3, so the artwork is scaled down to sit inside that circle, over a blurred, darkened copy of itself
(no hard edges if a launcher shows a little more)."""
import sys
from PIL import Image, ImageFilter, ImageDraw

src = Image.open(sys.argv[1]).convert('RGB')
W = 1024
full = src.resize((W, W), Image.LANCZOS)

def framed(scale, blur=40, dim=0.55):
    bg = full.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * dim))
    S = int(W * scale)
    bg.paste(full.resize((S, S), Image.LANCZOS), ((W - S) // 2, (W - S) // 2))
    return bg

M = 'mobile/assets/'
# legacy / Play store icon: the full artwork, square
full.save(M + 'icon.png')
full.resize((512, 512), Image.LANCZOS).save('store/icon-512.png')
full.resize((48, 48), Image.LANCZOS).save(M + 'favicon.png')
for n, s in [('icon-192', 192), ('icon-512', 512), ('apple-touch-icon', 180)]:
    full.resize((s, s), Image.LANCZOS).save(f'public/{n}.png')
# adaptive icon: background = blurred art, foreground = art inside the safe circle (66% of the canvas)
SAFE = 0.64
full.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * 0.55)).save(M + 'android-icon-background.png')
fg = Image.new('RGBA', (W, W), (0, 0, 0, 0))
S = int(W * SAFE)
fg.paste(full.resize((S, S), Image.LANCZOS), ((W - S) // 2, (W - S) // 2))
fg.save(M + 'android-icon-foreground.png')
lum = full.resize((S, S), Image.LANCZOS).convert('L').point(lambda v: max(0, min(255, int((v - 70) * 2.2))))
mono = Image.new('RGBA', (W, W), (0, 0, 0, 0))
wm = Image.new('RGBA', (S, S), (255, 255, 255, 255))
wm.putalpha(lum)
mono.paste(wm, ((W - S) // 2, (W - S) // 2))
mono.save(M + 'android-icon-monochrome.png')
# splash: Android 12+ masks it to the middle 2/3 circle too, so same layout as the adaptive icon
framed(SAFE).save(M + 'splash-icon.png')

# preview: what a circle launcher and the splash show
c = Image.new('L', (W, W), 0)
ImageDraw.Draw(c).ellipse((int(W * 0.17),) * 2 + (int(W * 0.83),) * 2, fill=255)
p = framed(SAFE).convert('RGBA')
p.putalpha(c)
out = Image.new('RGB', (W, W), (7, 6, 10))
out.paste(p, (0, 0), p)
out.crop((int(W * 0.15),) * 2 + (int(W * 0.85),) * 2).save('/tmp/icon-preview.png')
print('done')
