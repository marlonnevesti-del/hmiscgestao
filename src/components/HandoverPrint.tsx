import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Letterhead } from '@/components/DischargePrint';
import { printProcedure } from '@/components/ProcedurePrint';
import { useStore } from '@/lib/hospital-store';
import { WARDS } from '@/lib/hospital-data';
import { handoverForUnit } from '@/lib/handover';
import { stayDays } from '@/lib/bed-board';

type Job = { at: number; units: { ward: string; rows: ReturnType<typeof handoverForUnit> }[] };
const unitName = (w: string) => WARDS.find((x) => x.id === w)?.name ?? w;

export function HandoverButton() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [ward, setWard] = useState('TODOS');
  const [job, setJob] = useState<Job | null>(null);
  const wards = useMemo(() => [...new Set(encounters.flatMap((e) => e.fia && !e.discharge ? [e.fia.ward] : []))].sort(), [encounters]);
  const sel = ward === 'TODOS' || wards.includes(ward) ? ward : 'TODOS';
  useEffect(() => {
    if (!job) return;
    const done = () => setJob(null);
    window.addEventListener('afterprint', done);
    printProcedure();
    return () => window.removeEventListener('afterprint', done);
  }, [job]);
  const go = () => { const at = Date.now(); setJob({ at, units: (sel === 'TODOS' ? wards : [sel]).map((w) => ({ ward: w, rows: handoverForUnit(encounters, patients, w, at) })) }); };
  return <>
    <select aria-label="Unidade da passagem de plantão" value={sel} onChange={(e) => setWard(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
      <option value="TODOS">Todas as unidades</option>
      {wards.map((w) => <option key={w} value={w}>{unitName(w)}</option>)}
    </select>
    <Button type="button" variant="outline" size="sm" disabled={!wards.length || !!job} onClick={go}><Printer className="mr-1 h-4 w-4" />Passagem de plantão (SBAR)</Button>
    {job && typeof document !== 'undefined' ? createPortal(<div className="print-doc-root proc-root">
      {job.units.map((u) => <section key={u.ward} className="doc-page">
        <Letterhead title="PASSAGEM DE PLANTÃO (SBAR)" />
        <p className="mb-3 text-xs">{unitName(u.ward)} · {new Date(job.at).toLocaleString('pt-BR')}</p>
        <div className="space-y-2 text-xs">{u.rows.map(({ patient: p, encounter: e, sbar }) => <div key={e.id} className="break-inside-avoid rounded border p-2">
          <p className="font-bold">{e.fia?.bed || p.bed} · {p.name} · FIA {e.fia?.number} · {stayDays(e.fia?.openedAt || e.openedAt, job.at)} dias · {e.fia?.cid || e.medical?.cid || '—'}</p>
          <p><b>S – Situação:</b> {sbar.s}</p><p><b>B – Breve histórico:</b> {sbar.b}</p><p><b>A – Avaliação:</b> {sbar.a}</p><p><b>R – Recomendação:</b> {sbar.r}</p>
        </div>)}</div>
        <div className="mt-6 border-t pt-2 text-center text-xs">Equipe que encerra / Equipe que assume</div>
      </section>)}
    </div>, document.body) : null}
  </>;
}
