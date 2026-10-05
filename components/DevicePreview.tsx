/**
 * Landing hero visual: the real room on a MacBook Pro and an iPhone 16 Pro (official Apple bezels,
 * Apple Design Resources). Each screen plays a short looping capture of the actual Phaser room;
 * with prefers-reduced-motion (or before a clip exists) only the poster frame is shown. Decorative only.
 */
type Clip = { poster: string; webm?: string; mp4?: string };

function Screen({ clip, className }: { clip: Clip; className: string }) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={clip.poster} alt="" draggable={false} className="vv-clip-poster" />
      {clip.webm && clip.mp4 && (
        <video className="vv-clip-video" autoPlay muted loop playsInline preload="metadata" poster={clip.poster} disablePictureInPicture disableRemotePlayback>
          <source src={clip.webm} type="video/webm" />
          <source src={clip.mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

export const MAC_CLIP: Clip = { poster: "/screens/room.webp" };
export const PHONE_CLIP: Clip = { poster: "/screens/room-phone.webp" };

export function MacDevice({ clip = MAC_CLIP }: { clip?: Clip }) {
  return (
    <div className="vv-device">
      <Screen clip={clip} className="vv-screen" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/devices/macbook-pro-14-m5-silver.webp" width={1903} height={1148} alt="" draggable={false} className="vv-bezel" />
    </div>
  );
}

export function PhoneDevice({ clip = PHONE_CLIP }: { clip?: Clip }) {
  return (
    <div className="vv-phone">
      <Screen clip={clip} className="vv-phone-screen" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/devices/iphone-16-pro-black-titanium.webp" width={654} height={1355} alt="" draggable={false} className="vv-bezel" />
    </div>
  );
}

/** MacBook with the iPhone overlapping its lower-right corner (desktop / tablet). */
export function DeviceStage() {
  return (
    <div aria-hidden className="vv-stage select-none">
      <div className="vv-stage-mac"><MacDevice /></div>
      <div className="vv-stage-phone"><PhoneDevice /></div>
    </div>
  );
}
