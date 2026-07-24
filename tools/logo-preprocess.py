"""Vorverarbeitung Logo-Trace: TIF (RGBA, Form im Alpha) -> S/W-PNGs fuer potrace.

Master: assets/logo/wildgewachsen_logo.tif (2500x1750; RGB ueberall 0,
Form liegt komplett im Alpha-Kanal -- verifiziert 2026-07-22).
Flatten auf weiss == Threshold direkt auf Alpha.

Output in tools/_trace/:
  logo-bw-t96.png / t128.png / t160.png  -- volle Wortmarke, 3 Threshold-Varianten
  wave-bw.png  -- Favicon-Quelle: buchstabenfreier Wellen-Abschnitt links
                  (x 329-620, ~2,5 Schwingungen), Strich 4-20px handgezeichnet,
                  fuer 16-32px-Lesbarkeit moderat dilatiert (Radius 5),
                  quadratische Leinwand mit Luft.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"C:/Users/diefa/Wildgewachsen_Content/Projekt_Wildgewachsen/assets/logo/wildgewachsen_logo.tif"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_trace")
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
a = np.array(im)[..., 3].astype(np.uint8)

# --- 1) Volle Wortmarke, 3 Thresholds
for t in (96, 128, 160):
    bw = np.where(a >= t, 0, 255).astype(np.uint8)
    Image.fromarray(bw, "L").save(os.path.join(OUT, f"logo-bw-t{t}.png"))
    print(f"logo-bw-t{t}.png  ink_px={int((a >= t).sum())}")

# --- 2) Favicon-Welle: letter-freier Abschnitt (Buchstaben-Ink beginnt erst x>=628)
# Fenster mit Rand, damit die Dilation nicht an der Array-Kante geclippt wird;
# Buchstaben-Ink ("w") beginnt erst bei x=628 -> Fenster endet bei 627.
y0, y1, x0, x1 = 650, 715, 318, 627
seg = a[y0:y1, x0:x1] >= 96
assert seg.sum() > 500, "Wellen-Segment leer -- Crop-Fenster pruefen"
# moderate Dilation: Handstrich 4-20px ist bei 16px-Favicon unsichtbar duenn
disk = np.hypot(*np.mgrid[-5:6, -5:6]) <= 5
seg_d = ndimage.binary_dilation(seg, structure=disk)
ys, xs = np.where(seg_d)
crop = seg_d[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
ch, cw = crop.shape
side = int(max(ch, cw) * 1.26)  # ~13% Luft je Seite
canvas = np.zeros((side, side), dtype=bool)
oy, ox = (side - ch) // 2, (side - cw) // 2
canvas[oy:oy + ch, ox:ox + cw] = crop
Image.fromarray(np.where(canvas, 0, 255).astype(np.uint8), "L").save(
    os.path.join(OUT, "wave-bw.png"))
print(f"wave-bw.png  canvas={side}x{side}  wave_bbox={cw}x{ch}  px={int(seg.sum())}")
