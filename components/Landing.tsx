import Link from "next/link";
import { DeviceStage, PhoneDevice } from "./DevicePreview";

export function Landing({ roomHref = "/room" }: { roomHref?: string }) {
  return (
    <div className="vv-landing">
      {/* Phones: only the iPhone, above the copy. */}
      <div aria-hidden className="vv-in vv-landing-phone select-none md:hidden" style={{ "--d": 0 } as React.CSSProperties}>
        <PhoneDevice />
      </div>

      <div className="vv-landing-copy">
        <h1 className="vv-hero vv-in" style={{ "--d": 0 } as React.CSSProperties}>
          Virtual <span className="vv-mark">Visit</span>
        </h1>
        <p className="vv-lead vv-in mx-auto mt-4 max-w-[26ch] text-muted lg:mx-0 lg:mt-6" style={{ "--d": 1 } as React.CSSProperties}>
          Walk around our space and meet other visitors, live.
        </p>
        <div className="vv-in mt-7 flex flex-col items-center gap-3 lg:mt-10 lg:items-start" style={{ "--d": 2 } as React.CSSProperties}>
          <Link href={roomHref} className="vv-btn">
            Enter room <span aria-hidden className="vv-arrow">→</span>
          </Link>
          <p className="text-[13px] text-muted">No sign-up. Pick a name and walk in.</p>
        </div>
      </div>

      <div className="vv-in hidden min-w-0 md:block" style={{ "--d": 3 } as React.CSSProperties}>
        <DeviceStage />
      </div>
    </div>
  );
}
