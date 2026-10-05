"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { NAME_MAX_LENGTH, validateName } from "@/lib/name";

/** Shown when someone opens a room without a name yet (e.g. straight from the landing button or a shared link). */
export function NamePrompt({ roomId, onSubmit }: { roomId: string; onSubmit: (name: string) => void }) {
  const id = useId();
  const composingRef = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 grid place-items-center bg-[#f5f5f7] px-5">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (composingRef.current) return;
          const invalid = validateName(name);
          if (invalid) return setError(invalid);
          onSubmit(name.trim());
        }}
        className="vv-glass w-full max-w-[420px] rounded-[28px] p-6 sm:p-8"
      >
        <p className="text-[13px] font-medium text-muted">#{roomId}</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em]">What&apos;s your name?</h1>
        <p className="mt-1 text-[15px] text-muted">Shown above your avatar. No sign-up needed.</p>
        <label htmlFor={`${id}-name`} className="sr-only">Your name</label>
        <input
          id={`${id}-name`}
          autoFocus
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          spellCheck={false}
          placeholder="e.g. Ivan"
          value={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-err`}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setName(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (e.nativeEvent.isComposing || e.keyCode === 229 || composingRef.current) {
              e.preventDefault();
            }
          }}
          className="vv-input mt-5"
        />
        <p id={`${id}-err`} aria-live="polite" className="min-h-6 px-1 pt-1.5 text-[14px] font-medium text-danger">{error}</p>
        <button type="submit" className="vv-btn mt-1 w-full">Enter room <span aria-hidden className="vv-arrow">→</span></button>
        <p className="mt-4 text-center text-[13px] text-muted">
          Up to {NAME_MAX_LENGTH} characters · <Link href="/" className="vv-focus rounded text-primary">Back</Link>
        </p>
      </form>
    </div>
  );
}
