"""Create ASBA italic wordmark concepts on the current cream background."""
from PIL import Image, ImageDraw, ImageFont
import os

S = 1024
SCALE = 3
N = S * SCALE
BG = (246, 241, 230, 255)
INK = (52, 47, 40, 255)
TERRA = (194, 102, 63, 255)
MUTED = (129, 116, 97, 255)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wordmarks_v1")
os.makedirs(OUT, exist_ok=True)

FONT_DIR = r"C:\Windows\Fonts"


def f(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size * SCALE)


def base():
    im = Image.new("RGBA", (N, N), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, N-1, N-1), radius=round(N*0.21), fill=BG)
    return im


def center_text(draw, text, font, y, fill, anchor="mm", x=None, spacing=0, stroke_width=0, stroke_fill=None):
    if x is None:
        x = N/2
    draw.text((x, y*SCALE), text, font=font, fill=fill, anchor=anchor,
              spacing=spacing*SCALE, stroke_width=stroke_width*SCALE, stroke_fill=stroke_fill)


def width_of(text, font):
    return ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), text, font=font)[2]


def add_rule(draw, y, color=TERRA, span=200, w=3):
    draw.line((N/2-span*SCALE/2, y*SCALE, N/2+span*SCALE/2, y*SCALE), fill=color, width=w*SCALE)


def concept(name, fontfile, size, *, color=INK, letter_spacing=0, subtitle=None,
            mark=None, rule=False, bold=False, extra=None):
    im = base(); d = ImageDraw.Draw(im)
    ft = f(fontfile, size)
    text = "ASBA"
    if letter_spacing:
        total = sum(d.textlength(ch, font=ft) for ch in text) + letter_spacing*SCALE*(len(text)-1)
        x = (N-total)/2
        y = N*0.47
        for ch in text:
            d.text((x, y), ch, font=ft, fill=color, anchor="lm")
            x += d.textlength(ch, font=ft) + letter_spacing*SCALE
    else:
        center_text(d, text, ft, 490, color)
    if rule:
        add_rule(d, 622, TERRA, span=205, w=3)
    if mark == "dot":
        # Editorial marker near the wordmark baseline
        d.ellipse((N*0.755, N*0.435, N*0.790, N*0.470), fill=TERRA)
    elif mark == "underline":
        d.line((N*0.245, N*0.575, N*0.755, N*0.575), fill=TERRA, width=5*SCALE)
    elif mark == "corner":
        # two minimal corner strokes around the type, restrained not a frame
        d.line((N*.245, N*.405, N*.245, N*.455), fill=TERRA, width=4*SCALE)
        d.line((N*.245, N*.405, N*.295, N*.405), fill=TERRA, width=4*SCALE)
        d.line((N*.755, N*.545, N*.755, N*.595), fill=TERRA, width=4*SCALE)
        d.line((N*.705, N*.595, N*.755, N*.595), fill=TERRA, width=4*SCALE)
    if subtitle:
        subfont = f("segoeui.ttf", 22)
        center_text(d, subtitle, subfont, 660, MUTED)
    if extra == "small-caps-line":
        capfont = f("segoesc.ttf", 17)
        center_text(d, "AI RESEARCH ARCHIVE", capfont, 691, MUTED)
    out = os.path.join(OUT, name + ".png")
    im.resize((S, S), Image.Resampling.LANCZOS).save(out)
    return out


def make_sheet(paths, labels):
    # Lay out directly at target resolution so both wordmarks and small-size
    # previews remain readable in the review image.
    w, h = 1900, 1160
    sheet = Image.new("RGBA", (w, h), (36, 33, 29, 255))
    d = ImageDraw.Draw(sheet)
    title_font = ImageFont.truetype(os.path.join(FONT_DIR, "arialbd.ttf"), 28)
    num_font = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 16)
    slots = [(70, 25), (675, 25), (1280, 25), (372, 590), (977, 590)]
    for (path, label), (x, y) in zip(zip(paths, labels), slots):
        icon = Image.open(path).convert("RGBA")
        icon_sm = icon.resize((390, 390), Image.Resampling.LANCZOS)
        sheet.alpha_composite(icon_sm, (x, y))
        d.text((x, y+402), label, font=title_font, fill=(248, 245, 238, 255))
        bx, by = x, y+445
        d.rounded_rectangle((bx, by, bx+390, by+90), radius=16, fill=BG)
        xx = x+18
        for size in (64, 48, 32, 24, 16):
            thumb = icon.resize((size, size), Image.Resampling.LANCZOS)
            sheet.alpha_composite(thumb, (xx, by+8+(56-size)//2))
            d.text((xx, by+65), str(size), font=num_font, fill=(82, 73, 61, 255))
            xx += size+27
    sheet.save(os.path.join(OUT, "contact-sheet.png"))


if __name__ == "__main__":
    variants = [
        ("01-editorial-serif", "georgiai.ttf", 158, dict(color=INK, letter_spacing=5, subtitle="RESEARCH ARCHIVE", mark="dot")),
        ("02-literary-italic", "BOOKOSI.TTF", 166, dict(color=INK, letter_spacing=4, rule=True, subtitle="AI RESEARCH")),
        ("03-modern-humanist", "corbeli.ttf", 175, dict(color=INK, letter_spacing=7, subtitle="", mark="underline")),
        ("04-classic-contrast", "timesi.ttf", 185, dict(color=INK, letter_spacing=11, mark="corner", extra="small-caps-line")),
        ("05-warm-display", "ROCKI.TTF", 170, dict(color=TERRA, letter_spacing=5, subtitle="AI · RESEARCH · ARCHIVE")),
    ]
    paths, labels = [], []
    for filename, fontfile, size, opts in variants:
        paths.append(concept(filename, fontfile, size, **opts))
        labels.append(filename.replace("-", " ").replace("_", " ").title())
    make_sheet(paths, labels)
    print("Rendered five ASBA italic wordmark directions to", OUT)
