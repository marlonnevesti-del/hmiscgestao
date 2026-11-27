export interface HelpVideo {
  url: string;
  title?: string;
  durationSeconds?: number;
  chapters?: { title: string; seconds: number }[];
}

export type VideoSource = { kind: "file" | "embed"; url: string; seekable: boolean };

/** Only recognized providers may become embeds; local files stay same-origin. */
export function helpVideoSource(value: string, seconds = 0): VideoSource | null {
  const input = value.trim();
  if (!input || input.startsWith("//")) return null;
  const offset = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (input.startsWith("/") && !input.includes("\\")) {
    return /\.mp4(?:[?#]|$)/i.test(input) ? { kind: "file", url: input, seekable: true } : null;
  }
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(host)) {
    const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return { kind: "embed", url: `https://www.youtube-nocookie.com/embed/${id}?start=${offset}`, seekable: true };
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const id = url.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1];
    if (!id) return null;
    return { kind: "embed", url: `https://player.vimeo.com/video/${id}#t=${offset}s`, seekable: true };
  }
  if (host === "drive.google.com") {
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)$/)?.[1];
    if (!id) return null;
    return { kind: "embed", url: `https://drive.google.com/file/d/${id}/preview`, seekable: false };
  }
  return /\.mp4$/i.test(url.pathname) ? { kind: "file", url: url.href, seekable: true } : null;
}

export function videoTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}