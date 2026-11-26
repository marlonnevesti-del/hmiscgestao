import { useRef, useState } from "react";
import { Film, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { helpVideoSource, videoTimestamp, type HelpVideo } from "@/lib/help-video";

export function HelpSectorVideo({ title, video }: { title: string; video?: HelpVideo }) {
  const player = useRef<HTMLVideoElement>(null);
  const [offset, setOffset] = useState(0);
  const [failed, setFailed] = useState(false);
  const [speed, setSpeed] = useState("1");
  const source = video ? helpVideoSource(video.url, offset) : null;
  const chapters = video?.chapters?.filter((c) => Number.isFinite(c.seconds) && c.seconds >= 0).sort((a, b) => a.seconds - b.seconds) ?? [];

  function seek(seconds: number) {
    if (source?.kind === "file" && player.current) {
      player.current.currentTime = seconds;
      void player.current.play().catch(() => {});
    } else {
      setOffset(seconds);
    }
  }

  return (
    <section className="space-y-3 print:hidden" aria-label={`Vídeo do setor ${title}`}>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Film className="h-4 w-4 text-clinical" /> Tutorial em vídeo
      </h3>
      {!video ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed bg-muted/40 p-5">
          <Film className="h-6 w-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">Gravação ainda não disponível.</p>
          </div>
        </div>
      ) : !source || failed ? (
        <div role="alert" className="flex items-center gap-2 rounded-md border p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Não foi possível carregar o vídeo. O guia escrito continua disponível abaixo.
        </div>
      ) : (
        <>
          <p className="text-sm font-medium">{video.title ?? title}</p>
          {source.kind === "file" ? (
            <>
              <video ref={player} className="aspect-video w-full rounded-md bg-muted" controls playsInline preload="metadata" onError={() => setFailed(true)} aria-label={video.title ?? title}>
                <source src={source.url} type="video/mp4" />
              </video>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Velocidade
                <select aria-label="Velocidade do vídeo" className="rounded-md border bg-background px-2 py-1 text-foreground" value={speed} onChange={(event) => {
                  setSpeed(event.target.value);
                  if (player.current) player.current.playbackRate = Number(event.target.value);
                }}>
                  {[0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                </select>
              </label>
            </>
          ) : (
            <iframe key={source.url} src={source.url} title={video.title ?? `Tutorial de ${title}`} className="aspect-video w-full rounded-md border" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          )}
          {source.seekable && chapters.length > 0 && (
            <nav aria-label="Capítulos do vídeo" className="space-y-1">
              <p className="text-sm font-semibold">Capítulos</p>
              {chapters.map((chapter) => (
                <Button key={`${chapter.seconds}:${chapter.title}`} variant="ghost" className="h-auto w-full justify-start whitespace-normal py-2 text-left" onClick={() => seek(chapter.seconds)}>
                  <Play className="mr-2 h-3 w-3 shrink-0" />
                  <span className="mr-3 shrink-0 font-mono text-clinical">{videoTimestamp(chapter.seconds)}</span>
                  <span>{chapter.title}</span>
                </Button>
              ))}
            </nav>
          )}
        </>
      )}
    </section>
  );
}