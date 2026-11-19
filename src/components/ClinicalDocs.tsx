import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { BedDouble, FileText, HeartHandshake, Scissors, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Letterhead } from '@/components/DischargePrint';
import { saveClinicalDoc, professionalName, useStore } from '@/lib/hospital-store';
import { CLINICAL_DOCS, missingFields, type ClinicalDoc, type ClinicalDocKind } from '@/lib/inpatient-docs';
import { canAct, type Patient } from '@/lib/hospital-data';
import type { Encounter } from '@/lib/care-flow';
import { cn } from '@/lib/utils';

const ICONS = { uti: BedDouble, cirurgica: Scissors, evolucao: FileText, social: HeartHandshake, encaminhamento: Send };
const dt = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function defaults(kind: ClinicalDocKind, p: Patient, e: Encounter, me: string): Record<string, string> {
  const cid = e.fia?.cid || e.medical?.cid || '';
  const dx = e.medical?.diagnosis || p.diagnosis || '';
  const v: Record<string, string> = {};
  if (kind === 'uti') Object.assign(v, { cid, diagnostico: dx, tipo: p.type === 'neonato' ? 'UTI Neonatal' : p.type === 'pediatria' ? 'UTI Pediátrica' : 'UTI Obstétrica', medico: me });
  if (kind === 'cirurgica') Object.assign(v, { preop: dx, cirurgiao: me, sigtap: e.sigtapCode || '', destino: 'SRPA' });
  if (kind === 'evolucao') Object.assign(v, { medico: me });
  if (kind === 'social' || kind === 'encaminhamento') Object.assign(v, { assistente: me, contato: p.guardian || p.registration?.guardian || '' });
  return v;
}

function Sheet({ kind, p, e, d }: { kind: ClinicalDocKind; p: Patient; e: Encounter; d: ClinicalDoc }) {
  const cfg = CLINICAL_DOCS[kind];
  const sig = d.values['medico'] || d.values['cirurgiao'] || d.values['assistente'] || d.by;
  const reg = d.values['crm'] ? `CRM ${d.values['crm']}` : d.values['cress'] ? `CRESS ${d.values['cress']}` : 'Carimbo / registro';
  return <section className="doc-page">
    <Letterhead title={cfg.title} />
    <table className="doc-id"><tbody>
      <tr><td><b>Paciente:</b> {p.name}</td><td><b>Prontuário:</b> {p.prontuario}</td></tr>
      <tr><td><b>Idade:</b> {p.age}{p.weight ? ` · ${p.weight} kg` : ''}</td><td><b>CNS:</b> {p.registration?.cns || '—'}</td></tr>
      <tr><td><b>Atendimento:</b> {e.fia?.number || e.number}</td><td><b>Leito:</b> {e.fia ? `${e.fia.ward} / ${e.fia.bed}` : p.bed || '—'}</td></tr>
    </tbody></table>
    <table className="doc-id"><tbody>{cfg.fields.filter((f) => !['crm', 'cress'].includes(f.key)).map((f) =>
      <tr key={f.key}><td style={{ width: '32%' }}><b>{f.label}</b></td><td style={{ whiteSpace: 'pre-wrap' }}>{d.values[f.key] || '—'}</td></tr>)}</tbody></table>
    <p style={{ textAlign: 'right', marginTop: '2em' }}>Criciúma - SC, {dt(d.at)}.</p>
    <div className="doc-sign"><div className="line" />{sig}<br />{reg}</div>
  </section>;
}

function DocDialog({ kind, p, e, onClose }: { kind: ClinicalDocKind; p: Patient; e: Encounter; onClose: () => void }) {
  const me = useStore((s) => professionalName(s.profile));
  const cfg = CLINICAL_DOCS[kind];
  const [v, setV] = useState(() => defaults(kind, p, e, me));
  const [printing, setPrinting] = useState<ClinicalDoc | null>(null);
  const history = e.clinicalDocs?.[kind] ?? [];
  const miss = missingFields(kind, v);
  const print = (d: ClinicalDoc) => {
    setPrinting(d);
    document.body.classList.add('print-doc', 'print-term');
    const done = () => { document.body.classList.remove('print-doc', 'print-term'); setPrinting(null); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 150);
  };
  const save = (andPrint: boolean) => {
    if (miss.length) { toast.error(`Preencha: ${miss.join(', ')}`); return; }
    if (!window.confirm(`Confirma o registro de "${cfg.title.toLowerCase()}"?`)) return;
    try { const d = saveClinicalDoc(e.id, kind, v); toast.success('Documento salvo no prontuário'); if (andPrint) print(d); else onClose(); }
    catch (err) { toast.error((err as Error).message); }
  };
  const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';
  return <>
    <div className="grid gap-3 sm:grid-cols-2">
      {cfg.fields.map((f) => {
        const bad = f.required && !v[f.key]?.trim();
        const cls = cn(input, bad && 'border-destructive');
        const set = (x: string) => setV((o) => ({ ...o, [f.key]: x }));
        return <label key={f.key} className={cn('grid gap-1 text-xs font-medium', f.long && 'sm:col-span-2')}>{f.label}{f.required && ' *'}
          {f.options ? <select className={cls} value={v[f.key] ?? ''} onChange={(x) => set(x.target.value)}><option value="">Selecione…</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
            : f.long ? <textarea rows={3} className={cls} value={v[f.key] ?? ''} onChange={(x) => set(x.target.value)} />
            : <input className={cls} value={v[f.key] ?? ''} onChange={(x) => set(x.target.value)} />}
        </label>;
      })}
    </div>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => save(false)}>Salvar</Button><Button onClick={() => save(true)}>Salvar e imprimir</Button></div>
    {history.length > 0 && <div className="rounded-md border p-2 text-xs"><div className="mb-1 font-semibold">Registros anteriores</div>
      {history.slice().reverse().map((d) => <div key={d.id} className="flex items-center justify-between border-t py-1"><span>{dt(d.at)} · {d.by}</span><Button size="sm" variant="ghost" onClick={() => print(d)}>Reimprimir</Button></div>)}</div>}
    {printing && createPortal(<div className="print-doc-root term-root"><Sheet kind={kind} p={p} e={e} d={printing} /></div>, document.body)}
  </>;
}

/** Botões dos documentos clínicos da internação, preenchidos com o cadastro e editáveis antes de salvar/imprimir. */
export function ClinicalDocsButtons({ p, e }: { p: Patient; e?: Encounter | undefined }) {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  const [open, setOpen] = useState<ClinicalDocKind | null>(null);
  if (!e || !canAct(profile, 'evoluir', areas)) return null;
  const btn = 'flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted';
  return <>
    {(Object.keys(CLINICAL_DOCS) as ClinicalDocKind[]).map((k) => { const I = ICONS[k]; const n = e.clinicalDocs?.[k]?.length ?? 0;
      return <button key={k} className={btn} onClick={() => setOpen(k)}><I className="h-4 w-4" />{CLINICAL_DOCS[k].button}{n ? ` (${n})` : ''}</button>; })}
    <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{open && CLINICAL_DOCS[open].title}</DialogTitle></DialogHeader>
      {open && <DocDialog key={open} kind={open} p={p} e={e} onClose={() => setOpen(null)} />}
    </DialogContent></Dialog>
  </>;
}
