"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { MAP_H, MAP_W, collides, colorFor, spawnPoint } from "@/lib/map";
import { drawAvatar, renderMap } from "@/lib/render";
import { createTransport, realtimeConfigured, type PeerMeta, type PeerPos, type TransportKind, type TransportStatus } from "@/lib/realtime";
import { validateName } from "@/lib/name";

const SPEED = 230; // px/s
const SEND_EVERY = 75; // ms → ~13 updates/s while moving
const HEARTBEAT = 2000; // ms, keeps idle avatars alive for newcomers and the stale check
const STALE_AFTER = 12000; // ms without updates → remove

type Remote = PeerPos & { rx: number; ry: number; dir: number; bob: number; seen: number };

function readName(): string | null {
  const q = new URLSearchParams(window.location.search).get("name");
  const raw = (q ?? sessionStorage.getItem("vv-name") ?? "").trim();
  if (validateName(raw)) return null;
  sessionStorage.setItem("vv-name", raw);
  return raw;
}

export function Room({ roomId }: { roomId: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Client-only component (loaded with ssr:false), so sessionStorage is available here.
  const [me] = useState<PeerMeta | null>(() => {
    const name = readName();
    return name ? { id: crypto.randomUUID(), name, color: colorFor(name) } : null;
  });
  const kind: TransportKind = realtimeConfigured ? "supabase" : "local";
  const [status, setStatus] = useState<TransportStatus>("connecting");
  const [people, setPeople] = useState<{ id: string; name: string; color: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    if (!me) router.replace(`/?room=${encodeURIComponent(roomId)}`);
  }, [me, roomId, router]);

  useEffect(() => {
    if (!me) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let map = renderMap(dpr);
    let vw = 0, vh = 0, zoom = 1;
    const resize = () => {
      vw = canvas.clientWidth; vh = canvas.clientHeight;
      zoom = vw < 640 ? 0.8 : 1;
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const self = { ...spawnPoint(), dir: Math.PI / 2, bob: 0 };
    const keys = new Set<string>();
    let target: { x: number; y: number } | null = null;
    const remotes = new Map<string, Remote>();
    let lastSent = 0, lastSentX = NaN, lastSentY = NaN, forceSend = true;

    const syncPeople = () => setPeople([...remotes.values()].map(({ id, name, color }) => ({ id, name, color })).sort((a, b) => a.name.localeCompare(b.name)));

    const transport = createTransport(roomId);
    transport.connect(me, {
      onStatus: setStatus,
      onJoin: () => { forceSend = true; },
      onLeave: (id) => { if (remotes.delete(id)) syncPeople(); },
      onPos: (p) => {
        const now = performance.now();
        const r = remotes.get(p.id);
        if (!r) {
          remotes.set(p.id, { ...p, rx: p.x, ry: p.y, dir: Math.PI / 2, bob: 0, seen: now });
          syncPeople();
        } else {
          if (p.name !== r.name) { r.name = p.name; syncPeople(); }
          Object.assign(r, { x: p.x, y: p.y, t: p.t, color: p.color, seen: now });
        }
      },
    });

    const MOVE_KEYS: Record<string, [number, number]> = {
      arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!(k in MOVE_KEYS)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      if (e.type === "keydown") { keys.add(k); target = null; } else keys.delete(k);
    };
    const onBlur = () => keys.clear();
    const cam = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      target = { x: (e.clientX - rect.left) / zoom + cam.x, y: (e.clientY - rect.top) / zoom + cam.y };
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", onPointer);

    // Read-only snapshot for QA / debugging.
    (window as unknown as { __vv: () => unknown }).__vv = () => ({
      self: { x: Math.round(self.x), y: Math.round(self.y) },
      peers: [...remotes.values()].map((r) => ({ id: r.id, name: r.name, x: Math.round(r.rx), y: Math.round(r.ry) })),
      kind: transport.kind,
    });

    let raf = 0, last = performance.now(), blocked = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Input → velocity
      let ix = 0, iy = 0;
      for (const k of keys) { const v = MOVE_KEYS[k]; ix += v[0]; iy += v[1]; }
      if (!ix && !iy && target) {
        const dx = target.x - self.x, dy = target.y - self.y, d = Math.hypot(dx, dy);
        if (d < 4) target = null; else { ix = dx / d; iy = dy / d; }
      }
      const len = Math.hypot(ix, iy);
      let moving = false;
      if (len > 0) {
        ix /= len; iy /= len;
        self.dir = Math.atan2(iy, ix);
        const nx = self.x + ix * SPEED * dt, ny = self.y + iy * SPEED * dt;
        // Axis-separated moves so you slide along walls instead of sticking.
        const okX = !collides(nx, self.y), okY = !collides(okX ? nx : self.x, ny);
        if (okX) self.x = nx;
        if (okY) self.y = ny;
        moving = okX || okY;
        if (!moving && target) { blocked += dt; if (blocked > 0.25) { target = null; blocked = 0; } } else blocked = 0;
      }
      self.bob = moving ? self.bob + dt * 14 : 0;

      // Network: throttle while moving, heartbeat while idle.
      const changed = Math.abs(self.x - lastSentX) > 0.5 || Math.abs(self.y - lastSentY) > 0.5;
      if ((changed && now - lastSent >= SEND_EVERY) || now - lastSent >= HEARTBEAT || forceSend) {
        transport.send({ ...me, x: Math.round(self.x * 10) / 10, y: Math.round(self.y * 10) / 10, t: Date.now() });
        lastSent = now; lastSentX = self.x; lastSentY = self.y; forceSend = false;
      }

      // Remotes: exponential smoothing toward the latest position; drop stale ones.
      const k = 1 - Math.exp(-dt * 12);
      let removed = false;
      for (const [id, r] of remotes) {
        if (now - r.seen > STALE_AFTER) { remotes.delete(id); removed = true; continue; }
        const dx = r.x - r.rx, dy = r.y - r.ry, d = Math.hypot(dx, dy);
        if (d > 400) { r.rx = r.x; r.ry = r.y; } else { r.rx += dx * k; r.ry += dy * k; }
        if (d > 1) { r.dir = Math.atan2(dy, dx); r.bob += dt * 14; } else r.bob = 0;
      }
      if (removed) syncPeople();

      // Camera follows; centred when the map is smaller than the viewport.
      const sw = vw / zoom, sh = vh / zoom;
      cam.x = MAP_W <= sw ? (MAP_W - sw) / 2 : Math.max(0, Math.min(MAP_W - sw, self.x - sw / 2));
      cam.y = MAP_H <= sh ? (MAP_H - sh) / 2 : Math.max(0, Math.min(MAP_H - sh, self.y - sh / 2));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#f5f5f7";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cam.x * dpr * zoom, -cam.y * dpr * zoom);
      ctx.drawImage(map, 0, 0, MAP_W, MAP_H);
      if (target) {
        ctx.strokeStyle = "rgba(0,113,227,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(target.x, target.y, 8, 0, Math.PI * 2); ctx.stroke();
      }
      const all = [...remotes.values()].map((r) => ({ x: r.rx, y: r.ry, name: r.name, color: r.color, dir: r.dir, bob: r.bob }));
      all.push({ x: self.x, y: self.y, name: me.name, color: me.color, dir: self.dir, bob: self.bob, self: true } as never);
      all.sort((a, b) => a.y - b.y);
      for (const a of all) drawAvatar(ctx, a, now);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onDpr = () => { map = renderMap(Math.min(window.devicePixelRatio || 1, 2)); };
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    mq.addEventListener("change", onDpr);
    const onHide = () => transport.disconnect();
    window.addEventListener("pagehide", onHide);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mq.removeEventListener("change", onDpr);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onHide);
      canvas.removeEventListener("pointerdown", onPointer);
      transport.disconnect();
    };
  }, [me, roomId]);

  const everyone = useMemo(() => (me ? [{ id: me.id, name: me.name, color: me.color, self: true }, ...people] : []), [me, people]);

  if (!me) return null;

  const badge =
    kind === "local"
      ? { text: "Local demo mode", dot: "bg-[#ff9f0a]", title: "No realtime service configured: only tabs in this browser see each other." }
      : status === "live"
        ? { text: "Live", dot: "bg-[#30d158]", title: "Connected to the realtime room." }
        : status === "error"
          ? { text: "Offline", dot: "bg-[#ff3b30]", title: "Could not connect to the realtime room." }
          : { text: "Connecting…", dot: "bg-[#c7c7cc]", title: "Connecting to the realtime room." };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#f5f5f7]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none outline-none"
        role="img"
        aria-label={`Room ${roomId}: ${everyone.length} ${everyone.length === 1 ? "person" : "people"} here. Move with WASD or the arrow keys, or click to walk.`}
      />

      <header className="pointer-events-none absolute inset-x-0 top-3 z-10 px-3">
        <div className="vv-glass pointer-events-auto mx-auto flex h-12 max-w-[1240px] items-center gap-2 rounded-full pr-1.5 pl-4 sm:gap-3 sm:pl-5">
          <Link href="/" aria-label="HOWL STUDIO home" className="vv-focus shrink-0 rounded-full"><Logo compact /></Link>
          <span aria-hidden className="hidden h-4 w-px bg-black/10 sm:block" />
          <span className="truncate text-[13px] font-medium text-muted">#{roomId}</span>
          <div className="flex-1" />
          <span title={badge.title} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] font-medium text-muted">
            <span aria-hidden className={`size-1.5 rounded-full ${badge.dot}`} />
            <span role="status">{badge.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            aria-controls="whos-here"
            className="vv-focus inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-foreground hover:bg-black/[0.05] lg:hidden"
          >
            {everyone.length} here
          </button>
          <button
            type="button"
            onClick={async () => {
              try { await navigator.clipboard.writeText(`${location.origin}/room/${roomId}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
            }}
            className="vv-focus hidden h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-primary hover:bg-primary/10 sm:inline-flex"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <Link href="/" className="vv-focus inline-flex h-9 shrink-0 items-center rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/85">
            Leave
          </Link>
        </div>
      </header>

      <aside
        id="whos-here"
        aria-label="Who's here"
        className={`vv-glass absolute top-[76px] right-3 z-10 w-[220px] rounded-[22px] p-4 sm:right-[max(12px,calc((100vw-1240px)/2))] ${listOpen ? "block" : "hidden"} lg:block`}
      >
        <p className="text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">Who&apos;s here · {everyone.length}</p>
        <ul className="mt-3 grid max-h-[40vh] gap-2 overflow-auto">
          {everyone.map((p) => (
            <li key={p.id} className="flex min-w-0 items-center gap-2.5 text-[14px]">
              <span aria-hidden className="size-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
              {"self" in p && <span className="shrink-0 text-[12px] text-muted">(you)</span>}
            </li>
          ))}
        </ul>
      </aside>

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-10 flex justify-center px-4">
        <p className="vv-glass rounded-full px-4 py-2 text-center text-[13px] text-muted">
          <span className="hidden sm:inline"><kbd className="font-sans font-semibold text-foreground">WASD</kbd> or <kbd className="font-sans font-semibold text-foreground">arrow keys</kbd> to move · click to walk</span>
          <span className="sm:hidden">Tap anywhere to walk</span>
        </p>
      </div>
    </div>
  );
}

