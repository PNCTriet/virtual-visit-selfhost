import { Logo } from "@/components/Logo";
import { Landing } from "@/components/Landing";
import { normalizeRoomId } from "@/lib/map";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { room } = await searchParams;
  const initialRoom = typeof room === "string" ? normalizeRoomId(room) || "lobby" : "lobby";
  return (
    <>
      <header className="sticky top-3 z-20 px-3">
        <div className="vv-glass mx-auto flex h-12 max-w-[1240px] items-center rounded-full px-4 sm:px-5">
          <Logo />
          <span className="ml-auto text-[13px] text-muted">Virtual Visit</span>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[1240px] px-6 pt-16 pb-20 sm:px-10 sm:pt-24 lg:pt-20 lg:pb-28">
          <Landing initialRoom={initialRoom} />
        </div>
      </main>

      <footer>
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-center px-6 text-[12px] text-muted sm:px-10 lg:justify-start">
          © {new Date().getFullYear()} HOWL STUDIO
        </div>
      </footer>
    </>
  );
}
