import { Logo } from "@/components/Logo";
import { Landing } from "@/components/Landing";
import { normalizeRoomId } from "@/lib/room";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { room } = await searchParams;
  const id = typeof room === "string" ? normalizeRoomId(room) : "";
  const roomHref = id && id !== "lobby" ? `/room/${id}` : "/room";
  return (
    <div className="vv-page">
      <header className="shrink-0 px-3 pt-3">
        <div className="vv-glass mx-auto flex h-12 max-w-[1240px] items-center rounded-full px-4 sm:px-5">
          <Logo />
          <span className="ml-auto text-[13px] text-muted">© {new Date().getFullYear()} HOWL STUDIO</span>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center">
        <div className="mx-auto w-full max-w-[1360px] px-5 py-6 sm:px-10 md:py-8">
          <Landing roomHref={roomHref} />
        </div>
      </main>
    </div>
  );
}
