/**
 * Decorative, CSS-only preview of a 2D virtual space: a window with a floor plan,
 * a few visitors, and "you" (the typed name). Hidden from assistive tech.
 */
const VISITORS = [
  { x: "79%", y: "22%", c: "#ff9f0a", i: "A" },
  { x: "60%", y: "64%", c: "#bf5af2", i: "M" },
  { x: "82%", y: "80%", c: "#ff375f", i: "L" },
  { x: "20%", y: "78%", c: "#30d158", i: "K" },
];

export function SpacePreview({ name }: { name: string }) {
  const label = name.trim() || "You";
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[560px] select-none">
      <div className="rounded-[34px] bg-tile p-2.5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.28)] sm:p-3">
        {/* Window chrome */}
        <div className="flex h-9 items-center gap-1.5 px-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto rounded-full bg-white px-3 py-1 text-[11px] font-medium tracking-[-0.01em] text-muted shadow-[0_0_0_1px_var(--line)]">
            Virtual Visit · HOWL STUDIO
          </span>
          <span className="w-[42px]" />
        </div>

        {/* Floor plan */}
        <div className="vv-floor relative aspect-[4/3] overflow-hidden rounded-[24px] shadow-[inset_0_0_0_1px_var(--line)]">
          {/* rooms */}
          <div className="absolute top-[9%] left-[7%] h-[42%] w-[40%] rounded-[18px] bg-white shadow-[0_0_0_1px_var(--line),0_8px_24px_-12px_rgba(0,0,0,0.12)]" />
          <div className="absolute top-[9%] right-[7%] h-[30%] w-[36%] rounded-[18px] bg-white/70 shadow-[0_0_0_1px_var(--line)]">
            <div className="absolute top-[28%] left-[12%] h-[12%] w-[42%] rounded-full bg-[#e8f1fc]" />
            <div className="absolute top-[52%] left-[12%] h-[12%] w-[28%] rounded-full bg-[#f0f0f3]" />
          </div>
          <div className="absolute right-[7%] bottom-[9%] h-[40%] w-[44%] rounded-[18px] bg-white/70 shadow-[0_0_0_1px_var(--line)]">
            <div className="absolute top-1/2 left-1/2 size-[34%] -translate-1/2 rounded-full bg-[#f2f2f5] shadow-[0_0_0_1px_var(--line)]" />
          </div>
          <div className="absolute bottom-[9%] left-[7%] h-[30%] w-[30%] rounded-[18px] bg-white/70 shadow-[0_0_0_1px_var(--line)]" />

          {/* path from you */}
          <svg viewBox="0 0 400 300" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <path d="M122 112 C 170 150, 200 185, 228 186" fill="none" stroke="#0066cc" strokeOpacity=".35" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* other visitors */}
          {VISITORS.map((v) => (
            <span
              key={v.i}
              className="absolute grid size-8 -translate-1/2 place-items-center rounded-full text-[12px] font-semibold text-white ring-[3px] ring-white sm:size-9"
              style={{ left: v.x, top: v.y, background: v.c }}
            >
              {v.i}
            </span>
          ))}

          {/* you */}
          <div className="vv-float absolute top-[28%] left-[27%] -translate-1/2">
            <span className="vv-ping absolute inset-0 rounded-full bg-primary" />
            <span className="relative grid size-10 place-items-center rounded-full bg-primary text-[13px] font-semibold text-white ring-4 ring-white sm:size-11">
              {label.charAt(0).toUpperCase()}
            </span>
            <span className="absolute top-full left-1/2 mt-2 max-w-[150px] -translate-x-1/2 truncate rounded-full bg-foreground px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)]">
              {label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
