import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/hospital-store";
import { useInitialSynced } from "@/lib/sync-status";

const ALERTED_KEY = "hmisc-pharmacy-alerted-v1";

function readAlerted(): Set<string> {
  try {
    const raw = sessionStorage.getItem(ALERTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveAlerted(keys: Set<string>) {
  try {
    sessionStorage.setItem(ALERTED_KEY, JSON.stringify(Array.from(keys).slice(-200)));
  } catch { /* storage indisponível */ }
}

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

/** Avisa a farmácia (som + aviso na tela) quando chega nova prescrição liberada. */
export function PharmacyCallAlert() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const initialSynced = useInitialSynced();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!initialSynced) return;
    const waiting = encounters.filter((e) => e.status_fluxo === "AGUARDANDO_FARMACIA");
    const keyOf = (e: typeof waiting[number]) => `${e.id}:${e.prescriptionBatchId ?? ""}`;
    if (!seen.current) {
      const stored = readAlerted();
      waiting.forEach((e) => stored.add(keyOf(e)));
      seen.current = stored;
      saveAlerted(stored);
      return;
    }
    const fresh = waiting.filter((e) => !seen.current!.has(keyOf(e)));
    waiting.forEach((e) => seen.current!.add(keyOf(e)));
    saveAlerted(seen.current);
    if (!fresh.length) return;
    chime();
    fresh.forEach((e) => {
      const name = patients.find((p) => p.id === e.patientId)?.name ?? "Paciente";
      toast.warning(`Nova prescrição para a farmácia: ${name}`, { description: `${e.number} · liberada por ${e.signedBy ?? "médico"}`, duration: 20000, action: { label: "Abrir farmácia", onClick: () => { window.location.href = "/farmacia"; } } });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Nova prescrição", { body: name });
    });
  }, [encounters, patients, initialSynced]);
  useEffect(() => { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); }, []);
  return null;
}
