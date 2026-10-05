import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomLoader } from "@/components/RoomLoader";
import { ROOM_ID_RE } from "@/lib/map";

export async function generateMetadata({ params }: PageProps<"/room/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `#${id} · Virtual Visit — HOWL STUDIO` };
}

export default async function RoomPage({ params }: PageProps<"/room/[id]">) {
  const { id } = await params;
  if (!ROOM_ID_RE.test(id)) notFound();
  return <RoomLoader roomId={id} />;
}
