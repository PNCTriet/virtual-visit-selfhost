"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CHAT_MAX_CHARS, formatChatTime, type TranscriptLine } from "@/lib/chat";

type Nearby = { id: string; name: string };

function capDraft(value: string): string {
  const chars = [...value];
  return chars.length > CHAT_MAX_CHARS ? chars.slice(0, CHAT_MAX_CHARS).join("") : value;
}

/**
 * Compact proximity-chat panel. The scene decides who is close enough;
 * this view only shows the hint, the transcript, and the composer.
 */
export function ProximityChat({
  enabled,
  nearby,
  lines,
  open,
  notice,
  onOpen,
  onClose,
  onSend,
  onTyping,
}: {
  enabled: boolean;
  nearby: Nearby[];
  lines: TranscriptLine[];
  open: boolean;
  notice: string | null;
  onOpen: () => void;
  onClose: () => void;
  /** Returns true when the message was sent (the draft can be cleared). */
  onSend: (text: string) => boolean;
  onTyping: (typing: boolean) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onTyping(false);
        inputRef.current?.blur();
        onClose();
        return;
      }
      if (e.key !== "Enter" || e.shiftKey || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.isComposing || (e as KeyboardEvent & { keyCode?: number }).keyCode === 229) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!open && nearby.length === 0) return;
      e.preventDefault();
      if (!open) onOpen();
      else inputRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, open, nearby.length, onOpen, onClose, onTyping]);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  // Keep the composer above the on-screen keyboard without resizing the game.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const root = document.documentElement;
      if (!vv) {
        root.style.setProperty("--vv-kb", "0px");
        return;
      }
      const kb = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      root.style.setProperty("--vv-kb", `${Math.round(kb)}px`);
      root.style.setProperty("--vv-vis", `${Math.round(vv.height)}px`);
      // Keep the focused input in the visible viewport without fighting every keyboard frame.
      const input = inputRef.current;
      if (input && document.activeElement === input && kb > 40) {
        const rect = input.getBoundingClientRect();
        const pad = 12;
        if (rect.bottom > vv.offsetTop + vv.height - pad) {
          input.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    apply();
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      document.documentElement.style.removeProperty("--vv-kb");
      document.documentElement.style.removeProperty("--vv-vis");
    };
  }, [open]);

  if (!enabled) return null;

  const who = nearby.length === 1 ? nearby[0].name : nearby.length > 1 ? `${nearby.length} people` : "";
  const hint = nearby.length === 1 ? `Chat with ${nearby[0].name}` : `Chat · ${nearby.length} nearby`;

  const trySend = () => {
    if (composingRef.current) return;
    if (onSend(draft)) setDraft("");
  };

  return (
    <>
      {!open && nearby.length > 0 && (
        <button
          type="button"
          data-testid="chat-toggle"
          onClick={onOpen}
          className="vv-glass vv-focus absolute right-3 z-30 inline-flex h-11 max-w-[calc(100vw-168px)] items-center gap-2 rounded-full px-3.5 text-[14px] font-medium"
          style={{ bottom: "max(18px, env(safe-area-inset-bottom))" }}
        >
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#30d158]" />
          <span className="truncate">{hint}</span>
          <kbd className="hidden shrink-0 rounded-md bg-black/[0.05] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted md:inline">Enter</kbd>
        </button>
      )}

      {open && (
        <section
          data-testid="chat-panel"
          aria-label="Proximity chat"
          className="vv-glass absolute right-3 left-3 z-30 flex flex-col rounded-[22px] p-3 md:left-auto md:w-[340px]"
          style={{
            bottom: "calc(max(12px, env(safe-area-inset-bottom)) + var(--vv-kb, 0px))",
            maxHeight: "min(280px, calc(var(--vv-vis, 100dvh) - 96px))",
          }}
        >
          <header className="flex items-center gap-2 px-1 pb-2">
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${nearby.length ? "bg-[#30d158]" : "bg-[#c7c7cc]"}`} />
            <p className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">
              Nearby{who ? ` · ${who}` : ""}
            </p>
            <button
              type="button"
              onClick={() => { onTyping(false); inputRef.current?.blur(); onClose(); }}
              className="vv-focus grid size-7 shrink-0 place-items-center rounded-full text-[18px] leading-none text-muted hover:bg-black/[0.05]"
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div
            ref={logRef}
            data-testid="chat-log"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-1 py-1"
            style={{ maxHeight: "min(140px, calc(var(--vv-vis, 100dvh) * 0.28))" }}
          >
            {lines.length === 0 && (
              <p className="text-[13px] leading-snug text-muted">
                {nearby.length
                  ? "Say hello. Only people within a few steps can read this."
                  : "Walk closer to someone to start a chat."}
              </p>
            )}
            {lines.map((line) => line.kind === "system" ? (
              <p key={line.id} className="text-center text-[12px] text-muted">{line.text}</p>
            ) : line.kind === "react" ? (
              <p key={line.id} className="text-[13px] text-muted">
                <span className="font-semibold text-foreground">{line.name}</span>
                {line.self ? " (you)" : ""} reacted {line.emoji}
              </p>
            ) : (
              <div key={line.id} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[12px] font-semibold">
                    {line.name}
                    {line.self && <span className="font-medium text-muted"> (you)</span>}
                  </span>
                  <time dateTime={new Date(line.t).toISOString()} className="shrink-0 text-[11px] text-muted">{formatChatTime(line.t)}</time>
                </div>
                <p className="text-[14px] leading-snug break-words">{line.text}</p>
              </div>
            ))}
          </div>

          <form
            className="mt-2 flex shrink-0 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              trySend();
            }}
          >
            <label htmlFor={inputId} className="sr-only">Message</label>
            <input
              id={inputId}
              ref={inputRef}
              data-testid="chat-input"
              value={draft}
              enterKeyHint="send"
              autoComplete="off"
              autoCapitalize="sentences"
              placeholder={nearby.length ? "Message" : "No one nearby"}
              onChange={(e) => {
                const next = e.target.value;
                // During IME composition, mirror the native buffer without grapheme slicing.
                if (composingRef.current || (e.nativeEvent as InputEvent).isComposing) {
                  setDraft(next);
                  return;
                }
                setDraft(capDraft(next));
              }}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => {
                composingRef.current = false;
                setDraft(capDraft(e.currentTarget.value));
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.nativeEvent.isComposing || e.keyCode === 229 || composingRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onFocus={() => onTyping(true)}
              onBlur={() => onTyping(false)}
              className="h-10 min-w-0 flex-1 rounded-full bg-white px-3.5 text-[16px] text-foreground shadow-[inset_0_0_0_1px_var(--input)] outline-none placeholder:text-[#a1a1a6] focus-visible:shadow-[inset_0_0_0_1.5px_var(--ring),0_0_0_4px_rgba(0,113,227,0.18)]"
            />
            <button
              type="submit"
              data-testid="chat-send"
              disabled={!draft.trim() || composingRef.current}
              className="vv-focus h-10 shrink-0 rounded-full bg-foreground px-3.5 text-[13px] font-medium text-white hover:bg-foreground/85 disabled:bg-[#d2d2d7] disabled:text-[#6e6e73]"
            >
              Send
            </button>
          </form>
          {notice && <p role="status" className="px-1 pt-1.5 text-[12px] font-medium text-muted">{notice}</p>}
        </section>
      )}
    </>
  );
}
