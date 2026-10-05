"""Re-pack the downloaded CC0 packs into game-ready sheets in public/game/ (see CREDITS.md).

- Kenney tilesheets (16px, 1px spacing) -> extruded copies (margin 1, spacing 2) so tiles never
  bleed at fractional camera zoom.
- Ninja Adventure characters -> one atlas: 16px frames, margin 1 / spacing 2.
  Character k uses columns 4k..4k+3 (down, up, left, right); rows 0-3 = walk frames, row 4 = idle.

Usage: python3 scripts/prepare-assets.py <kenney-rpg-dir> <kenney-indoor-dir> <ninja-pack-dir>
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "game"
CHARACTERS = ["Boy", "Princess", "OldMan", "Noble", "Inspector", "EggGirl", "Woman", "Villager3", "Villager4", "Monk", "Hunter", "Master"]


def extrude(src: Path, dst: Path, tile=16, spacing=1):
    im = Image.open(src).convert("RGBA")
    cols = (im.width + spacing) // (tile + spacing)
    rows = (im.height + spacing) // (tile + spacing)
    out = Image.new("RGBA", (cols * (tile + 2), rows * (tile + 2)))
    for r in range(rows):
        for c in range(cols):
            t = im.crop((c * (tile + spacing), r * (tile + spacing), c * (tile + spacing) + tile, r * (tile + spacing) + tile))
            x, y = c * (tile + 2) + 1, r * (tile + 2) + 1
            out.paste(t.resize((tile + 2, tile + 2), Image.NEAREST), (x - 1, y - 1))  # rough edge fill
            out.paste(t.crop((0, 0, tile, 1)), (x, y - 1)); out.paste(t.crop((0, tile - 1, tile, tile)), (x, y + tile))
            out.paste(t.crop((0, 0, 1, tile)), (x - 1, y)); out.paste(t.crop((tile - 1, 0, tile, tile)), (x + tile, y))
            out.paste(t, (x, y))
    out.save(dst, optimize=True)
    print(dst.name, cols, rows, out.size)


def characters(pack: Path, dst: Path):
    base = pack / "Actor" / "Character"
    n = len(CHARACTERS)
    out = Image.new("RGBA", (n * 4 * 18, 5 * 18))
    for k, name in enumerate(CHARACTERS):
        walk = Image.open(base / name / "SeparateAnim" / "Walk.png").convert("RGBA")
        idle = Image.open(base / name / "SeparateAnim" / "Idle.png").convert("RGBA")
        for d in range(4):
            for f in range(4):
                out.paste(walk.crop((d * 16, f * 16, d * 16 + 16, f * 16 + 16)), ((4 * k + d) * 18 + 1, f * 18 + 1))
            out.paste(idle.crop((d * 16, 0, d * 16 + 16, 16)), ((4 * k + d) * 18 + 1, 4 * 18 + 1))
    out.save(dst, optimize=True)
    Image.open(base / "Shadow.png").save(OUT / "shadow.png", optimize=True)
    print(dst.name, out.size)


if __name__ == "__main__":
    rpg, indoor, ninja = map(Path, sys.argv[1:4])
    OUT.mkdir(parents=True, exist_ok=True)
    extrude(rpg / "Spritesheet" / "roguelikeSheet_transparent.png", OUT / "kenney-roguelike-rpg.png")
    extrude(indoor / "Tilesheets" / "roguelikeIndoor_transparent.png", OUT / "kenney-roguelike-indoor.png")
    characters(ninja, OUT / "characters.png")
