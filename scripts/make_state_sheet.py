from PIL import Image, ImageDraw, ImageFont
import os

files = [("idle", "pg-idle.png"), ("blink", "pg-blink.png"), ("happy", "pg-happy.png"),
         ("drink", "pg-drink.png"), ("eat", "pg-eat.png"), ("angry", "pg-angry.png")]
BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\docs"
F = r"C:\Windows\Fonts\msyh.ttc"
f = ImageFont.truetype(F, 22)

cells = []
for name, fn in files:
    p = os.path.join(os.environ["TEMP"], fn)
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB")
    w, h = im.size
    box = (int(w * 0.24), int(h * 0.26), int(w * 0.76), int(h * 0.52))
    im = im.crop(box).resize((240, 240), Image.LANCZOS)
    cells.append((name, im))

cols = 3
rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 256, rows * 286), (250, 251, 250))
d = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(cells):
    r, c = divmod(i, cols)
    sheet.paste(im, (c * 256 + 8, r * 286 + 36))
    d.text((c * 256 + 10, r * 286 + 8), n, font=f, fill=(20, 60, 40))

out = os.path.join(BASE, "pet-frames-live.png")
sheet.save(out, optimize=True)
print("ok", sheet.size)
