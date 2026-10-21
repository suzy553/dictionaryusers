#!/usr/bin/env python3
"""生成 App 图标（PWA 需要 192 / 512 / maskable）。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"
ICONS.mkdir(exist_ok=True)

GREEN = (88, 204, 2)
GREEN_D = (70, 163, 2)
WHITE = (255, 255, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for p in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def make(size: int, pad_ratio: float = 0.0) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = int(size * pad_ratio)
    r = int((size - 2 * pad) * 0.24)
    box = [pad, pad, size - pad, size - pad]
    d.rounded_rectangle(box, radius=r, fill=GREEN)
    # 底部阴影条，做出「立体按钮」的牌子感
    d.rounded_rectangle([pad, size - pad - int((size - 2 * pad) * 0.18), size - pad, size - pad],
                        radius=r, fill=GREEN_D)

    f = load_font(int(size * 0.46))
    text = "越"
    tb = d.textbbox((0, 0), text, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((size - tw) / 2 - tb[0], (size - th) / 2 - tb[1] - size * 0.03), text, font=f, fill=WHITE)

    return img


for s in (192, 512):
    make(s).save(ICONS / f"icon-{s}.png")
    print(f"icon-{s}.png")

# maskable：留安全区，避免被圆形裁切
make(512, pad_ratio=0.14).save(ICONS / "icon-512-maskable.png")
print("icon-512-maskable.png")
