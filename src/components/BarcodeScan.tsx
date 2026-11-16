import { useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Campo para bipar: o leitor USB digita o código e envia Enter; a câmera é opcional. */
export function BarcodeScan({ onScan, placeholder = "Bipar código de barras", className }: { onScan: (code: string) => void; placeholder?: string; className?: string }) {
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const submit = (code: string) => { const c = code.trim(); if (c) onScan(c); setValue(""); };
  return <div className={className}>
    <div className="flex gap-2">
      <div className="relative flex-1"><ScanBarcode className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={placeholder} className="pl-8 font-mono" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(value); } }} /></div>
      <Button type="button" variant="outline" size="icon" aria-label="Ler pela câmera" onClick={() => setCamera(true)}><Camera className="h-4 w-4" /></Button>
    </div>
    {camera && <CameraReader onClose={() => setCamera(false)} onRead={(c) => { setCamera(false); submit(c); }} />}
  </div>;
}

function CameraReader({ onRead, onClose }: { onRead: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let stop: (() => void) | undefined; let done = false;
    void import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      if (done || !video.current) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, video.current, (result) => { if (result && !done) { done = true; controls.stop(); onRead(result.getText()); } });
      stop = () => controls.stop();
      if (done) stop();
    }).catch(() => setError("Não foi possível abrir a câmera. Verifique a permissão do navegador."));
    return () => { done = true; stop?.(); };
  }, [onRead]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4" role="dialog" aria-label="Leitura pela câmera">
    <div className="w-full max-w-md space-y-2 rounded-xl bg-card p-3">
      <div className="flex items-center justify-between"><b className="text-sm">Aponte para o código de barras</b><Button size="icon" variant="ghost" aria-label="Fechar câmera" onClick={onClose}><X className="h-4 w-4" /></Button></div>
      {error ? <p className="text-sm text-destructive">{error}</p> : <video ref={video} className="aspect-video w-full rounded-md bg-muted object-cover" muted playsInline />}
    </div>
  </div>;
}
