/** Room ids, name → avatar mapping. Pure helpers shared by the landing page and the room. */
export const ROOM_ID_RE = /^[a-z0-9-]{1,32}$/;
export const normalizeRoomId = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

const PALETTE = ["#0a84ff", "#30d158", "#ff9f0a", "#ff375f", "#bf5af2", "#5e5ce6", "#64d2ff", "#ff6b3d", "#00c7be", "#ac8e68"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Accent color for a name (who's-here list dot). */
export const colorFor = (name: string) => PALETTE[hash(name.trim().toLowerCase()) % PALETTE.length];

/** Number of characters in public/game/characters.png (see scripts/prepare-assets.py). */
export const CHARACTER_COUNT = 12;
/** Which character sprite a name walks around as. Same name → same character on every client. */
export const characterFor = (name: string) => hash(`c:${name.trim().toLowerCase()}`) % CHARACTER_COUNT;
