/**
 * Pattern Memory leaderboard. Prefers Supabase table `vv_game_scores` when configured;
 * falls back to per-browser localStorage so local demo mode still works.
 */
import { realtimeConfigured } from "@/lib/realtime";

export type GameScore = {
  id: string;
  room_id: string;
  player_name: string;
  ms: number;
  created_at: string;
};

export const SCORE_MIN_MS = 800;
export const SCORE_MAX_MS = 15 * 60_000;
export const SCORE_TOP_N = 10;

const localKey = (roomId: string) => `vv-scores:${roomId}`;

function readLocal(roomId: string): GameScore[] {
  try {
    const raw = localStorage.getItem(localKey(roomId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GameScore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(roomId: string, rows: GameScore[]) {
  localStorage.setItem(localKey(roomId), JSON.stringify(rows.slice(0, 50)));
}

export function formatScoreMs(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(2)}s` : `${s.toFixed(1)}s`;
}

export async function fetchTopScores(roomId: string): Promise<GameScore[]> {
  if (!realtimeConfigured) {
    return readLocal(roomId).sort((a, b) => a.ms - b.ms).slice(0, SCORE_TOP_N);
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client
      .from("vv_game_scores")
      .select("id,room_id,player_name,ms,created_at")
      .eq("room_id", roomId)
      .order("ms", { ascending: true })
      .limit(SCORE_TOP_N);
    if (error) throw error;
    return (data ?? []) as GameScore[];
  } catch {
    return readLocal(roomId).sort((a, b) => a.ms - b.ms).slice(0, SCORE_TOP_N);
  }
}

export async function submitScore(roomId: string, playerName: string, ms: number): Promise<boolean> {
  if (!Number.isFinite(ms) || ms < SCORE_MIN_MS || ms > SCORE_MAX_MS) return false;
  const name = playerName.trim().slice(0, 30);
  if (!name) return false;
  const row: GameScore = {
    id: crypto.randomUUID(),
    room_id: roomId,
    player_name: name,
    ms: Math.round(ms),
    created_at: new Date().toISOString(),
  };

  if (!realtimeConfigured) {
    const next = [...readLocal(roomId), row].sort((a, b) => a.ms - b.ms);
    writeLocal(roomId, next);
    return true;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await client.from("vv_game_scores").insert({
      room_id: row.room_id,
      player_name: row.player_name,
      ms: row.ms,
    });
    if (error) throw error;
    return true;
  } catch {
    const next = [...readLocal(roomId), row].sort((a, b) => a.ms - b.ms);
    writeLocal(roomId, next);
    return true;
  }
}
