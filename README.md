# Virtual Visit (self-hosted) — HOWL STUDIO

A small, self-hosted, realtime virtual space. Visitors type a name, enter a room, and walk around a 2D studio map together. They see each other's avatars, name labels, and who is online, all live.

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4, a plain Canvas 2D renderer, and Supabase Realtime (`@supabase/supabase-js`) as the only runtime dependency beyond Next and React.
- **No database:** it uses only Realtime **Broadcast** and **Presence**. There are no tables, migrations, or SQL, and nothing is stored.
- **Works without config:** if the Supabase env vars are missing, it falls back to a same-browser `BroadcastChannel` demo and shows a **"Local demo mode"** badge.

## Features

- Landing page: enter your name (1–30 chars) and optionally a room (default `lobby`). Links shared as `/?room=<id>` prefill the room.
- `/room/[id]`: each id is a separate, isolated room (`a–z 0–9 -`, up to 32 chars).
- Tile-floor map (1728×1152) with walls, door gaps, five areas (Lobby, Showroom, Lounge, Studio, Meeting room), and furniture. Avatars collide with walls and furniture.
- Cute round avatars. Each gets a stable color derived from its name, plus a name label. Your own avatar is blue and has a pulse ring.
- Move with **WASD / arrow keys**, or **click/tap** anywhere to walk there. Movement is smooth, and the camera follows you and clamps to the map edges. On phones the view zooms out slightly.
- "Who's here" list in a side panel on desktop, or behind the "N here" button on mobile. The header also has **Copy link** and **Leave**.

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

## Environment variables

| Name | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` (or the legacy anon JWT) | **Publishable/anon key only.** Never use `service_role` / secret keys. |

Both values are public by design: they are inlined into the client bundle at **build time**. Change them and you must redeploy. Values still holding the `YOUR-` / `YOUR_` placeholders count as unset.

This app shares an existing Supabase project with other HOWL demos. It only uses Realtime channels named `virtual-visit:room:<id>`, never touches any tables, and needs no schema changes. Realtime is enabled by default on Supabase projects.

## Deploy on Vercel

1. Import this repo in Vercel (framework preset: Next.js, no build settings needed).
2. Under **Settings → Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production (and Preview if you want).
3. Deploy, or redeploy after changing env vars. Open `/room/lobby` on two devices to check that the header badge says **Live**.

There is no server state, no websockets on Vercel, and no custom server. The browser talks to Supabase Realtime directly.

## How realtime works

All of the code lives in `lib/realtime.ts` behind a small `RoomTransport` interface (`connect` / `send` / `disconnect`). Another backend (Liveblocks, PartyKit, Ably, your own WebSocket server) can replace it without changing the game code.

- **Channel:** `virtual-visit:room:<roomId>`, one per room, so rooms never see each other.
- **Presence** (key = random per-tab id, meta = `{ id, name, color }`): `join` triggers an immediate position send so newcomers see everyone straight away. `leave` removes that avatar.
- **Broadcast** `pos` events `{ id, name, color, x, y, t }`: these are sent at most every **75 ms (~13/s)**, and only while you move, plus a **2 s heartbeat** while idle. `self: false` means you don't receive your own messages. A `bye` event is sent on Leave / tab close for a faster cleanup.
- **Remote avatars** are smoothed toward their last known position (exponential interpolation, which snaps when the jump is more than 400 px). Any peer silent for **12 s** is dropped as stale, which covers crashed tabs and lost connections.
- **Local demo mode:** the same protocol (`hello` / `pos` / `bye`) over a `BroadcastChannel` with the same channel name.

The header badge shows `Connecting…`, `Live`, `Offline` (channel error/timeout; supabase-js keeps retrying), or `Local demo mode`.

## Limits and caveats

- **No auth:** channels are public. Anyone with the public key and a room id can join, read positions, or send spoofed messages. Positions are client-authoritative. That's fine for a visit demo, but don't put anything private in a room. For a locked-down version, enable private channels with Realtime Authorization (RLS on `realtime.messages`), which *does* require schema changes.
- **Supabase quotas:** Realtime limits apply per project (on the free plan, roughly 200 concurrent connections and 100 messages/s per client, plus a monthly message quota). Each visitor uses one connection, and when moving sends about 13 messages/s, which fan out to every peer in the room. Small groups (≲ 20–30 per room) are the sweet spot.
- **No persistence:** positions and presence exist only while people are connected.
- **Local demo mode** only syncs between tabs of the same browser profile on the same device.
- The map is hard-coded in `lib/map.ts`. Edit `ROOMS`, `WALLS`, and `BLOCKS` to change the layout.

## Project layout

```
app/page.tsx              landing (name + room form, CSS preview)
app/room/[id]/page.tsx    room route (validates id, renders the client-only Room)
components/Room.tsx       canvas loop, input, camera, UI chrome, who's-here
lib/realtime.ts           RoomTransport: SupabaseTransport + LocalTransport
lib/map.ts                map data, collision, spawn, name→color, room ids
lib/render.ts             offscreen map rendering + avatar drawing
lib/name.ts               name validation
```
