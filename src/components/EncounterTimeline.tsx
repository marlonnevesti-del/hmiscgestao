import { useStore } from '@/lib/hospital-store';
import { FLOW_LABELS } from '@/lib/care-flow';
import { realAllergies } from '@/lib/hospital-data';
export function EncounterTimeline({ patientId }: { patientId: string }) {
  const e = useStore((s) => s.encounters.slice().reverse().find((x) => x.patientId === patientId));
  const p = useStore((s) => s.patients.find((x) => x.id === patientId));
  if (!e) return null;
  const allergies = realAllergies(p?.allergies);
  return <section className="space-y-2 border-b py-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><b className="font-mono text-primary">{e.number}</b><strong className="text-clinical">{FLOW_LABELS[e.status_fluxo]}</strong></div>{allergies.length > 0 && <div role="alert" className="sticky top-14 z-20 bg-maternal px-3 py-2 text-sm font-bold text-primary-foreground">ALERGIA: {allergies.join(', ')}</div>}{e.examPending && <div className="text-xs text-maternal">Aguardando Resultado de Exame · {e.examPending}</div>}<ol className="flex gap-3 overflow-x-auto pb-2">{e.history.map((step, i) => <li key={`${step.at}-${i}`} className="flex shrink-0 items-center gap-3 text-xs"><div><div className="font-medium">{FLOW_LABELS[step.status]}</div><time className="font-mono text-muted-foreground">{new Date(step.at).toLocaleTimeString('pt-BR')} · {step.by}</time>{step.note && <div className="text-muted-foreground">{step.note}</div>}</div>{i < e.history.length - 1 && <span aria-hidden>→</span>}</li>)}</ol></section>;
}