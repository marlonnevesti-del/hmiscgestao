import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { can, type Patient } from '@/lib/hospital-data';
import { cancelService, completeService, requestService, useStore } from '@/lib/hospital-store';
import { SERVICE_CONFIG, sortServices, type ServiceKind, type ServicePriority, type ServiceRequest } from '@/lib/service-orders';
import { cn } from '@/lib/utils';

const run = (fn: () => void) => { try { fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Ação não concluída'); } };
const field = 'h-9 w-full rounded-md border bg-background px-2 text-sm';
const since = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`; };

/** Botão do atendimento médico: abre o pedido de Raio-X ou Gesso. */
export function ServiceRequestButton({ p, kind }: { p: Patient; kind: ServiceKind }) {
  const profile = useStore((s) => s.profile); const cfg = SERVICE_CONFIG[kind];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ region: '', detail: cfg.details[0] ?? '', priority: 'Rotina' as ServicePriority, justification: '' });
  const active = (p.services ?? []).filter((r) => r.kind === kind && r.status === 'Aguardando').length;
  return <>
    <Button variant="outline" disabled={!can(profile, 'prescrever')} onClick={() => setOpen(true)}>Solicitar {cfg.label.toLowerCase()}{active ? ` (${active} ativa)` : ''}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Solicitar {cfg.label} · {p.name}</DialogTitle></DialogHeader>
      <div className="grid gap-3 text-sm">
        <label className="grid gap-1">Região<input className={field} placeholder="Ex.: tórax, antebraço direito" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></label>
        <label className="grid gap-1">{cfg.detailLabel}<select className={field} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })}>{cfg.details.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="grid gap-1">Prioridade<select className={field} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as ServicePriority })}><option>Rotina</option><option>Urgente</option><option>Imediato</option></select></label>
        <label className="grid gap-1">Indicação / justificativa<textarea className="min-h-20 rounded-md border bg-background p-2" value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} /></label>
        <Button onClick={() => { if (!window.confirm(`Confirmar envio do pedido de ${cfg.label} para ${p.name}?`)) return; run(() => { requestService(p.id, { kind, ...f }); setOpen(false); setF({ ...f, region: '', justification: '' }); toast.success(`Pedido enviado para ${cfg.label}`); }); }}>Enviar solicitação</Button>
      </div>
    </DialogContent></Dialog>
  </>;
}

type Row = { p: Patient; req: ServiceRequest };

export function ServiceBoard({ kind }: { kind: ServiceKind }) {
  const patients = useStore((s) => s.patients); const profile = useStore((s) => s.profile); const cfg = SERVICE_CONFIG[kind];
  const [tab, setTab] = useState<'Aguardando' | 'hist'>('Aguardando');
  const [sector, setSector] = useState('');
  const [current, setCurrent] = useState<Row | null>(null); const [report, setReport] = useState('');
  const rows: Row[] = patients.flatMap((p) => (p.services ?? []).filter((r) => r.kind === kind).map((req) => ({ p, req })));
  const sectors = [...new Set(rows.map((r) => r.p.ward))];
  const shown = sortServices(rows.filter((r) => (tab === 'hist' ? r.req.status !== 'Aguardando' : r.req.status === 'Aguardando') && (!sector || r.p.ward === sector)));
  const waiting = rows.filter((r) => r.req.status === 'Aguardando').length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={tab === 'Aguardando' ? 'default' : 'outline'} onClick={() => setTab('Aguardando')}>Aguardando atendimento ({waiting})</Button>
      <Button variant={tab === 'hist' ? 'default' : 'outline'} onClick={() => setTab('hist')}>Histórico</Button>
      <select aria-label="Setor" className="ml-auto h-9 rounded-md border bg-background px-2 text-sm" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Todos os setores</option>{sectors.map((s) => <option key={s}>{s}</option>)}</select>
    </div>
    {!shown.length && <p className="py-6 text-muted-foreground">Nenhuma solicitação nesta lista.</p>}
    {shown.map(({ p, req }) => <section key={req.id} className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><b>{p.name}</b> <span className="text-sm text-muted-foreground">({p.age})</span><div className="text-sm text-muted-foreground">Leito: {p.bed || '—'} · Setor: {p.ward}</div></div>
        <div className="flex gap-2 text-xs"><span className={cn('rounded px-2 py-1 font-semibold', req.priority === 'Rotina' ? 'bg-muted' : 'bg-destructive/15 text-destructive')}>{req.priority.toUpperCase()}</span><span className="rounded bg-muted px-2 py-1">{req.region} · {req.detail}</span><span className="rounded bg-muted px-2 py-1">{req.status}</span></div>
      </div>
      <div className="mt-2 border-t pt-2 text-sm">
        <div className="text-muted-foreground">Solicitante: {req.requestedBy} · {since(req.requestedAt)}</div>
        <p className="mt-1">"{req.justification}"</p>
        {req.report && <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs"><b>{req.doneAt && new Date(req.doneAt).toLocaleString('pt-BR')} · {req.doneBy}</b><div className="whitespace-pre-wrap">{req.report}</div></div>}
        {req.closedNote && <p className="text-xs text-destructive">Cancelado: {req.closedNote}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {req.status === 'Aguardando' && <Button onClick={() => { setCurrent({ p, req }); setReport(''); }}>Atendimento</Button>}
        <Button variant="outline" asChild><Link to="/pacientes/$id" params={{ id: p.id }}>Ver prontuário</Link></Button>
        {req.status === 'Aguardando' && can(profile, 'prescrever') && <Button variant="ghost" onClick={() => { const why = window.prompt('Motivo do cancelamento:'); if (why == null) return; run(() => { cancelService(p.id, req.id, why); toast.success('Solicitação cancelada'); }); }}>Cancelar pedido</Button>}
      </div>
    </section>)}
    <Dialog open={!!current} onOpenChange={(o) => { if (!o) setCurrent(null); }}><DialogContent>{current && <>
      <DialogHeader><DialogTitle>Atendimento {cfg.label} · {current.p.name}</DialogTitle></DialogHeader>
      <div className="grid gap-3 text-sm">
        <div className="rounded-md bg-muted/50 p-2">Leito {current.p.bed || '—'} · {current.req.region} · {current.req.detail} · {current.req.priority}<div className="text-muted-foreground">"{current.req.justification}" — {current.req.requestedBy}</div></div>
        <label className="grid gap-1">{cfg.reportLabel}<textarea autoFocus className="min-h-32 rounded-md border bg-background p-2" value={report} onChange={(e) => setReport(e.target.value)} /></label>
        <Button disabled={!report.trim()} onClick={() => { if (!window.confirm(`Concluir atendimento de ${cfg.label} de ${current.p.name}?`)) return; run(() => { completeService(current.p.id, current.req.id, report); setCurrent(null); toast.success('Atendimento concluído e registrado no prontuário'); }); }}>Concluir atendimento</Button>
      </div></>}
    </DialogContent></Dialog>
  </div>;
}
