"use client";

import { useEffect, useMemo, useState } from "react";
import type { CinemaMsg } from "@/lib/realtime";
import { parseYouTubeId, youtubeEmbedUrl } from "@/lib/youtube";

export function CinemaPanel({
  open,
  state,
  selfId,
  onClose,
  onPublish,
}: {
  open: boolean;
  state: CinemaMsg | null;
  selfId: string;
  onClose: () => void;
  onPublish: (next: CinemaMsg) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const videoId = useMemo(() => (state?.url ? parseYouTubeId(state.url) : null), [state?.url]);
  const start = useMemo(() => {
    if (!state?.playing) return Math.floor(state?.tMedia ?? 0);
    const elapsed = Math.max(0, (Date.now() - state.tWall) / 1000);
    return Math.floor((state.tMedia ?? 0) + elapsed);
  }, [state]);

  if (!open) return null;

  const publish = (url: string, playing: boolean, tMedia: number) => {
    onPublish({ url, playing, tMedia, tWall: Date.now(), by: selfId });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-label="Cinema">
      <div className="vv-glass flex max-h-[min(92dvh,720px)] w-full max-w-[880px] flex-col overflow-hidden rounded-[24px]">
        <header className="flex items-center gap-2 px-4 pt-3 pb-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">Cinema</p>
          <button type="button" onClick={onClose} className="vv-focus grid size-8 place-items-center rounded-full text-[18px] text-muted hover:bg-black/[0.05]" aria-label="Close cinema">×</button>
        </header>

        <div className="relative mx-3 aspect-video overflow-hidden rounded-[16px] bg-black">
          {videoId ? (
            <iframe
              key={`${videoId}-${state?.playing ? "p" : "s"}-${start}`}
              title="Shared YouTube"
              src={youtubeEmbedUrl(videoId, { start, autoplay: !!state?.playing })}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />
          ) : (
            <div className="grid size-full place-items-center px-6 text-center text-[14px] text-white/70">
              Paste a YouTube link to start the shared screen.
            </div>
          )}
        </div>

        <form
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            const id = parseYouTubeId(draft);
            if (!id) { setError("Use a valid YouTube URL or video id."); return; }
            setError(null);
            publish(`https://www.youtube.com/watch?v=${id}`, true, 0);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); if (error) setError(null); }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="h-10 min-w-0 flex-1 rounded-full bg-white px-3.5 text-[15px] shadow-[inset_0_0_0_1px_var(--input)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ring),0_0_0_4px_rgba(0,113,227,0.18)]"
          />
          <button type="submit" className="vv-focus h-10 shrink-0 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/85">
            Play
          </button>
          {state?.url && (
            <button
              type="button"
              onClick={() => {
                if (state.playing) {
                  const elapsed = Math.max(0, (Date.now() - state.tWall) / 1000);
                  publish(state.url, false, state.tMedia + elapsed);
                } else {
                  publish(state.url, true, state.tMedia);
                }
              }}
              className="vv-focus h-10 shrink-0 rounded-full bg-black/[0.06] px-4 text-[13px] font-medium hover:bg-black/[0.1]"
            >
              {state.playing ? "Pause" : "Resume"}
            </button>
          )}
        </form>
        {error && <p className="px-4 pb-3 text-[12px] font-medium text-danger">{error}</p>}
        <p className="px-4 pb-3 text-[12px] text-muted">Anyone in the cinema can change the video (last write wins). Leaving the zone mutes this screen.</p>
      </div>
    </div>
  );
}
