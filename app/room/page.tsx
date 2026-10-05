import type { Metadata } from "next";
import { RoomLoader } from "@/components/RoomLoader";

export const metadata: Metadata = { title: "#lobby · Virtual Visit — HOWL STUDIO" };

/** /room → the default "lobby" room (the landing page's Enter room button). */
export default function DefaultRoomPage() {
  return <RoomLoader roomId="lobby" />;
}
