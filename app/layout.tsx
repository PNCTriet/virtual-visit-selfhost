import type { Metadata, Viewport } from "next";
import { hand } from "./fonts";
import "./globals.css";

const title = "Virtual Visit — HOWL STUDIO";
const description = "Walk around the HOWL STUDIO virtual space and meet other visitors in real time.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Virtual Visit",
  authors: [{ name: "HOWL STUDIO" }],
  openGraph: { title, description, type: "website", siteName: "HOWL STUDIO" },
  twitter: { card: "summary", title, description },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // The on-screen keyboard overlays the room instead of resizing the map and joystick.
  interactiveWidget: "overlays-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
