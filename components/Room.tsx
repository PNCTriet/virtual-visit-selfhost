"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { Joystick } from "./Joystick";
import { NamePrompt } from "./NamePrompt";
import { ProximityChat } from "./ProximityChat";
import { CinemaPanel } from "./CinemaPanel";
import { Leaderboard } from "./Leaderboard";
import { MiniGame } from "./MiniGame";
import { createTransport, realtimeConfigured, type CinemaMsg, type PeerMeta, type TransportKind, type TransportStatus } from "@/lib/realtime";
import { characterFor, colorFor } from "@/lib/room";
import { validateName } from "@/lib/name";
import { REACT_EMOJIS, type SendChatReason, type TranscriptLine } from "@/lib/chat";
import type { JoystickInput, OfficeHandle, Person, ZoneFlags } from "@/lib/game/office";

function readName(): string | null {
  const q = new URLSearchParams(window.location.search).get("name");
  const raw = (q ?? sessionStorage.getItem("vv-name") ?? "").trim();
  if (validateName(raw)) return null;
  sessionStorage.setItem("vv-name", raw);
  return raw;
}

/** Character head-and-shoulders from the sprite atlas (idle, facing down). */
function UpArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReactionsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10.2" r="1" fill="currentColor" />
      <circle cx="15" cy="10.2" r="1" fill="currentColor" />
      <path d="M8.6 14.1c.85 1.35 2 2 3.4 2s2.55-.65 3.4-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CharacterIcon({ character, size = 22 }: { character: number; size?: number }) {
  const s = size / 16;
  return (
    <span
      aria-hidden
      className="vv-char shrink-0"
      style={{
        width: size, height: size,
        backgroundSize: `${864 * s}px ${90 * s}px`,
        backgroundPosition: `-${(4 * character * 18 + 1) * s}px -${(4 * 18 + 1) * s}px`,
      }}
    />
  );
}

export function Room({ roomId }: { roomId: string }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const joystick = useRef<JoystickInput>({ x: 0, y: 0 });
  const officeRef = useRef<OfficeHandle | null>(null);
  const chatOpenRef = useRef(false);
  const nearRef = useRef<Map<string, string>>(new Map());
  const zonesRef = useRef<ZoneFlags>({ cinema: false, arcade: false, leaderboard: false });
  // Client-only component (loaded with ssr:false), so sessionStorage is available here.
  const [me, setMe] = useState<PeerMeta | null>(() => {
    const name = readName();
    return name ? { id: crypto.randomUUID(), name, color: colorFor(name) } : null;
  });
  // Hidden recording mode for the landing clips; see `demo` in lib/game/office.ts.
  const [demo] = useState<"wide" | "phone" | null>(() => {
    const d = new URLSearchParams(window.location.search).get("demo");
    return d === "wide" || d === "phone" ? d : null;
  });
  const kind: TransportKind = realtimeConfigured ? "supabase" : "local";
  const [status, setStatus] = useState<TransportStatus>("connecting");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoStick, setDemoStick] = useState<JoystickInput | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [nearby, setNearby] = useState<Person[]>([]);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [zones, setZones] = useState<ZoneFlags>({ cinema: false, arcade: false, leaderboard: false });
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [cinemaState, setCinemaState] = useState<CinemaMsg | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [boardModal, setBoardModal] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);

  // Drop the transcript when the room or the local player changes. Adjusting state
  // during render is the supported way to react to a new id without an effect.
  const chatKey = `${roomId}:${me?.id ?? ""}`;
  const [chatScope, setChatScope] = useState(chatKey);
  if (chatScope !== chatKey) {
    setChatScope(chatKey);
    setLines([]);
    setNearby([]);
    setChatOpen(false);
    setChatNotice(null);
    setCinemaOpen(false);
    setCinemaState(null);
    setGameOpen(false);
    setBoardModal(false);
    setZones({ cinema: false, arcade: false, leaderboard: false });
  }

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => { zonesRef.current = zones; }, [zones]);

  useEffect(() => {
    if (!chatNotice) return;
    const id = window.setTimeout(() => setChatNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [chatNotice]);

  // Leave cinema / mute when walking out of the zone.
  useEffect(() => {
    if (!zones.cinema && cinemaOpen) setCinemaOpen(false);
  }, [zones.cinema, cinemaOpen]);

  useEffect(() => {
    officeRef.current?.setLocked(cinemaOpen || gameOpen || boardModal);
  }, [cinemaOpen, gameOpen, boardModal]);

  useEffect(() => {
    if (!me) return;
    nearRef.current = new Map();
    let handle: { destroy(): void } | null = null;
    let cancelled = false;
    const transport = createTransport(roomId);
    import("@/lib/game/office").then(({ startOffice }) => startOffice({
      parent: screenRef.current!, me, transport, joystick, demo, onDemoStick: setDemoStick,
      onPeople: setPeople,
      onStatus: setStatus,
      onNearby: (people) => {
        setNearby(people);
        const prev = nearRef.current;
        const next = new Map(people.map((p) => [p.id, p.name]));
        if (chatOpenRef.current) {
          const left: TranscriptLine[] = [];
          for (const [id, name] of prev) {
            if (!next.has(id)) left.push({ kind: "system", id: `left-${id}-${Date.now()}`, text: `${name} left`, t: Date.now() });
          }
          if (left.length) setLines((ls) => [...ls, ...left].slice(-80));
        }
        nearRef.current = next;
      },
      onChat: (line) => {
        const msg: TranscriptLine = { kind: "msg", id: line.id, name: line.name, text: line.text, t: line.t, self: line.self };
        setLines((ls) => [...ls, msg].slice(-80));
      },
      onReact: (line) => {
        const msg: TranscriptLine = { kind: "react", id: line.id, name: line.name, emoji: line.emoji, t: line.t, self: line.self };
        setLines((ls) => [...ls, msg].slice(-80));
      },
      onZones: setZones,
      onCinema: (m) => {
        setCinemaState(m);
        if (zonesRef.current.cinema) setCinemaOpen(true);
      },
    })).then((h) => {
      if (cancelled) h.destroy(); else { handle = h; officeRef.current = h; setLoading(false); }
    }).catch(() => setStatus("error"));
    const onHide = () => transport.disconnect();
    window.addEventListener("pagehide", onHide);
    return () => {
      cancelled = true;
      officeRef.current = null;
      window.removeEventListener("pagehide", onHide);
      if (handle) handle.destroy(); else transport.disconnect();
    };
  }, [me, roomId, demo]);

  const everyone = useMemo(
    () => (me ? [{ id: me.id, name: me.name, character: characterFor(me.name), self: true }, ...people] : []),
    [me, people],
  );

  if (!me) {
    return (
      <NamePrompt
        roomId={roomId}
        onSubmit={(name) => { sessionStorage.setItem("vv-name", name); setMe({ id: crypto.randomUUID(), name, color: colorFor(name) }); }}
      />
    );
  }

  const badge =
    kind === "local"
      ? { text: "Local demo mode", dot: "bg-[#ff9f0a]", title: "No realtime service configured: only tabs in this browser see each other." }
      : status === "live"
        ? { text: "Live", dot: "bg-[#30d158]", title: "Connected to the realtime room." }
        : status === "error"
          ? { text: "Offline", dot: "bg-[#ff3b30]", title: "Could not connect to the realtime room." }
          : { text: "Connecting…", dot: "bg-[#c7c7cc]", title: "Connecting to the realtime room." };

  const sendChat = (text: string) => {
    const res = officeRef.current?.sendChat(text) ?? { ok: false as const, reason: "offline" as const };
    if (res.ok) { setChatNotice(null); return true; }
    const copy: Record<SendChatReason, string | null> = {
      empty: null,
      rate: "Slow down a moment.",
      nobody: "No one is close enough to hear you.",
      offline: "Can't reach the room right now.",
    };
    setChatNotice(copy[res.reason]);
    return false;
  };

  const list = (
    <>
      <p className="text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">Who&apos;s here · {everyone.length}</p>
      <ul className="mt-3 grid max-h-[50vh] gap-2.5 overflow-auto">
        {everyone.map((p) => (
          <li key={p.id} className="flex min-w-0 items-center gap-2.5 text-[14px]">
            <CharacterIcon character={p.character} />
            <span className="truncate">{p.name}</span>
            {"self" in p && <span className="shrink-0 text-[12px] text-muted">(you)</span>}
          </li>
        ))}
      </ul>
    </>
  );

  const modalOpen = cinemaOpen || gameOpen || boardModal;
  const showBoardNear = (zones.leaderboard || zones.arcade) && !modalOpen && !demo && !loading;

  return (
    <div className="vv-room fixed inset-0 overflow-hidden bg-[#1d1d1f]">
      {/* Game fills the whole viewport; UI floats on top. */}
      <div
        ref={screenRef}
        className="absolute inset-0 touch-none"
        role="application"
        aria-label={`Room ${roomId}: ${everyone.length} ${everyone.length === 1 ? "person" : "people"} here. Move with WASD or the arrow keys. Space to jump.`}
      />
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-[13px] text-white/70">Entering room…</div>
      )}
      {!demo && !loading && !modalOpen && (
        <div
          className="absolute z-10"
          style={{ left: "max(20px, env(safe-area-inset-left))", bottom: "max(18px, env(safe-area-inset-bottom))" }}
        >
          <Joystick display={demoStick} onChange={(v) => { joystick.current = v; }} />
        </div>
      )}
      {!demo && !loading && !modalOpen && (
        <button
          type="button"
          data-testid="jump-btn"
          onClick={() => { officeRef.current?.jump(); }}
          className="vv-glass vv-focus absolute z-20 grid size-14 place-items-center rounded-full text-foreground"
          style={{ right: "max(16px, env(safe-area-inset-right))", bottom: "max(18px, env(safe-area-inset-bottom))" }}
          aria-label="Jump"
        >
          <UpArrowIcon />
        </button>
      )}
      {(demo || loading) && (
        <div
          className="absolute z-10"
          style={{ left: "max(20px, env(safe-area-inset-left))", bottom: "max(18px, env(safe-area-inset-bottom))" }}
        >
          <Joystick display={demoStick} onChange={(v) => { joystick.current = v; }} />
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="vv-glass pointer-events-auto relative mx-auto flex h-12 max-w-[1240px] items-center gap-2 rounded-full pr-1.5 pl-4 sm:gap-3 sm:pl-5">
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
            aria-controls="whos-here-pop"
            className="vv-focus inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-foreground hover:bg-black/[0.05] xl:hidden"
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
          {listOpen && (
            <aside id="whos-here-pop" aria-label="Who's here" className="vv-glass absolute top-[108px] right-0 w-[230px] rounded-[22px] p-4 xl:hidden">
              {list}
            </aside>
          )}
        </div>
      </header>

      <aside
        aria-label="Who's here"
        className="vv-glass absolute right-3 z-10 hidden w-[230px] rounded-[22px] p-4 xl:block"
        style={{ top: "calc(max(12px, env(safe-area-inset-top)) + 120px)" }}
      >
        {list}
      </aside>

      <Leaderboard roomId={roomId} open={showBoardNear} variant="compact" title="Arcade ranks" />

      {!demo && !loading && !modalOpen && (
        <div
          className="absolute z-20"
          style={{
            top: "calc(max(12px, env(safe-area-inset-top)) + 56px)",
            right: "max(12px, env(safe-area-inset-right))",
          }}
        >
          <button
            type="button"
            data-testid="react-btn"
            onClick={() => setReactOpen((v) => !v)}
            className="vv-glass vv-focus grid size-11 place-items-center rounded-full text-foreground"
            aria-expanded={reactOpen}
            aria-label="Reactions"
          >
            <ReactionsIcon />
          </button>
          {reactOpen && (
            <div className="vv-glass absolute top-0 right-[calc(100%+8px)] flex max-w-[calc(100vw-80px)] gap-1 overflow-x-auto rounded-full p-1.5">
              {REACT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="vv-focus grid size-9 shrink-0 place-items-center rounded-full text-[18px] hover:bg-black/[0.06]"
                  onClick={() => {
                    officeRef.current?.sendReact(emoji);
                    setReactOpen(false);
                  }}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!demo && !loading && !modalOpen && (zones.cinema || zones.arcade || zones.leaderboard) && (
        <div className="vv-zone-prompt absolute left-1/2 z-20 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2">
          {zones.cinema && (
            <button
              type="button"
              data-testid="zone-cinema"
              onClick={() => setCinemaOpen(true)}
              className="vv-glass vv-focus h-11 rounded-full px-3.5 text-[14px] font-medium"
            >
              Open cinema
            </button>
          )}
          {zones.arcade && (
            <button
              type="button"
              data-testid="zone-arcade"
              onClick={() => setGameOpen(true)}
              className="vv-glass vv-focus h-11 rounded-full px-3.5 text-[14px] font-medium"
            >
              Play Pattern Memory
            </button>
          )}
          {zones.leaderboard && !zones.arcade && (
            <button
              type="button"
              data-testid="zone-leaderboard"
              onClick={() => setBoardModal(true)}
              className="vv-glass vv-focus h-11 rounded-full px-3.5 text-[14px] font-medium"
            >
              View ranks
            </button>
          )}
        </div>
      )}

      <p className={`vv-glass pointer-events-none absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 rounded-full px-4 py-2 text-center text-[13px] text-muted md:block ${chatOpen || modalOpen ? "md:hidden" : ""}`}>
        <kbd className="font-sans font-semibold text-foreground">WASD</kbd> walk · <kbd className="font-sans font-semibold text-foreground">Space</kbd> jump
      </p>

      <ProximityChat
        enabled={!demo && !loading && !modalOpen}
        nearby={nearby}
        lines={lines}
        open={chatOpen}
        notice={chatNotice}
        onOpen={() => setChatOpen(true)}
        onClose={() => { setChatOpen(false); setChatNotice(null); }}
        onSend={sendChat}
        onTyping={(v) => { officeRef.current?.setTyping(v); if (v) joystick.current = { x: 0, y: 0 }; }}
      />

      <CinemaPanel
        open={cinemaOpen && !demo}
        state={cinemaState}
        selfId={me.id}
        onClose={() => setCinemaOpen(false)}
        onPublish={(next) => {
          setCinemaState(next);
          officeRef.current?.sendCinema(next);
        }}
      />

      <MiniGame
        roomId={roomId}
        playerName={me.name}
        open={gameOpen && !demo}
        onClose={() => setGameOpen(false)}
      />

      <Leaderboard
        roomId={roomId}
        open={boardModal && !demo}
        variant="modal"
        title="Arcade ranks"
        onClose={() => setBoardModal(false)}
      />
    </div>
  );
}
