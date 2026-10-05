/** Parse a YouTube watch / share / shorts URL into an 11-char video id. */
export function parseYouTubeId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const i = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live" || p === "v");
      if (i >= 0 && parts[i + 1] && /^[\w-]{11}$/.test(parts[i + 1])) return parts[i + 1];
    }
  } catch { /* not a URL */ }
  return null;
}

export function youtubeEmbedUrl(videoId: string, opts?: { start?: number; autoplay?: boolean }) {
  const start = Math.max(0, Math.floor(opts?.start ?? 0));
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1",
  });
  if (opts?.autoplay) params.set("autoplay", "1");
  if (start > 0) params.set("start", String(start));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}
