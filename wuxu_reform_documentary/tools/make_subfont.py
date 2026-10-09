"""Create a static (weight 500) Noto Sans SC instance for libass subtitle burn-in.

libass would otherwise pick the variable font's default (Thin) instance.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, "web", "assets", "fonts", "NotoSansSC[wght].ttf")
out_dir = os.path.join(ROOT, "build", "subfont")
os.makedirs(out_dir, exist_ok=True)
font = TTFont(src)
inst = instancer.instantiateVariableFont(font, {"wght": 500}, updateFontNames=False)
name = inst["name"]
for rec in name.names:
    if rec.nameID in (1, 16):
        rec.string = "Noto Sans SC Sub"
    elif rec.nameID in (2, 17):
        rec.string = "Regular"
    elif rec.nameID == 4:
        rec.string = "Noto Sans SC Sub Regular"
    elif rec.nameID == 6:
        rec.string = "NotoSansSCSub-Regular"
inst.save(os.path.join(out_dir, "NotoSansSC-Sub.ttf"))
print("wrote", os.path.join(out_dir, "NotoSansSC-Sub.ttf"))
