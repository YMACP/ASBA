import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024
W = S * 4
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons_v2")
os.makedirs(OUT, exist_ok=True)

# Colors
BG = (246, 241, 230)
ACCENT = (194, 102, 63)
TEXT = (47, 42, 34)
DARK = (60, 55, 50)

def rounded_mask(radius_ratio=0.22):
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    r = int(W * radius_ratio)
    d.rounded_rectangle([0, 0, W - 1, W - 1], radius=r, fill=255)
    return m

def finish(img, mask):
    out = Image.new("RGBA", (W, W), BG + (255,))
    out.alpha_composite(img)
    out.putalpha(mask)
    return out.resize((S, S), Image.LANCZOS)

# 1. THE SHIELD (Safety Focus)
def concept_shield():
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Shield shape
    pts = [
        (W*0.2, W*0.2), (W*0.8, W*0.2), 
        (W*0.8, W*0.5), (W*0.5, W*0.8), (W*0.2, W*0.5)
    ]
    d.polygon(pts, fill=BG, outline=TEXT, width=int(W*0.04))
    # Lock symbol
    cx, cy = W*0.5, W*0.45
    d.rectangle([cx-W*0.15, cy-W*0.1, cx+W*0.15, cy+W*0.2], fill=TEXT)
    d.arc([cx-W*0.15, cy-W*0.25, cx+W*0.15, cy+W*0.05], 180, 0, fill=TEXT, width=int(W*0.04))
    return finish(img, rounded_mask())

# 2. THE NODE/FOCUS (Research Focus)
def concept_node():
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Constellation
    nodes = [(W*0.3, W*0.7), (W*0.5, W*0.3), (W*0.7, W*0.7), (W*0.5, W*0.55)]
    lines = [(nodes[0], nodes[3]), (nodes[1], nodes[3]), (nodes[2], nodes[3])]
    for l in lines:
        d.line(l, fill=DARK, width=int(W*0.03))
    for n in nodes:
        d.ellipse([n[0]-W*0.04, n[1]-W*0.04, n[0]+W*0.04, n[1]+W*0.04], fill=ACCENT, outline=TEXT, width=int(W*0.01))
    return finish(img, rounded_mask())

# 3. THE ANALYTIC EYE (Frontier/Insight Focus)
def concept_eye():
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Lens shape
    d.arc([W*0.2, W*0.2, W*0.8, W*0.8], 0, 360, fill=TEXT, width=int(W*0.04))
    # Focus point
    d.ellipse([W*0.4, W*0.4, W*0.6, W*0.6], fill=ACCENT)
    # Grid lines
    d.line([W*0.5, W*0.25, W*0.5, W*0.75], fill=TEXT, width=int(W*0.02))
    d.line([W*0.25, W*0.5, W*0.75, W*0.5], fill=TEXT, width=int(W*0.02))
    return finish(img, rounded_mask())

if __name__ == "__main__":
    c1 = concept_shield()
    c2 = concept_node()
    c3 = concept_eye()
    c1.save(os.path.join(OUT, "1_shield.png"))
    c2.save(os.path.join(OUT, "2_node.png"))
    c3.save(os.path.join(OUT, "3_eye.png"))
    print("Rendered 3 concepts")
