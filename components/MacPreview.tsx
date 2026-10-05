/**
 * Landing visual: the real room, shown inside Apple's MacBook Pro bezel
 * (Apple Design Resources), as on the HowlsOS proposal page. Decorative only.
 */
export function MacPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[640px] select-none">
      <div className="vv-device">
        <div className="vv-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/screens/room.webp" alt="" draggable={false} className="size-full object-cover" style={{ imageRendering: "pixelated" }} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/devices/macbook-pro-14-m5-silver.webp" width={1903} height={1148} alt="" draggable={false} className="vv-bezel" />
      </div>
    </div>
  );
}
