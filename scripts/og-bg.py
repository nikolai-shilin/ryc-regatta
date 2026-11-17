#!/usr/bin/env python3
# The share cards' backgrounds (lib/og-bg/*.jpg): crops of the game's own pictures (public/images, taken with
# scripts/shots.mjs), 1200 × 630, the boats in the right half, as the card's words sit on the left over a shade.
# Run after the pictures are retaken:  python3 scripts/og-bg.py
from PIL import Image
import os

W, H = 1200, 630
SRC = 'public/images'
OUT = 'lib/og-bg'
# name: (picture, the subject's centre as a share of the picture's width and height, how wide the crop is as a share of
# the picture's width, where the subject lands across the card)
CROPS = {
    'drone': ('drone-desk-v8.jpg', 0.385, 0.47, 0.56, 0.68),
    'fleet': ('h-run-v8.jpg', 0.62, 0.52, 1.0, 0.60),
    'aerial': ('top-v8.jpg', 0.36, 0.5, 0.62, 0.66),
    'start': ('h-start-v8.jpg', 0.40, 0.50, 0.92, 0.64),
    'trim': ('h-trim-v8.jpg', 0.38, 0.52, 0.92, 0.64),
    'helm': ('h-view-helm-v8.jpg', 0.45, 0.55, 1.0, 0.55),
    'wind': ('h-wind-v8.jpg', 0.42, 0.50, 0.95, 0.62),
}

os.makedirs(OUT, exist_ok=True)
for name, (src, cx, cy, wk, at) in CROPS.items():
    im = Image.open(os.path.join(SRC, src)).convert('RGB')
    w = round(im.width * wk)
    h = round(w * H / W)
    if h > im.height:
        h = im.height
        w = round(h * W / H)
    x0 = min(max(round(cx * im.width - at * w), 0), im.width - w)
    y0 = min(max(round(cy * im.height - h / 2), 0), im.height - h)
    out = im.crop((x0, y0, x0 + w, y0 + h)).resize((W, H), Image.LANCZOS)
    path = os.path.join(OUT, f'{name}.jpg')
    out.save(path, quality=78, optimize=True, progressive=True)
    print(name, (x0, y0, w, h), os.path.getsize(path) // 1024, 'KB')
