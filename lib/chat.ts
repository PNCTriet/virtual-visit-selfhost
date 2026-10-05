/**
 * Proximity chat rules shared by the Phaser scene and the chat panel.
 * Messages are ephemeral: nothing here is stored, and delivery is decided
 * from live avatar positions (which are client-authoritative).
 */

/** Map tiles are 16px (see the Tiled office map). */
export const TILE_PX = 16;
/** Center-to-center distance at which another avatar can be chatted with. */
export const CHAT_RADIUS_TILES = 3;
export const CHAT_RADIUS_PX = CHAT_RADIUS_TILES * TILE_PX;
/**
 * Receivers allow a little extra so a message sent at the edge isn't dropped
 * because someone took a step while it was in flight. Still far inside a room.
 */
export const CHAT_RECEIVE_SLACK_PX = TILE_PX * 0.75;
export const CHAT_RECEIVE_RADIUS_PX = CHAT_RADIUS_PX + CHAT_RECEIVE_SLACK_PX;

export const CHAT_MAX_CHARS = 200;
/** Minimum time between sends from this tab. */
export const CHAT_MIN_GAP_MS = 700;
export const CHAT_WINDOW_MS = 10_000;
export const CHAT_MAX_PER_WINDOW = 5;

/** How long a speech bubble stays up, in ms. */
export const BUBBLE_MS = 4500;

const STRIP = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Trim, collapse whitespace, and cap length. Empty input becomes null. Plain text only. */
export function sanitizeChat(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(STRIP, " ").replace(/\s+/g, " ").trim();
  const chars = [...text];
  if (chars.length === 0) return null;
  return chars.slice(0, CHAT_MAX_CHARS).join("");
}

export function formatChatTime(t: number): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

export type SendChatReason = "empty" | "rate" | "nobody" | "offline";
export type SendChatResult = { ok: true } | { ok: false; reason: SendChatReason };

export type ChatLine = { id: string; name: string; text: string; t: number; self: boolean };
export type TranscriptLine =
  | (ChatLine & { kind: "msg" })
  | { kind: "system"; id: string; text: string; t: number };

export function createRateLimiter(opts: { minGapMs: number; windowMs: number; maxInWindow: number }) {
  let last = 0;
  const stamps: number[] = [];
  return {
    allow(now: number) {
      while (stamps.length && now - stamps[0] >= opts.windowMs) stamps.shift();
      if (now - last < opts.minGapMs) return false;
      if (stamps.length >= opts.maxInWindow) return false;
      last = now;
      stamps.push(now);
      return true;
    },
  };
}
