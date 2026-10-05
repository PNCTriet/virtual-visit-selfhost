-- Pattern Memory leaderboard for Virtual Visit.
-- Run once in the shared HOWL Supabase SQL editor (public schema).
-- Safe for anon clients: same trust model as client-authoritative positions.

create table if not exists public.vv_game_scores (
  id uuid primary key default gen_random_uuid(),
  room_id text not null check (char_length(room_id) between 1 and 32),
  player_name text not null check (char_length(player_name) between 1 and 30),
  ms integer not null check (ms >= 800 and ms <= 900000),
  created_at timestamptz not null default now()
);

create index if not exists vv_game_scores_room_ms_idx
  on public.vv_game_scores (room_id, ms);

alter table public.vv_game_scores enable row level security;

drop policy if exists "vv_game_scores_select" on public.vv_game_scores;
create policy "vv_game_scores_select"
  on public.vv_game_scores for select
  to anon, authenticated
  using (true);

drop policy if exists "vv_game_scores_insert" on public.vv_game_scores;
create policy "vv_game_scores_insert"
  on public.vv_game_scores for insert
  to anon, authenticated
  with check (true);
