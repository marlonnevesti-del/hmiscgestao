import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/hospital-store";

function chime() {
  try {
    const ctx = new AudioContext();
    ([[880, 0], [660, 0.35], [880, 0.7]] as const).forEach(([f, t]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* som bloqueado pelo navegador */ }
}

/** Avisa a farmácia (som + aviso na tela) quando chega nova prescrição assinada. */
export function PharmacyCallAlert() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const waiting = encounters.filter((e) => e.status_fluxo === "AGUARDANDO_FARMACIA");
    if (!seen.current) { seen.current = new Set(waiting.map((e) => e.id)); return; }
    const fresh = waiting.filter((e) => !seen.current!.has(e.id));
    seen.current = new Set(waiting.map((e) => e.id));
    if (!fresh.length) return;
    chime();
    fresh.forEach((e) => {
      const name = patients.find((p) => p.id === e.patientId)?.name ?? "Paciente";
      toast.warning(`Nova prescrição para a farmácia: ${name}`, { description: `${e.number} · assinada por ${e.signedBy ?? "médico"}`, duration: 20000, action: { label: "Abrir farmácia", onClick: () => { window.location.href = "/farmacia"; } } });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Nova prescrição", { body: name });
    });
  }, [encounters, patients]);
  useEffect(() => { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); }, []);
  return null;
}
