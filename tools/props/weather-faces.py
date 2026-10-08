"""Deterministic instrument faces. Georgia is a reconstruction font, not an original maker's face."""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2] / "public" / "instruments"
ROOT.mkdir(parents=True, exist_ok=True)
FONT = "C:/Windows/Fonts/georgia.ttf"
ink = (42, 40, 33, 255)
paper = (237, 228, 206, 255)

def text(draw, xy, value, size):
    draw.text(xy, value, font=ImageFont.truetype(FONT, size), fill=ink, anchor="mm")

im = Image.new("RGBA", (1024, 1024), paper)
d = ImageDraw.Draw(im)
d.ellipse((12, 12, 1012, 1012), outline=ink, width=7)
for i in range(151):
    angle = math.radians(-135 + i / 150 * 270)
    major = i % 10 == 0
    r0 = 395 if major else 425
    d.line((512 + math.sin(angle)*r0, 512 - math.cos(angle)*r0,
            512 + math.sin(angle)*468, 512 - math.cos(angle)*468), fill=ink, width=5 if major else 2)
    if major:
        text(d, (512 + math.sin(angle)*346, 512 - math.cos(angle)*346), f"{28+i*.02:.1f}", 40)
text(d, (512, 653), "INCHES", 42)
text(d, (512, 711), "BAROMETER", 32)
text(d, (512, 806), "28 — 31", 30)
im.save(ROOT / "barometer.png")

im = Image.new("RGBA", (384, 1536), paper)
d = ImageDraw.Draw(im)
d.rectangle((9, 9, 375, 1527), outline=ink, width=4)
text(d, (192, 92), "THERMOMETER", 32)
text(d, (192, 151), "°F", 54)
for value in range(20, 61):
    y = 1290 - (value-20)/40*990
    major = value % 5 == 0
    d.line((155 if major else 178, y, 216, y), fill=ink, width=4 if major else 2)
    if major:
        text(d, (98, y), str(value), 44)
text(d, (192, 1430), "SHADED AIR", 26)
im.save(ROOT / "thermometer.png")
print(ROOT)
