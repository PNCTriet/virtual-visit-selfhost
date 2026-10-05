/** Static demo map. Units: px. One tile = 48px; the map is 36 × 24 tiles. */
export const TILE = 48;
export const COLS = 36;
export const ROWS = 24;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;
export const AVATAR_R = 16;

export type Rect = { x: number; y: number; w: number; h: number };
export type Room = Rect & { name: string; floor: string };
export type Block = Rect & { kind: "desk" | "sofa" | "plinth" | "table" | "plant" | "round"; color?: string };

const t = (x: number, y: number, w: number, h: number): Rect => ({ x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE });

export const ROOMS: Room[] = [
  { ...t(14, 0, 22, 13), name: "Lobby", floor: "#ffffff" },
  { ...t(0, 0, 14, 12), name: "Showroom", floor: "#fbfbfd" },
  { ...t(0, 12, 14, 12), name: "Lounge", floor: "#fafaf8" },
  { ...t(14, 13, 11, 11), name: "Studio", floor: "#f9fafc" },
  { ...t(25, 13, 11, 11), name: "Meeting room", floor: "#fbfbfd" },
];

/** Thin walls with door gaps. */
export const WALLS: Rect[] = [
  t(0, 0, 36, 0.4), t(0, 23.6, 36, 0.4), t(0, 0, 0.4, 24), t(35.6, 0, 0.4, 24),
  // Lobby | Showroom/Lounge
  t(13.8, 0, 0.4, 4), t(13.8, 8, 0.4, 8), t(13.8, 19, 0.4, 5),
  // Showroom | Lounge
  t(0, 11.8, 5, 0.4), t(9, 11.8, 5, 0.4),
  // Lobby | Studio + Meeting
  t(14, 12.8, 3, 0.4), t(21, 12.8, 9, 0.4), t(34, 12.8, 2, 0.4),
  // Studio | Meeting
  t(24.8, 13, 0.4, 4), t(24.8, 20, 0.4, 4),
];

export const BLOCKS: Block[] = [
  // Lobby
  { ...t(21.5, 4, 7, 1.4), kind: "desk" },
  { ...t(15.2, 1.2, 1, 1), kind: "plant" },
  { ...t(34.2, 1.2, 1, 1), kind: "plant" },
  { ...t(30.5, 9.8, 4, 1.3), kind: "sofa", color: "#e8eefc" },
  { ...t(15.5, 9.8, 4, 1.3), kind: "sofa", color: "#e8eefc" },
  // Showroom
  { ...t(3, 3, 2, 2), kind: "plinth", color: "#0a84ff" },
  { ...t(9, 3, 2, 2), kind: "plinth", color: "#ff9f0a" },
  { ...t(3, 7.5, 2, 2), kind: "plinth", color: "#30d158" },
  { ...t(9, 7.5, 2, 2), kind: "plinth", color: "#bf5af2" },
  // Lounge
  { ...t(1.5, 14.5, 4.5, 1.3), kind: "sofa", color: "#f3ece4" },
  { ...t(1.5, 21, 4.5, 1.3), kind: "sofa", color: "#f3ece4" },
  { ...t(7.6, 16.6, 2.8, 2.8), kind: "round" },
  { ...t(12, 22, 1, 1), kind: "plant" },
  // Studio
  { ...t(16.5, 16.5, 6, 2.6), kind: "table" },
  { ...t(22.6, 22, 1, 1), kind: "plant" },
  // Meeting room
  { ...t(28.5, 16.5, 4, 4), kind: "round" },
  { ...t(34, 22, 1, 1), kind: "plant" },
];

const isRound = (b: Block) => b.kind === "round" || b.kind === "plant";

/** True when a circle of radius r at (x, y) overlaps a wall, a block or the map edge. */
export function collides(x: number, y: number, r = AVATAR_R): boolean {
  if (x - r < 0 || y - r < 0 || x + r > MAP_W || y + r > MAP_H) return true;
  for (const w of WALLS) if (circleRect(x, y, r, w)) return true;
  for (const b of BLOCKS) {
    if (isRound(b)) {
      const R = b.w / 2, dx = x - (b.x + R), dy = y - (b.y + R);
      if (dx * dx + dy * dy < (R + r) * (R + r)) return true;
    } else if (circleRect(x, y, r, b)) return true;
  }
  return false;
}

function circleRect(x: number, y: number, r: number, b: Rect) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

/** A free spawn point in the lobby. */
export function spawnPoint(): { x: number; y: number } {
  const lobby = ROOMS[0];
  for (let i = 0; i < 200; i++) {
    const x = lobby.x + 80 + Math.random() * (lobby.w - 160);
    const y = lobby.y + 6.5 * TILE + Math.random() * 2.5 * TILE;
    if (!collides(x, y, AVATAR_R + 6)) return { x, y };
  }
  return { x: lobby.x + lobby.w / 2, y: lobby.y + 7.5 * TILE };
}

const PALETTE = ["#0a84ff", "#30d158", "#ff9f0a", "#ff375f", "#bf5af2", "#5e5ce6", "#64d2ff", "#ff6b3d", "#00c7be", "#ac8e68"];
/** Stable, pleasant color for a name. */
export function colorFor(name: string): string {
  let h = 2166136261;
  for (const ch of name.trim().toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export const ROOM_ID_RE = /^[a-z0-9-]{1,32}$/;
export const normalizeRoomId = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
