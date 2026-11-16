"""Five restrained ASBA icon directions for review; no app files are changed."""
from PIL import Image, ImageDraw
import os

S = 1024
SCALE = 3
N = S * SCALE
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons_v3")
os.makedirs(OUT, exist_ok=True)

CREAM = (246, 241, 230, 255)
PAPER = (255, 252, 245, 255)
PAPER_SHADE = (231, 220, 200, 255)
INK = (52, 47, 40, 255)
MID = (117, 105, 88, 255)
TERRA = (194, 102, 63, 255)
TERRA_PALE = (228, 173, 143, 255)


def xy(p):
    return tuple(round(v * SCALE) for v in p)


def width(v):
    return max(1, round(v * SCALE))


def rounded_canvas():
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, N - 1, N - 1), radius=round(N * 0.22), fill=CREAM)
    return im


def line(d, points, fill=INK, w=24, joint="curve"):
    d.line([xy(p) for p in points], fill=fill, width=width(w), joint=joint)


def outline_round(d, box, radius, fill=None, outline=INK, w=20):
    b = tuple(round(v * SCALE) for v in box)
    d.rounded_rectangle(b, radius=width(radius), fill=fill, outline=outline, width=width(w))


def save(im, filename):
    im = im.resize((S, S), Image.Resampling.LANCZOS)
    path = os.path.join(OUT, filename)
    im.save(path)
    print(path)


def icon_archive():
    """Editorial archive: a small stack of filed research notes and a tab."""
    im = rounded_canvas(); d = ImageDraw.Draw(im)
    # Back sheets, deliberately offset and quiet
    outline_round(d, (278, 250, 735, 746), 30, fill=(238, 230, 215, 255), outline=INK, w=20)
    outline_round(d, (238, 218, 695, 714), 30, fill=PAPER, outline=INK, w=22)
    # Top page and binding edge
    d.rounded_rectangle((xy((315, 218)), xy((695, 714))), radius=width(24), fill=PAPER)
    line(d, [(315, 272), (315, 660)], fill=TERRA, w=16)
    # Tab
    d.rounded_rectangle((xy((500, 218)), xy((653, 270))), radius=width(12), fill=TERRA)
    # Text lines
    for y, x2 in [(350, 620), (416, 584), (482, 620), (548, 570), (614, 610)]:
        line(d, [(375, y), (x2, y)], fill=(143, 130, 110, 255), w=13)
    # Small pinned index dot
    d.ellipse((xy((352, 330)), xy((368, 346))), fill=TERRA)
    return im


def icon_open_book():
    """An open book drawn as two clear pages with a terracotta center seam."""
    im = rounded_canvas(); d = ImageDraw.Draw(im)
    # Outer cover silhouette
    points = [(222, 312), (365, 282), (510, 320), (659, 282), (802, 312), (802, 704), (660, 666), (510, 708), (365, 666), (222, 704)]
    d.polygon([xy(p) for p in points], fill=PAPER, outline=INK)
    line(d, points + [points[0]], fill=INK, w=22)
    # Page folds
    line(d, [(510, 320), (510, 708)], fill=TERRA, w=20)
    line(d, [(262, 375), (372, 354), (470, 379)], fill=PAPER_SHADE, w=14)
    line(d, [(262, 445), (372, 424), (470, 448)], fill=PAPER_SHADE, w=14)
    line(d, [(262, 515), (372, 494), (470, 518)], fill=PAPER_SHADE, w=14)
    line(d, [(550, 379), (650, 354), (762, 375)], fill=PAPER_SHADE, w=14)
    line(d, [(550, 448), (650, 424), (762, 445)], fill=PAPER_SHADE, w=14)
    line(d, [(550, 518), (650, 494), (762, 515)], fill=PAPER_SHADE, w=14)
    return im


def icon_index_cards():
    """A curated index: three catalog cards converging on one selected entry."""
    im = rounded_canvas(); d = ImageDraw.Draw(im)
    # Three cards, layered but geometric and calm
    outline_round(d, (252, 270, 678, 710), 28, fill=(239, 231, 216, 255), outline=INK, w=20)
    outline_round(d, (302, 238, 728, 678), 28, fill=(250, 247, 239, 255), outline=INK, w=20)
    outline_round(d, (350, 206, 772, 646), 28, fill=PAPER, outline=INK, w=22)
    # Selected card's index band
    d.rounded_rectangle((xy((350, 206)), xy((772, 294))), radius=width(26), fill=TERRA)
    d.rectangle((xy((350, 260)), xy((772, 294))), fill=TERRA)
    # Accent index square and short metadata lines
    d.rounded_rectangle((xy((397, 342)), xy((463, 408))), radius=width(12), fill=(234, 216, 196, 255))
    d.ellipse((xy((419, 364)), xy((441, 386))), fill=TERRA)
    line(d, [(493, 358), (718, 358)], fill=INK, w=14)
    line(d, [(493, 397), (675, 397)], fill=MID, w=12)
    line(d, [(397, 462), (718, 462)], fill=(160, 146, 124, 255), w=13)
    line(d, [(397, 516), (690, 516)], fill=(160, 146, 124, 255), w=13)
    line(d, [(397, 570), (636, 570)], fill=(160, 146, 124, 255), w=13)
    return im


def icon_research_path():
    """A measured path through a field of notes: research progression, not circuitry."""
    im = rounded_canvas(); d = ImageDraw.Draw(im)
    # Subtle editorial field of small reference marks
    for x, y in [(295, 322), (700, 326), (290, 650), (721, 644), (370, 238), (644, 748)]:
        d.ellipse((xy((x-7, y-7)), xy((x+7, y+7))), fill=PAPER_SHADE)
    # Journey line bends through three checkpoints
    line(d, [(284, 650), (420, 650), (420, 514), (603, 514), (603, 378), (744, 378)], fill=INK, w=22)
    # Checkpoint rings
    for x, y in [(284, 650), (420, 514), (603, 378), (744, 378)]:
        d.ellipse((xy((x-28, y-28)), xy((x+28, y+28))), fill=CREAM, outline=INK, width=width(18))
        d.ellipse((xy((x-9, y-9)), xy((x+9, y+9))), fill=TERRA)
    # Destination marker as a quiet bookmark flag
    d.polygon([xy((744, 342)), xy((804, 342)), xy((804, 430)), xy((774, 409)), xy((744, 430))], fill=TERRA)
    return im


def icon_focus_frame():
    """A reading frame around one highlighted passage, symbolizing careful review."""
    im = rounded_canvas(); d = ImageDraw.Draw(im)
    # Open corner frame, avoiding crosshair/weapon associations
    w = 24
    line(d, [(300, 382), (300, 282), (400, 282)], fill=INK, w=w)
    line(d, [(624, 282), (724, 282), (724, 382)], fill=INK, w=w)
    line(d, [(300, 642), (300, 742), (400, 742)], fill=INK, w=w)
    line(d, [(624, 742), (724, 742), (724, 642)], fill=INK, w=w)
    # Page-like selected excerpt
    outline_round(d, (377, 342, 648, 682), 20, fill=PAPER, outline=(143, 130, 110, 255), w=14)
    line(d, [(420, 408), (602, 408)], fill=TERRA, w=18)
    line(d, [(420, 474), (598, 474)], fill=(156, 143, 122, 255), w=13)
    line(d, [(420, 528), (570, 528)], fill=(156, 143, 122, 255), w=13)
    line(d, [(420, 582), (590, 582)], fill=(156, 143, 122, 255), w=13)
    return im


def contact_sheet(items):
    cw, ch = 1900, 1260
    sheet = Image.new("RGBA", (cw, ch), (32, 30, 26, 255))
    d = ImageDraw.Draw(sheet)
    try:
        from PIL import ImageFont
        title_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)
        small_font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
    except Exception:
        title_font = small_font = None

    # 3 top and 2 bottom, with separate icon, title and small-size preview bands.
    slots = [(70, 35), (665, 35), (1260, 35), (365, 625), (960, 625)]
    icon_size = 400
    for (label, image), (x, y) in zip(items, slots):
        preview = image.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (x, y))
        if title_font:
            d.text((x, y + icon_size + 12), label, fill=(245, 242, 235, 255), font=title_font)
        band_y = y + icon_size + 54
        d.rounded_rectangle((x, band_y, x + icon_size, band_y + 92), radius=16, fill=(246, 241, 230, 255))
        xx = x + 18
        for size in (64, 48, 32, 24, 16):
            thumb = image.resize((size, size), Image.Resampling.LANCZOS)
            ty = band_y + 8 + (60 - size) // 2
            sheet.alpha_composite(thumb, (xx, ty))
            if small_font:
                d.text((xx, band_y + 67), str(size), fill=(77, 68, 56, 255), font=small_font)
            xx += size + 28
    sheet.save(os.path.join(OUT, "contact-sheet.png"))


if __name__ == "__main__":
    items = [
        ("01  Archive", icon_archive()),
        ("02  Open Book", icon_open_book()),
        ("03  Index Cards", icon_index_cards()),
        ("04  Research Path", icon_research_path()),
        ("05  Focus Frame", icon_focus_frame()),
    ]
    for i, (label, image) in enumerate(items, 1):
        save(image, f"{i:02d}-{label.lower().replace(' ', '-')}.png")
    contact_sheet(items)
