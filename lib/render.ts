import { AVATAR_R, BLOCKS, MAP_H, MAP_W, ROOMS, TILE, WALLS, type Block } from "./map";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws the static map once (floors, walls, furniture, labels) into an offscreen canvas. */
export function renderMap(scale: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(MAP_W * scale);
  c.height = Math.ceil(MAP_H * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#e9eaee";
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Tile floors per room: rounded squares with hairline gaps.
  for (const room of ROOMS) {
    ctx.save();
    rr(ctx, room.x, room.y, room.w, room.h, 0);
    ctx.clip();
    ctx.fillStyle = "#eceef1";
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.fillStyle = room.floor;
    for (let x = room.x; x < room.x + room.w; x += TILE) {
      for (let y = room.y; y < room.y + room.h; y += TILE) {
        rr(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 6);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.fillStyle = "#a1a1a6";
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = "top";
    ctx.fillText(room.name.toUpperCase(), room.x + 26, room.y + 26);
  }

  // HOWL STUDIO floor mark in the lobby.
  const lobby = ROOMS[0];
  const cx = lobby.x + lobby.w / 2, cy = lobby.y + 7.9 * TILE;
  ctx.save();
  ctx.globalAlpha = 0.9;
  const g = ctx.createRadialGradient(cx - 120, cy - 20, 2, cx - 120, cy - 10, 30);
  g.addColorStop(0, "#b8e0ff"); g.addColorStop(0.45, "#3d95ff"); g.addColorStop(1, "#0b55dd");
  ctx.fillStyle = g;
  rr(ctx, cx - 142, cy - 22, 44, 44, 12);
  ctx.fill();
  ctx.fillStyle = "#d8d8de";
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("HOWL", cx - 84, cy + 1);
  ctx.font = '500 34px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = "#e3e3e8";
  ctx.fillText("STUDIO", cx + 22, cy + 1);
  ctx.restore();

  // Walls
  ctx.fillStyle = "#c7c7cc";
  for (const w of WALLS) { rr(ctx, w.x, w.y, w.w, w.h, Math.min(w.w, w.h) / 2); ctx.fill(); }

  for (const b of BLOCKS) drawBlock(ctx, b);
  return c;
}

function drawBlock(ctx: CanvasRenderingContext2D, b: Block) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.10)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  if (b.kind === "plant") {
    const r = b.w / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(b.x + r, b.y + r, r * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#34c759";
    for (const [dx, dy, s] of [[-0.25, -0.2, 0.42], [0.25, -0.15, 0.4], [0, 0.22, 0.42]]) {
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(b.x + r + dx * r, b.y + r + dy * r, s * r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.kind === "round") {
    const r = b.w / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(b.x + r, b.y + r, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#e5e5ea"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#f2f2f7";
    ctx.beginPath(); ctx.arc(b.x + r, b.y + r, r * 0.55, 0, Math.PI * 2); ctx.fill();
  } else {
    const radius = b.kind === "sofa" ? 16 : 12;
    ctx.fillStyle = b.kind === "sofa" ? b.color ?? "#eef1f6" : "#ffffff";
    rr(ctx, b.x, b.y, b.w, b.h, radius); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#e5e5ea"; ctx.lineWidth = 1; ctx.stroke();
    if (b.kind === "plinth") {
      ctx.fillStyle = b.color ?? "#0a84ff";
      ctx.globalAlpha = 0.9;
      rr(ctx, b.x + b.w * 0.32, b.y + b.h * 0.32, b.w * 0.36, b.h * 0.36, 10); ctx.fill();
    } else if (b.kind === "desk" || b.kind === "table") {
      ctx.fillStyle = "#f2f2f7";
      rr(ctx, b.x + 10, b.y + 10, b.w - 20, b.h - 20, 8); ctx.fill();
    } else if (b.kind === "sofa") {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      rr(ctx, b.x + 8, b.y + 8, b.w - 16, b.h * 0.38, 10); ctx.fill();
    }
  }
  ctx.restore();
}

export type DrawAvatar = { x: number; y: number; name: string; color: string; self?: boolean; dir: number; bob: number };

/** Cute rounded avatar: soft shadow, colored body, glossy highlight, eyes looking where it walks, name pill. */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: DrawAvatar, now: number) {
  const r = AVATAR_R;
  const y = a.y - Math.abs(Math.sin(a.bob)) * 3;
  ctx.save();
  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath(); ctx.ellipse(a.x, a.y + r - 2, r * 0.85, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  if (a.self) {
    const p = (now % 2000) / 2000;
    ctx.strokeStyle = `rgba(0,113,227,${0.35 * (1 - p)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(a.x, a.y + r - 2, r * (1 + p * 0.9), r * 0.34 * (1 + p * 0.9), 0, 0, Math.PI * 2); ctx.stroke();
  }
  // body
  ctx.fillStyle = a.color;
  ctx.beginPath(); ctx.arc(a.x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.stroke();
  // highlight
  const hl = ctx.createLinearGradient(0, y - r, 0, y);
  hl.addColorStop(0, "rgba(255,255,255,0.45)"); hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.beginPath(); ctx.ellipse(a.x, y - r * 0.45, r * 0.62, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  // eyes
  const ex = Math.cos(a.dir) * 3.5, ey = Math.sin(a.dir) * 2.5;
  ctx.fillStyle = "#1d1d1f";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(a.x + s * 5.5 + ex, y + 1 + ey, 2.1, 2.8, 0, 0, Math.PI * 2); ctx.fill(); }
  // blush
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(a.x + s * 9 + ex * 0.6, y + 6 + ey * 0.6, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
  // name pill
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
  const label = a.name.length > 18 ? a.name.slice(0, 17) + "…" : a.name;
  const tw = ctx.measureText(label).width;
  const pw = tw + (a.self ? 30 : 18), ph = 22, px = a.x - pw / 2, py = y - r - ph - 8;
  ctx.fillStyle = a.self ? "rgba(0,102,204,0.95)" : "rgba(29,29,31,0.82)";
  rr(ctx, px, py, pw, ph, 11); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, px + 9, py + ph / 2 + 0.5);
  if (a.self) { ctx.globalAlpha = 0.7; ctx.fillText("•", px + pw - 16, py + ph / 2); }
  ctx.restore();
}
