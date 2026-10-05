"use client";

import { useRef, useState } from "react";
import type { JoystickInput } from "@/lib/game/office";

const RADIUS = 42;

/** Tiny on-screen joystick for touch. Reports a normalized vector (length ≤ 1) on every move. */
export function Joystick({ onChange, className = "" }: { onChange: (v: JoystickInput) => void; className?: string }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const update = (e: React.PointerEvent) => {
    const r = baseRef.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    setKnob({ x: dx, y: dy });
    onChange({ x: dx / RADIUS, y: dy / RADIUS });
  };
  const end = (e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setDragging(false);
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Joystick: drag to walk"
      data-testid="joystick"
      onPointerDown={(e) => { pointer.current = e.pointerId; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (pointer.current === e.pointerId) update(e); }}
      onPointerUp={end}
      onPointerCancel={end}
      className={`vv-joy size-[124px] touch-none rounded-full select-none ${className}`}
    >
      <span
        aria-hidden
        className="vv-joy-knob absolute top-1/2 left-1/2 size-[54px] rounded-full"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`, transition: !dragging ? "transform .18s cubic-bezier(.2,.8,.2,1)" : "none" }}
      />
    </div>
  );
}
