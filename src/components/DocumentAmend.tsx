import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { amendDocuments, useStore } from '@/lib/hospital-store';
import { AMEND_FIELDS, amendIssue, documentGaps, readField, type AmendField } from '@/lib/document-amend';
import { SigtapPicker } from '@/components/SigtapPicker';
import type { Encounter } from '@/lib/care-flow';
import type { Patient } from '@/lib/hospital-data';

/** Botão (só Administrador) que reabre os números de documento de um atendimento para preenchimento. */
export function AmendDocumentButton({ p, e, label = 'Retificar documentos (Admin)', size = 'sm' }: { p: Patient; e?: Encounter | undefined; label?: string; size?: 'sm' | 'default' }) {
  const profile = useStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Partial<Record<AmendField, string>>>({});
  const [reason, setReason] = useState('');
  if (profile !== 'Administrador' || !e) return null;
  const fields = AMEND_FIELDS.filter((f) => !f.inpatientOnly || e.fia);
  const gaps = documentGaps(p, e);
  const start = () => { setVals(Object.fromEntries(fields.map((f) => [f.id, readField(p, e, f.id)]))); setReason(''); setOpen(true); };
  const save = () => {
    if (!window.confirm(`Confirmar retificação dos documentos de ${p.name}? A alteração fica registrada no histórico.`)) return;
    try { amendDocuments(e.id, vals, reason); toast.success('Documentos retificados'); setOpen(false); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao salvar'); }
  };
  return <>
    <Button size={size} variant="outline" onClick={start}><PencilLine className="mr-1 h-4 w-4" />{label}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Retificar documentos · {p.name} · {e.fia?.number ?? e.number}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map((f) => { const v = vals[f.id] ?? ''; const err = amendIssue(f.id, v); const missing = gaps.includes(f.id) && !v.trim();
        const picker = f.id === 'sigtapCode' ? <SigtapPicker onPick={(p) => setVals((x) => ({ ...x, sigtapCode: p.c }))} /> : null;
        return <div key={f.id} className={picker ? 'grid gap-2 sm:col-span-2' : ''}>{picker}<label className="text-xs font-medium">{f.label}{missing && <span className="ml-1 text-destructive">· pendente</span>}
          <Input value={v} onChange={(ev) => setVals((x) => ({ ...x, [f.id]: ev.target.value }))} aria-invalid={!!err} className={err || missing ? 'border-destructive' : ''} />
          {err && <span className="text-[11px] text-destructive">{err}</span>}</label></div>; })}</div>
      <label className="text-xs font-medium">Justificativa (obrigatória)<textarea value={reason} onChange={(ev) => setReason(ev.target.value)} className="mt-1 min-h-16 w-full rounded-md border bg-background p-2 text-sm" /></label>
      <Button disabled={!reason.trim() || fields.some((f) => amendIssue(f.id, vals[f.id] ?? ''))} onClick={save}>Salvar retificação</Button>
    </DialogContent></Dialog>
  </>;
}

/** Painel central do Administrador: atendimentos com números de documento faltando. */
export function DocumentGapsPanel() {
  const profile = useStore((s) => s.profile);
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [q, setQ] = useState('');
  if (profile !== 'Administrador') return null;
  const rows = encounters.map((e) => { const p = patients.find((x) => x.id === e.patientId); return p ? { e, p, gaps: documentGaps(p, e) } : null; })
    .filter((r): r is NonNullable<typeof r> => !!r && r.gaps.length > 0)
    .filter((r) => !q.trim() || `${r.p.name} ${r.e.number} ${r.e.fia?.number ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const label = (f: AmendField) => AMEND_FIELDS.find((x) => x.id === f)!.label;
  return <div className="rounded-lg border bg-card p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-medium">Pendências de documentos (Administrador)</div><div className="text-xs text-muted-foreground">{rows.length} atendimento(s) com número faltando</div></div>
      <Input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Buscar paciente ou nº" className="w-60" /></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th>Nº</th><th>Paciente</th><th>Faltando</th><th></th></tr></thead>
      <tbody>{rows.slice(0, 100).map((r) => <tr key={r.e.id} className="border-t align-top"><td className="py-1 font-mono text-xs">{r.e.fia?.number ?? r.e.number}</td><td>{r.p.name}</td>
        <td className="text-xs text-destructive">{r.gaps.map(label).join(' · ')}</td><td className="text-right"><AmendDocumentButton p={r.p} e={r.e} label="Preencher" /></td></tr>)}
        {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhuma pendência de documento.</td></tr>}</tbody></table></div>
  </div>;
}
