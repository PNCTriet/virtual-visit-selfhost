"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatScoreMs, submitScore } from "@/lib/scores";
import { Leaderboard } from "./Leaderboard";

const CELLS = 9;
const START_LEN = 3;

type Phase = "idle" | "watch" | "input" | "won" | "lost";

function nextPattern(len: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(Math.floor(Math.random() * CELLS));
  return out;
}

export function MiniGame({
  roomId,
  playerName,
  open,
  onClose,
}: {
  roomId: string;
  playerName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pattern, setPattern] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [boardOpen, setBoardOpen] = useState(true);
  const [boardKey, setBoardKey] = useState(0);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) {
      clearTimers();
      setPhase("idle");
      setPattern([]);
      setStep(0);
      setLit(null);
      setMs(null);
      setSaved(false);
      setSaving(false);
    }
  }, [open]);

  const playWatch = (seq: number[]) => {
    clearTimers();
    setPhase("watch");
    setStep(0);
    let t = 350;
    seq.forEach((cell, i) => {
      timers.current.push(window.setTimeout(() => setLit(cell), t));
      timers.current.push(window.setTimeout(() => setLit(null), t + 420));
      t += 620;
      if (i === seq.length - 1) {
        timers.current.push(window.setTimeout(() => {
          setLit(null);
          setPhase("input");
        }, t));
      }
    });
  };

  const start = () => {
    const seq = nextPattern(START_LEN);
    setPattern(seq);
    setMs(null);
    setSaved(false);
    startedAt.current = performance.now();
    playWatch(seq);
  };

  const onCell = (i: number) => {
    if (phase !== "input") return;
    setLit(i);
    window.setTimeout(() => setLit((v) => (v === i ? null : v)), 160);
    if (pattern[step] !== i) {
      clearTimers();
      setPhase("lost");
      return;
    }
    const next = step + 1;
    if (next >= pattern.length) {
      // Grow the pattern; win when length reaches 6.
      if (pattern.length >= 6) {
        const elapsed = Math.round(performance.now() - startedAt.current);
        setMs(elapsed);
        setPhase("won");
        return;
      }
      const grown = [...pattern, Math.floor(Math.random() * CELLS)];
      setPattern(grown);
      playWatch(grown);
      return;
    }
    setStep(next);
  };

  const save = async () => {
    if (ms == null || saving || saved) return;
    setSaving(true);
    const ok = await submitScore(roomId, playerName, ms);
    setSaving(false);
    setSaved(ok);
    setBoardOpen(true);
    if (ok) setBoardKey((k) => k + 1);
  };

  const status = useMemo(() => {
    if (phase === "idle") return "Memorize the flashes, then tap the same order.";
    if (phase === "watch") return "Watch…";
    if (phase === "input") return `Your turn · ${step}/${pattern.length}`;
    if (phase === "lost") return "Missed it — try again.";
    if (phase === "won" && ms != null) return `Cleared in ${formatScoreMs(ms)}`;
    return "";
  }, [phase, step, pattern.length, ms]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-label="Pattern Memory">
      <div className="vv-glass flex w-full max-w-[420px] flex-col rounded-[24px] p-4">
        <header className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">Arcade · Pattern Memory</p>
            <p className="truncate text-[15px] font-medium">{status}</p>
          </div>
          <button type="button" onClick={onClose} className="vv-focus grid size-8 place-items-center rounded-full text-[18px] text-muted hover:bg-black/[0.05]" aria-label="Close game">×</button>
        </header>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: CELLS }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled={phase !== "input"}
              onClick={() => onCell(i)}
              className={`vv-focus aspect-square rounded-[18px] transition ${
                lit === i ? "bg-[#0071e3] shadow-[0_0_0_3px_rgba(0,113,227,0.35)]" : "bg-black/[0.06] hover:bg-black/[0.1] disabled:hover:bg-black/[0.06]"
              }`}
              aria-label={`Cell ${i + 1}`}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(phase === "idle" || phase === "lost" || phase === "won") && (
            <button type="button" onClick={start} className="vv-focus h-10 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/85">
              {phase === "idle" ? "Start" : "Play again"}
            </button>
          )}
          {phase === "won" && ms != null && (
            <button
              type="button"
              disabled={saving || saved}
              onClick={() => void save()}
              className="vv-focus h-10 rounded-full bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary/90 disabled:bg-[#d2d2d7]"
            >
              {saved ? "Saved" : saving ? "Saving…" : "Submit time"}
            </button>
          )}
          <button type="button" onClick={() => setBoardOpen((v) => !v)} className="vv-focus h-10 rounded-full bg-black/[0.06] px-4 text-[13px] font-medium hover:bg-black/[0.1]">
            {boardOpen ? "Hide ranks" : "Show ranks"}
          </button>
        </div>

        {boardOpen && (
          <div className="mt-3 rounded-[18px] bg-black/[0.03] p-3">
            <Leaderboard roomId={roomId} open variant="inline" title="Top clears" refreshKey={boardKey} />
          </div>
        )}
      </div>
    </div>
  );
}
