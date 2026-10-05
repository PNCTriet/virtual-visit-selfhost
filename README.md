# Virtual Visit (self-hosted) — HOWL STUDIO

A small, self-hosted, realtime virtual space. Visitors type a name, enter a room, and walk around a 2D studio map together. They see each other's avatars, name labels, and who is online, all live.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4, **Phaser 3** (Tiled map), and Supabase Realtime (`@supabase/supabase-js`).
- **Mostly ephemeral:** positions, chat, jumps, reactions, and cinema sync use Realtime **Broadcast** + **Presence**. Optional Postgres table `vv_game_scores` stores arcade leaderboard times.
- **Works without config:** if the Supabase env vars are missing, it falls back to a same-browser `BroadcastChannel` demo and shows a **"Local demo mode"** badge. Arcade scores then use `localStorage`.

## Features

- Landing page: enter your name (1–30 chars) and optionally a room (default `lobby`). Links shared as `/?room=<id>` prefill the room.
- `/room/[id]`: each id is a separate, isolated room (`a–z 0–9 -`, up to 32 chars).
- Phaser office map (`public/game/office.tmj`, 40×28 tiles) with Lounge, **Cinema**, Café, **Arcade**, and HOWL STUDIO labels. Avatars collide with walls and furniture.
- Sprite avatars with a stable character from the name hash, plus a name label.
- Move with **WASD / arrow keys** or the on-screen joystick. **Space** (or mobile **Jump**) hops in place. Camera follows you and clamps to the map.
- "Who's here" list in a side panel on desktop, or behind the "N here" button on mobile. Header: **Copy link** and **Leave**.
- Proximity chat (IME-safe for Vietnamese), quick **React** emojis, shared **Cinema** (YouTube), and **Pattern Memory** arcade with ranks. See sections below.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: fill in Supabase values for real multi-device realtime
npm run dev                  # http://localhost:3000
```

Without `.env.local`, open two tabs of the same browser on the same room to see local demo mode.

```bash
npm run lint
npm run build && npm start
```

Regenerate the Tiled map after editing `scripts/build-map.mjs`:

```bash
node scripts/build-map.mjs
```

## Environment variables

| Name | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` (or the legacy anon JWT) | **Publishable/anon key only.** Never use `service_role` / secret keys. |

Both values are public by design: they are inlined into the client bundle at **build time**. Change them and you must redeploy. Values still holding the `YOUR-` / `YOUR_` placeholders count as unset.

This app shares an existing Supabase project with other HOWL demos. Realtime channels are named `virtual-visit:room:<id>`. For persistent arcade ranks, run [`supabase/vv_game_scores.sql`](supabase/vv_game_scores.sql) once in the SQL editor.

## Deploy on Vercel

1. Import this repo in Vercel (framework preset: Next.js, no build settings needed).
2. Under **Settings → Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production (and Preview if you want).
3. Deploy, or redeploy after changing env vars. Open `/room/lobby` on two devices to check that the header badge says **Live**.

There is no custom server on Vercel. The browser talks to Supabase Realtime (and optionally Postgres) directly.

## How realtime works

All of the code lives in `lib/realtime.ts` behind a small `RoomTransport` interface. Another backend (Liveblocks, PartyKit, Ably, your own WebSocket server) can replace it without changing the game code.

- **Channel:** `virtual-visit:room:<roomId>`, one per room, so rooms never see each other.
- **Presence** (key = random per-tab id, meta = `{ id, name, color }`): `join` triggers an immediate position send so newcomers see everyone straight away. `leave` removes that avatar.
- **Broadcast `pos`** `{ id, name, color, x, y, f, m, t }`: at most every **75 ms (~13/s)** while moving, plus a **2 s heartbeat** while idle. `self: false` means you don't receive your own messages. A `bye` event is sent on Leave / tab close for a faster cleanup.
- **Broadcast `chat`:** proximity text. See [Proximity chat](#proximity-chat).
- **Broadcast `jump`:** `{ id, t }` — short hop animation only (not folded into `pos`).
- **Broadcast `react`:** `{ id, from, name, emoji, t, x, y }` — floating emoji + transcript line; rate-limited.
- **Broadcast `cinema`:** `{ url, playing, tMedia, tWall, by }` — last-write-wins YouTube sync for the cinema zone.
- **Remote avatars** are smoothed toward their last known position (snap when far). Peers silent for **12 s** are dropped as stale.
- **Local demo mode:** the same protocol over a `BroadcastChannel` with the same channel name.

The header badge shows `Connecting…`, `Live`, `Offline`, or `Local demo mode`.

### Quota tips

- Keep jump / react / cinema as **rare** events. Do not put them on the `pos` stream.
- Cinema syncs control messages only; video bytes come from **YouTube’s CDN**, not Supabase or Vercel.
- Leaderboard: fetch on open / after submit; no realtime subscription on scores.
- Sweet spot remains roughly **≲ 20–30** concurrent visitors per room on a shared free-tier Realtime project.

## Proximity chat

Stand within **3 tiles** of another avatar (`CHAT_RADIUS_TILES` in `lib/chat.ts`, 16px tiles) and a **Chat** button appears. On desktop, **Enter** opens it and sends; **Esc** closes it. On a phone, tap **Chat**. While the message field is focused, WASD and the joystick do not move you, and the Phaser loop drops to ~20 FPS so typing stays smooth.

The composer handles **IME composition** (Telex/VNI and similar): it does not truncate or submit mid-composition. On mobile, the panel sits above the soft keyboard via `visualViewport` (`--vv-kb` / `--vv-vis`).

Messages are plain text: trimmed, capped at **200 characters**, rate-limited (1 / 700ms, 5 / 10s). Nothing is stored; refresh clears the transcript. Delivery is proximity-checked on each client (client-authoritative positions).

## Jump and reactions

- **Jump:** Space on desktop, **Jump** button next to the joystick on phones. Visual hop with cooldown; synced via `jump` broadcast.
- **React:** fixed emoji set (`REACT_EMOJIS` in `lib/chat.ts`). Nearby players see a float above the avatar and a line in the chat panel. Rate limit: 1 / 1.5s, 8 / minute.

## Cinema zone

Walk into the **Cinema** (former meeting room). **Open cinema** pastes a YouTube URL; everyone in the zone can change it (last write wins). Play/pause is synced approximately (±1–2s). Leaving the zone closes the panel so audio does not leak across the map.

## Arcade + leaderboard

Walk near the east-hall **Arcade** / board zone to see ranks and **Play Pattern Memory** (solo sequence puzzle). Clear time is measured in ms; faster is better. Submit writes to `vv_game_scores` when Supabase is configured, otherwise `localStorage`.

SQL: [`supabase/vv_game_scores.sql`](supabase/vv_game_scores.sql) — anon `select` + `insert` RLS for the public demo trust model.

## Camera / voice (not implemented)

Supabase Realtime is fine for signaling/presence, but **not** for hosting cam/mic media. A future proximity or meeting-room AV feature should use an SFU such as LiveKit or Daily. Mesh WebRTC breaks down past a handful of peers; video is the expensive part.

## Limits and caveats

- **No auth:** channels are public. Anyone with the public key and a room id can join, read positions, or send spoofed messages. Scores are also client-submitted with light ms bounds only.
- **Supabase quotas:** Realtime limits apply per project. Each visitor uses one connection; movers send ~13 `pos`/s fanned out to peers.
- **Local demo mode** only syncs between tabs of the same browser profile on the same device.
- Map layout: edit [`scripts/build-map.mjs`](scripts/build-map.mjs) and regenerate `public/game/office.tmj`.

## Project layout

```
app/page.tsx                 landing
app/room/[id]/page.tsx       room route
components/Room.tsx          room chrome, zones, reactions
components/ProximityChat.tsx chat panel (IME + mobile keyboard)
components/CinemaPanel.tsx   shared YouTube cinema
components/MiniGame.tsx      Pattern Memory
components/Leaderboard.tsx   arcade ranks UI
lib/game/office.ts           Phaser world, zones, jump/react
lib/realtime.ts              RoomTransport (pos/chat/jump/react/cinema)
lib/chat.ts                  proximity + react limits
lib/scores.ts                leaderboard (Supabase or localStorage)
lib/youtube.ts               YouTube URL helpers
supabase/vv_game_scores.sql  optional Postgres schema
scripts/build-map.mjs        Tiled map generator
```
