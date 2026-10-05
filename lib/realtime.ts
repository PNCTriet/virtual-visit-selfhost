/**
 * Realtime transport behind a tiny interface, so Supabase can be swapped for PartyKit,
 * Cloudflare Durable Objects, etc. without touching the game code.
 *
 * - "supabase": Supabase Realtime. Broadcast carries positions; Presence tracks join/leave.
 *   No tables, no auth: only NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * - "local": BroadcastChannel fallback when the env vars are missing (tabs of the same browser).
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type PeerMeta = { id: string; name: string; color: string };
/** 0 = down, 1 = up, 2 = left, 3 = right (columns of the character spritesheet). */
export type Facing = 0 | 1 | 2 | 3;
/** One broadcast "pos" message: world px position, facing, whether the avatar is walking, sender time. */
export type PeerPos = PeerMeta & { x: number; y: number; f: Facing; m: boolean; t: number };
export type TransportKind = "supabase" | "local";
export type TransportStatus = "connecting" | "live" | "error";

export type TransportHandlers = {
  onPos: (p: PeerPos) => void;
  onLeave: (id: string) => void;
  /** Someone new arrived: re-send our position right away so they see us even if we're idle. */
  onJoin: () => void;
  onStatus: (s: TransportStatus) => void;
};

export interface RoomTransport {
  readonly kind: TransportKind;
  connect(self: PeerMeta, h: TransportHandlers): void;
  send(p: PeerPos): void;
  disconnect(): void;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const realtimeConfigured = (() => {
  if (!SUPABASE_URL || !SUPABASE_KEY || /YOUR[-_]/.test(SUPABASE_URL + SUPABASE_KEY)) return false;
  try { return new URL(SUPABASE_URL).protocol === "https:"; } catch { return false; }
})();

/** Everything lives under the "virtual-visit" namespace (shared Supabase project; no tables, no schema). */
export const channelName = (roomId: string) => `virtual-visit:room:${roomId}`;

export function createTransport(roomId: string): RoomTransport {
  return realtimeConfigured ? new SupabaseTransport(roomId) : new LocalTransport(roomId);
}

class SupabaseTransport implements RoomTransport {
  readonly kind = "supabase" as const;
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private ready = false;
  private selfId = "";
  private closed = false;
  constructor(private roomId: string) {}

  connect(self: PeerMeta, h: TransportHandlers) {
    this.selfId = self.id;
    h.onStatus("connecting");
    // Loaded on demand so the landing page doesn't ship the SDK.
    import("@supabase/supabase-js").then(({ createClient }) => {
      if (this.closed) return;
      this.client = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 20 } },
      });
      const ch = this.client.channel(channelName(this.roomId), {
        config: { broadcast: { self: false, ack: false }, presence: { key: self.id } },
      });
      this.channel = ch;
      ch.on("broadcast", { event: "pos" }, ({ payload }) => h.onPos(payload as PeerPos))
        .on("broadcast", { event: "bye" }, ({ payload }) => h.onLeave((payload as { id: string }).id))
        .on("presence", { event: "join" }, ({ key }) => { if (key !== self.id) h.onJoin(); })
        .on("presence", { event: "leave" }, ({ key }) => { if (key !== self.id) h.onLeave(key); })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            this.ready = true;
            h.onStatus("live");
            await ch.track({ id: self.id, name: self.name, color: self.color });
            h.onJoin();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.ready = false;
            h.onStatus("error");
          } else if (status === "CLOSED") {
            this.ready = false;
          }
        });
    }).catch(() => h.onStatus("error"));
  }

  send(p: PeerPos) {
    if (this.ready) void this.channel?.send({ type: "broadcast", event: "pos", payload: p });
  }

  disconnect() {
    this.closed = true;
    const ch = this.channel;
    if (ch && this.ready) void ch.send({ type: "broadcast", event: "bye", payload: { id: this.selfId } });
    this.ready = false;
    if (ch) { void ch.untrack(); void this.client?.removeChannel(ch); }
    this.channel = null;
  }
}

type LocalMsg = { type: "pos"; p: PeerPos } | { type: "hello"; id: string } | { type: "bye"; id: string };

class LocalTransport implements RoomTransport {
  readonly kind = "local" as const;
  private bc: BroadcastChannel | null = null;
  private selfId = "";
  constructor(private roomId: string) {}

  connect(self: PeerMeta, h: TransportHandlers) {
    this.selfId = self.id;
    if (typeof BroadcastChannel === "undefined") return h.onStatus("error");
    const bc = new BroadcastChannel(channelName(this.roomId));
    this.bc = bc;
    bc.onmessage = (e: MessageEvent<LocalMsg>) => {
      const m = e.data;
      if (m.type === "pos" && m.p.id !== self.id) h.onPos(m.p);
      else if (m.type === "hello" && m.id !== self.id) h.onJoin();
      else if (m.type === "bye" && m.id !== self.id) h.onLeave(m.id);
    };
    bc.postMessage({ type: "hello", id: self.id } satisfies LocalMsg);
    h.onStatus("live");
  }

  send(p: PeerPos) { this.bc?.postMessage({ type: "pos", p } satisfies LocalMsg); }

  disconnect() {
    this.bc?.postMessage({ type: "bye", id: this.selfId } satisfies LocalMsg);
    this.bc?.close();
    this.bc = null;
  }
}
