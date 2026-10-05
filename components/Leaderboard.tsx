"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTopScores, formatScoreMs, type GameScore } from "@/lib/scores";

export function Leaderboard({
  roomId,
  open,
  variant = "modal",
  onClose,
  title = "Arcade ranks",
  refreshKey = 0,
}: {
  roomId: string;
  open: boolean;
  /** compact = floating near arcade; inline = embed in another panel; modal = centered dialog */
  variant?: "compact" | "inline" | "modal";
  onClose?: () => void;
  title?: string;
  /** Bump to force a refetch (e.g. after submitting a score). */
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    void fetchTopScores(roomId).then((r) => { setRows(r); setLoading(false); });
  }, [roomId]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload, refreshKey]);

  if (!open) return null;

  const body = (
    <>
      <header className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">{title}</p>
        <button type="button" onClick={reload} className="vv-focus rounded-full px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10">
          Refresh
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="vv-focus grid size-7 place-items-center rounded-full text-[16px] text-muted hover:bg-black/[0.05]" aria-label="Close">×</button>
        )}
      </header>
      {loading && rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">No clears yet. Be the first on the board.</p>
      ) : (
        <ol className="mt-3 grid gap-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-baseline gap-2 text-[13px]">
              <span className="w-5 shrink-0 font-semibold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{r.player_name}</span>
              <span className="shrink-0 tabular-nums text-muted">{formatScoreMs(r.ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );

  if (variant === "inline") return <div>{body}</div>;

  if (variant === "compact") {
    return (
      <aside aria-label="Leaderboard" className="vv-glass absolute top-[72px] left-3 z-20 w-[min(220px,calc(100vw-24px))] rounded-[22px] p-3.5">
        {body}
      </aside>
    );
  }

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/45 p-4" role="dialog" aria-label="Leaderboard">
      <div className="vv-glass w-full max-w-[360px] rounded-[24px] p-5">{body}</div>
    </div>
  );
}
