/** HOWL STUDIO wordmark: glossy brand tile + text. Pure CSS, no image request. `compact` hides the text on phones. */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span aria-hidden className="vv-brand-icon size-7 shrink-0" />
      <span className={`text-[14px] leading-none tracking-[0.12em] ${compact ? "hidden sm:inline" : ""}`}>
        <span className="font-semibold">HOWL</span> <span className="text-muted">STUDIO</span>
      </span>
    </span>
  );
}
