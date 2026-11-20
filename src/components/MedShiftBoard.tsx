import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/hospital-store";
import { currentShift, doseRows, SHIFTS, shiftProgress, type DoseRow } from "@/lib/med-shift";

const CLS: Record<DoseRow["status"], string> = { checado: "bg-clinical-soft text-clinical", atrasado: "bg-maternal-soft text-maternal", aguardando: "bg-muted", pendente: "bg-mt-yellow", justificado: "bg-muted", cancelado: "bg-muted" };
const LABEL: Record<DoseRow["status"], string> = { checado: "Conferida", atrasado: "Atrasada", aguardando: "Aguardando farmácia", pendente: "Pendente", justificado: "Justificada", cancelado: "Cancelada" };

export function MedShiftBoard() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const admins = useStore((s) => s.admins);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const board = useMemo(() => {
    const shift = currentShift(new Date(now));
    const r = SHIFTS.find((x) => x.id === shift);
    const start = new Date(now); start.setHours(r?.from ?? 0, 0, 0, 0);
    const end = new Date(now); end.setHours(r?.to ?? 6, 0, 0, 0);
    const doses = doseRows(encounters, patients, admins, now).filter((d) => d.dueAt >= start.getTime() && d.dueAt < end.getTime());
    const groups = new Map<string, { name: string; bed: string; doses: DoseRow[] }>();
    for (const d of doses) { const g = groups.get(d.patientId); if (g) g.doses.push(d); else groups.set(d.patientId, { name: d.patientName, bed: d.bed, doses: [d] }); }
    return { shift, date: new Date(now).toLocaleDateString("pt-BR"), progress: shiftProgress(doses), groups: [...groups] };
  }, [encounters, patients, admins, now]);
  const p = board.progress;
  const chips = [["Total de doses", p.total], ["Conferidas", p.checado], ["Pendentes", p.pendente], ["Atrasadas", p.atrasado], ["Aguardando farmácia", p.aguardando]] as const;
  return <section className="mb-4 space-y-3 rounded-xl border bg-card p-3">
    <h2 className="text-sm font-semibold">Quadro de medicação do turno · {board.shift} · {board.date}</h2>
    <div className="flex flex-wrap gap-2">{chips.map(([l, v]) => <span key={l} className="rounded-md bg-muted px-2 py-1 text-xs">{l}: <b>{v}</b></span>)}</div>
    <div className="flex items-center gap-2"><div role="progressbar" aria-label="Doses conferidas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct} className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-clinical" style={{ width: `${p.pct}%` }} /></div><span className="text-xs text-muted-foreground">{p.pct}%</span></div>
    {!p.total ? <p className="py-3 text-sm text-muted-foreground">Nenhuma dose prevista para este turno.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b"><th className="p-2">Horário</th><th className="p-2">Medicação / cuidado</th><th className="p-2">Status</th></tr></thead>
      {board.groups.map(([id, g]) => <tbody key={id}><tr className="bg-muted"><th colSpan={3} className="p-2 font-semibold">{g.bed} · {g.name}</th></tr>
        {g.doses.map((d, i) => <tr key={`${d.key}|${i}`} className="border-b"><td className="p-2 font-mono">{d.time}</td><td className="p-2">{d.item}</td><td className="p-2"><span className={`rounded-md px-2 py-1 text-xs ${CLS[d.status]}`}>{LABEL[d.status]}</span></td></tr>)}
      </tbody>)}
    </table></div>}
  </section>;
}
