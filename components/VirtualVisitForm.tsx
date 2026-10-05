"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAME_MAX_LENGTH, validateName } from "@/lib/name";
import { normalizeRoomId } from "@/lib/map";

type Props = {
  name?: string;
  onNameChange?: (name: string) => void;
  initialRoom?: string;
};

export function VirtualVisitForm({ name: controlled, onNameChange, initialRoom = "lobby" }: Props) {
  const id = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [own, setOwn] = useState("");
  const name = controlled ?? own;
  const setName = (v: string) => (onNameChange ? onNameChange(v) : setOwn(v));
  const [room, setRoom] = useState(initialRoom);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setLoading(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const invalid = validateName(name);
    if (invalid) {
      setError(invalid);
      inputRef.current?.focus();
      return;
    }
    const roomId = normalizeRoomId(room) || "lobby";
    setError(null);
    setLoading(true);
    // The name travels via sessionStorage, so shared room links don't carry it.
    sessionStorage.setItem("vv-name", name.trim());
    router.push(`/room/${roomId}`);
  }

  const inputId = `${id}-name`, roomInputId = `${id}-room`, errorId = `${id}-error`, hintId = `${id}-hint`;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={loading} className="w-full">
      <div className="flex items-end justify-between gap-4 px-1">
        <label htmlFor={inputId} className="text-[15px] font-semibold tracking-[-0.01em]">Your name</label>
        <span aria-hidden className="relative mr-1 inline-flex items-end gap-1 text-primary">
          <span className="vv-hand -rotate-3 text-[19px] whitespace-nowrap sm:text-[21px]">no sign-up needed</span>
          <svg viewBox="0 0 40 34" className="vv-arrow-draw -mb-3 h-[26px] w-[30px] shrink-0">
            <path pathLength={1} d="M4 4 C 18 4, 30 10, 32 26" />
            <path pathLength={1} d="M26 21 L 32 27 L 37 20" />
          </svg>
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
          id={inputId}
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          spellCheck={false}
          placeholder="e.g. Ivan"
          value={name}
          disabled={loading}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId} ${errorId}`}
          onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
          className="vv-input min-w-0 sm:flex-1"
        />
        <button type="submit" disabled={loading} data-state={loading ? "loading" : "ready"} className="vv-btn w-full sm:w-auto">
          {loading ? (
            <>
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" />
              Entering room...
            </>
          ) : (
            <>Enter Virtual Visit <span aria-hidden className="vv-arrow">→</span></>
          )}
        </button>
      </div>

      <p id={hintId} className="mt-3 px-1 text-[13px] text-muted">
        Shown above your avatar. Up to {NAME_MAX_LENGTH} characters.
      </p>
      <div id={errorId} aria-live="polite" className="min-h-7 px-1 pt-1.5">
        {error && <p className="text-[15px] font-medium text-danger">{error}</p>}
      </div>

      <div className="mt-2 flex items-center gap-3 px-1 text-[15px]">
        <label htmlFor={roomInputId} className="shrink-0 text-muted">Room</label>
        <div className="relative flex-1">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">#</span>
          <input
            id={roomInputId}
            name="room"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            value={room}
            disabled={loading}
            onChange={(e) => setRoom(e.target.value)}
            className="vv-input h-11 pl-8 text-[15px]"
          />
        </div>
      </div>
    </form>
  );
}
