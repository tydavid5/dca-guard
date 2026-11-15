from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 900
BG = (11, 11, 13)
PANEL = (20, 20, 23)
AMBER = (245, 165, 36)
CREAM = (245, 245, 240)
MUTED = (154, 154, 163)
RED = (255, 90, 90)

bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
reg_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(size, bold=True):
    return ImageFont.truetype(bold_path if bold else reg_path, size)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

d.rectangle([0, 0, W, 10], fill=AMBER)
d.text((80, 60), "QORECHAIN TESTNET  |  QORECHAIN-DIANA  |  EVM CHAIN 9800", font=font(28), fill=AMBER)
d.text((80, 130), "DCA GUARD", font=font(130), fill=CREAM)
d.text((80, 300), "Buys only inside the limits. Outside them, it pauses.", font=font(36, bold=False), fill=MUTED)

shield = [(1335, 130), (1520, 200), (1520, 400), (1335, 500), (1150, 400), (1150, 200)]
d.polygon(shield, outline=AMBER, width=10)
d.text((1200, 290), "PAUSE", font=font(56), fill=AMBER)

cards = [
    ("MAX BUY", "25 fUSD"),
    ("TOTAL CAP", "100 fUSD"),
    ("WINDOW", "24 HOURS"),
    ("STATUS", "ACTIVE"),
]
x = 80
for label, value in cards:
    d.rounded_rectangle([x, 560, x + 330, 760], radius=18, fill=PANEL, outline=AMBER, width=3)
    d.text((x + 28, 590), label, font=font(26), fill=MUTED)
    d.text((x + 28, 640), value, font=font(48), fill=AMBER if label != "STATUS" else CREAM)
    x += 360

d.text((80, 810), "DEMO MODE: NO CHAIN TRANSACTION IS SENT", font=font(28), fill=RED)

img.save("featured.png", "PNG")
print("saved featured.png", img.size)
