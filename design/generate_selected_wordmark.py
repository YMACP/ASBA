from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wordmarks_v1", "03-modern-humanist.png")
BUILD = os.path.join(ROOT, "build")
ASSETS = os.path.join(ROOT, "src", "renderer", "assets")
os.makedirs(BUILD, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)

# Generate a compact square app icon from selected style: warm cream tile,
# italic humanist ASBA wordmark, terracotta underline.
S = 1024
BG = (246, 241, 230, 255)
INK = (52, 47, 40, 255)
TERRA = (194, 102, 63, 255)
FONT_DIR = r"C:\Windows\Fonts"

# Windows app icon: keep the full background square and use a robust, readable
# wordmark scale so it survives downsampling to 16/24/32 px.
im = Image.new("RGBA", (S, S), BG)
d = ImageDraw.Draw(im)
font = ImageFont.truetype(os.path.join(FONT_DIR, "corbeli.ttf"), 250)
text = "ASBA"
bbox = d.textbbox((0, 0), text, font=font)
w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
x = (S - w) / 2 - bbox[0]
y = 420 - (h / 2) - bbox[1]
d.text((x, y), text, font=font, fill=INK)
# Clean signature underline, sized for legibility at small icon sizes.
d.rounded_rectangle((252, 588, 772, 602), radius=7, fill=TERRA)

# Store the large master PNG and multi-size ICO.
master_path = os.path.join(BUILD, "icon-master.png")
im.save(master_path)
icon_path = os.path.join(BUILD, "icon.ico")
im.save(icon_path, format="ICO", sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(24,24),(16,16)])

# Renderer: horizontal wordmark lockup, generated at 3x for clean display.
W, H = 960, 220
scale = 3
lockup = Image.new("RGBA", (W*scale, H*scale), (0,0,0,0))
d = ImageDraw.Draw(lockup)
font = ImageFont.truetype(os.path.join(FONT_DIR, "corbeli.ttf"), 112*scale)
text = "ASBA"
bbox = d.textbbox((0,0), text, font=font)
text_h = bbox[3]-bbox[1]
x = 0
baseline_y = 110*scale
# anchor=ls gives a stable alphabetic baseline; compensate font bbox top.
d.text((x, baseline_y), text, font=font, fill=INK, anchor="ls")
# Determine advance for subtitle alignment.
advance = d.textlength(text, font=font)
# A compact terracotta dash under the wordmark, visually derived from variant 03.
d.rounded_rectangle((0, 145*scale, int(advance*0.82), 151*scale), radius=3*scale, fill=TERRA)
# Keep padding around the rendering for reliable cropping.
alpha = lockup.getchannel("A")
box = alpha.getbbox()
if box:
    lockup = lockup.crop((max(0,box[0]-5*scale), max(0,box[1]-5*scale), min(lockup.width,box[2]+5*scale), min(lockup.height,box[3]+5*scale)))
lockup = lockup.resize((lockup.width//scale, lockup.height//scale), Image.Resampling.LANCZOS)
wordmark_path = os.path.join(ASSETS, "asba-wordmark.png")
lockup.save(wordmark_path)

# A 1024px transparent desktop preview of the selected treatment.
preview = Image.new("RGBA", (S,S), BG)
word = Image.open(wordmark_path).convert("RGBA")
word.thumbnail((760, 260), Image.Resampling.LANCZOS)
preview.alpha_composite(word, ((S-word.width)//2, (S-word.height)//2))
preview.save(os.path.join(BUILD, "icon-preview.png"))

print(icon_path)
print(wordmark_path)
print(master_path)
