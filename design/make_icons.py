"""Generate ASBA icon concepts (review copies only; not embedded)."""
import math
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

S = 1024
SS = 4
W = S * SS
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def grad_stops(stops, t):
    t = min(max(t, 0.0), 1.0)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if p0 <= t <= p1:
            k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
            return lerp(c0, c1, k)
    return stops[-1][1]


def vertical_gradient(stops):
    samples = np.array([grad_stops(stops, t) for t in np.linspace(0.0, 1.0, 512)], dtype=np.uint8)
    idx = (np.linspace(0.0, 1.0, W) * 511).astype(np.int32)
    column = samples[idx]
    arr = np.repeat(column[:, None, :], W, axis=1)
    return Image.fromarray(arr, "RGBA")


def rounded_mask(radius_ratio=0.225):
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    r = int(W * radius_ratio)
    d.rounded_rectangle([0, 0, W - 1, W - 1], radius=r, fill=255)
    return m


def radial_glow(cx, cy, r, color, alpha=255, blur=0.45):
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(r * blur))


def stroke_glow(base, pts, color, width, glow_alpha=170, glow_scale=1.1):
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.line(pts, fill=color + (255,), width=width, joint="curve")
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=color + (255,))
    glow = layer.filter(ImageFilter.GaussianBlur(width * glow_scale))
    if glow_alpha:
        a = glow.getchannel("A").point(lambda v: int(v * glow_alpha / 255))
        glow.putalpha(a)
        base.alpha_composite(glow)
    base.alpha_composite(layer)


def linear_gradient(c0, c1, angle_deg):
    """Smooth full-canvas linear gradient (RGBA)."""
    a = math.radians(angle_deg)
    xs = np.linspace(-1.0, 1.0, W, dtype=np.float32)
    ys = np.linspace(-1.0, 1.0, W, dtype=np.float32)
    t = np.add.outer(ys * math.sin(a), xs * math.cos(a))
    t = (t - t.min()) / (t.max() - t.min())
    r = (c0[0] + (c1[0] - c0[0]) * t).astype(np.uint8)
    g = (c0[1] + (c1[1] - c0[1]) * t).astype(np.uint8)
    b = (c0[2] + (c1[2] - c0[2]) * t).astype(np.uint8)
    alpha = np.full_like(r, 255, dtype=np.uint8)
    return Image.fromarray(np.dstack([r, g, b, alpha]), "RGBA")


def gradient_stroke(base, pts, c0, c1, width, glow=True, glow_alpha=200, angle=None):
    mask = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(mask)
    d.line(pts, fill=255, width=width, joint="curve")
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=255)
    if angle is None:
        ang = math.degrees(math.atan2(pts[-1][1] - pts[0][1], pts[-1][0] - pts[0][0]))
    else:
        ang = angle
    grad = linear_gradient(c0, c1, ang)
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    layer.paste(grad, (0, 0), mask)
    if glow:
        g = mask.filter(ImageFilter.GaussianBlur(width * 0.85))
        mid = tuple(int((c0[i] + c1[i]) / 2) for i in range(3))
        glow_layer = Image.new("RGBA", (W, W), mid + (0,))
        glow_layer.putalpha(g.point(lambda v: int(v * glow_alpha / 255)))
        base.alpha_composite(glow_layer)
    base.alpha_composite(layer)


def node(base, x, y, r, color, core=(255, 255, 255), glow_alpha=210):
    halo = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(halo)
    d.ellipse([x - r * 3, y - r * 3, x + r * 3, y + r * 3], fill=color + (120,))
    halo = halo.filter(ImageFilter.GaussianBlur(r * 1.6))
    base.alpha_composite(halo)
    d = ImageDraw.Draw(base)
    d.ellipse([x - r, y - r, x + r, y + r], fill=color + (255,))
    d.ellipse([x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45], fill=core + (255,))


def hairline_grid(base, alpha=9, step=96):
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(0, W, step * SS):
        d.line([(x, 0), (x, W)], fill=(255, 255, 255, alpha), width=1)
    for y in range(0, W, step * SS):
        d.line([(0, y), (W, y)], fill=(255, 255, 255, alpha), width=1)
    base.alpha_composite(layer)


def inner_edge(base, radius_ratio=0.225):
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = int(W * radius_ratio)
    d.rounded_rectangle([2, 2, W - 3, W - 3], radius=r, outline=(255, 255, 255, 42), width=5)
    base.alpha_composite(layer)


def finish(img, mask):
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out.alpha_composite(img)
    out.putalpha(mask)
    return out.resize((S, S), Image.LANCZOS)


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, "PNG")
    print("saved", path, img.size)


# ---------------------------------------------------------------- concept A
def concept_neural_a():
    img = vertical_gradient([(0.0, (6, 9, 22, 255)), (0.45, (14, 13, 42, 255)), (1.0, (43, 20, 88, 255))])
    img.alpha_composite(radial_glow(int(W * 0.26), int(W * 0.20), int(W * 0.42), (70, 200, 255), 90))
    img.alpha_composite(radial_glow(int(W * 0.78), int(W * 0.82), int(W * 0.40), (168, 98, 255), 100))
    hairline_grid(img, alpha=8)

    cx = W / 2
    apex = (cx, W * 0.205)
    lf = (W * 0.285, W * 0.800)
    rf = (W * 0.715, W * 0.800)
    bar_y = 0.640
    t_bar = (bar_y - 0.205) / (0.800 - 0.205)
    bar_l = (apex[0] + (lf[0] - apex[0]) * t_bar, W * bar_y)
    bar_r = (apex[0] + (rf[0] - apex[0]) * t_bar, W * bar_y)

    # thin aperture ring
    ring = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    d.arc([W * 0.10, W * 0.10, W * 0.90, W * 0.90], 200, 340, fill=(120, 220, 255, 60), width=int(W * 0.005))
    d.arc([W * 0.10, W * 0.10, W * 0.90, W * 0.90], 20, 160, fill=(180, 130, 255, 60), width=int(W * 0.005))
    img.alpha_composite(ring.filter(ImageFilter.GaussianBlur(W * 0.003)))

    stroke_w = int(W * 0.052)
    gradient_stroke(img, [apex, lf], (94, 231, 255), (120, 140, 255), stroke_w)
    gradient_stroke(img, [apex, rf], (120, 140, 255), (216, 120, 255), stroke_w)
    gradient_stroke(img, [bar_l, bar_r], (120, 210, 255), (190, 130, 255), int(stroke_w * 0.72))

    def on_leg(p0, p1, t):
        return (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)

    pts = [
        (apex, 0.021),
        (on_leg(apex, lf, 0.34), 0.013),
        (on_leg(apex, lf, 0.67), 0.011),
        (on_leg(apex, rf, 0.34), 0.013),
        (on_leg(apex, rf, 0.67), 0.011),
        (bar_l, 0.012),
        (bar_r, 0.012),
        (((bar_l[0] + bar_r[0]) / 2, bar_y * W), 0.010),
    ]
    for i, (p, r) in enumerate(pts):
        node(img, p[0], p[1], W * r, (110, 220, 255) if i % 2 == 0 else (176, 132, 255))

    inner_edge(img)
    return finish(img, rounded_mask())


# ---------------------------------------------------------------- concept B
def concept_prism():
    img = vertical_gradient([(0.0, (7, 11, 24, 255)), (0.55, (11, 18, 40, 255)), (1.0, (18, 14, 44, 255))])
    img.alpha_composite(radial_glow(int(W * 0.5), int(W * 0.62), int(W * 0.46), (70, 160, 255), 80))
    hairline_grid(img, alpha=6)

    layers = [
        (0.760, (86, 220, 255), 0.055),
        (0.620, (140, 130, 255), 0.050),
        (0.480, (255, 178, 107), 0.045),
    ]
    for y, color, lw in layers:
        half = W * (0.30 - (y - 0.48) * 0.10)
        pts = [(W * 0.5 - half, W * y), (W * 0.5, W * (y - 0.22)), (W * 0.5 + half, W * y)]
        stroke_glow(img, pts, color, int(W * lw), glow_alpha=150, glow_scale=1.0)
        # bright inner filament
        stroke_glow(img, pts, (255, 255, 255), int(W * lw * 0.18), glow_alpha=0, glow_scale=0)

    # rising sparks
    sparks = [(0.50, 0.30, 0.012), (0.36, 0.40, 0.008), (0.66, 0.36, 0.009), (0.44, 0.22, 0.006), (0.58, 0.16, 0.007)]
    for xf, yf, r in sparks:
        node(img, W * xf, W * yf, W * r, (120, 210, 255) if xf < 0.5 else (255, 190, 140), glow_alpha=140)

    inner_edge(img)
    return finish(img, rounded_mask())


# ---------------------------------------------------------------- concept C
def concept_ember_a():
    img = vertical_gradient([(0.0, (24, 14, 10, 255)), (0.55, (43, 23, 15, 255)), (1.0, (72, 33, 19, 255))])
    img.alpha_composite(radial_glow(int(W * 0.28), int(W * 0.18), int(W * 0.48), (255, 145, 70), 90))
    img.alpha_composite(radial_glow(int(W * 0.74), int(W * 0.86), int(W * 0.48), (255, 95, 40), 60))
    img.alpha_composite(radial_glow(int(W * 0.50), int(W * 0.50), int(W * 0.30), (255, 190, 120), 40))
    hairline_grid(img, alpha=5, step=110)

    cx = W / 2
    apex = (cx, W * 0.215)
    lf = (W * 0.295, W * 0.795)
    rf = (W * 0.705, W * 0.795)
    bar_l = (W * 0.378, W * 0.638)
    bar_r = (W * 0.622, W * 0.638)

    stroke_w = int(W * 0.055)
    gradient_stroke(img, [apex, lf], (255, 206, 140), (226, 122, 74), stroke_w)
    gradient_stroke(img, [apex, rf], (255, 206, 140), (226, 122, 74), stroke_w)
    gradient_stroke(img, [bar_l, bar_r], (255, 214, 156), (236, 148, 96), int(stroke_w * 0.75))

    # orbit
    ring = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    d.ellipse([W * 0.135, W * 0.245, W * 0.865, W * 0.905], outline=(255, 190, 130, 46), width=int(W * 0.004))
    img.alpha_composite(ring)
    node(img, W * 0.862, W * 0.470, W * 0.016, (255, 190, 120), glow_alpha=170)

    for p, r in [(apex, 0.019), (lf, 0.014), (rf, 0.014), (bar_l, 0.011), (bar_r, 0.011)]:
        node(img, p[0], p[1], W * r, (255, 196, 128), glow_alpha=120)

    inner_edge(img)
    return finish(img, rounded_mask())


def make_contact(images):
    bg = Image.new("RGBA", (1800, 860), (18, 18, 22, 255))
    d = ImageDraw.Draw(bg)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)
        font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
    except Exception:
        font = None
        font_small = None
    for i, (img, label) in enumerate(images):
        x = 60 + i * 580
        bg.alpha_composite(img.resize((460, 460), Image.LANCZOS), (x, 50))
        if font:
            d.text((x, 540), label, fill=(240, 240, 240, 255), font=font)
        # light desktop preview strip
        d.rounded_rectangle([x, 596, x + 460, 760], radius=22, fill=(240, 235, 225, 255))
        sizes = [128, 96, 64, 32, 24, 16]
        xx = x + 22
        for s in sizes:
            small = img.resize((s, s), Image.LANCZOS)
            bg.alpha_composite(small, (xx, 596 + (164 - s) // 2))
            if font_small:
                d.text((xx, 730), str(s), fill=(90, 80, 66, 255), font=font_small)
            xx += s + 14
    path = os.path.join(OUT, "contact-sheet.png")
    bg.save(path, "PNG")
    print("saved", path)


if __name__ == "__main__":
    from PIL import ImageFont
    a = concept_neural_a()
    b = concept_prism()
    c = concept_ember_a()
    save(a, "option-a-neural-a.png")
    save(b, "option-b-prism.png")
    save(c, "option-c-ember-a.png")
    make_contact([(a, "A  Neural A"), (b, "B  Prism Beam"), (c, "C  Ember A")])
