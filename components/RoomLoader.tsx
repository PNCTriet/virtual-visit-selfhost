"use client";

import dynamic from "next/dynamic";

// The room is canvas + sessionStorage + realtime: render it on the client only.
const Room = dynamic(() => import("./Room").then((m) => m.Room), {
  ssr: false,
  loading: () => <div className="fixed inset-0 grid place-items-center bg-[#f5f5f7] text-[15px] text-muted">Entering room…</div>,
});

export function RoomLoader({ roomId }: { roomId: string }) {
  return <Room roomId={roomId} />;
}
