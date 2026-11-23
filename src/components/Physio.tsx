import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { can, type Patient } from '@/lib/hospital-data';
import { cancelPhysio, requestPhysio, useStore } from '@/lib/hospital-store';
import { PHYSIO_MODALITIES, PHYSIO_SUPPORT, PHYSIO_FREQUENCIES, frequencyBadge, type PhysioFrequency, isPhysioOpen, sortPhysio, type PhysioModality, type PhysioPriority, type PhysioRequest } from '@/lib/physio';
import { cn } from '@/lib/utils';

const run = (fn: () => void) => { try { fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Ação não concluída'); } };
const field = 'h-9 w-full rounded-md border bg-background px-2 text-sm';
const since = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`; };

/** Botão do atendimento médico: abre o pedido de fisioterapia. */
export function PhysioRequestButton({ p }: { p: Patient }) {
  const profile = useStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ modality: 'Respiratória' as PhysioModality, priority: 'Rotina' as PhysioPriority, frequency: '1X' as PhysioFrequency, support: 'Ar ambiente', justification: '' });
  const openReq = (p.physio ?? []).filter(isPhysioOpen);
  return <>
    <Button variant="outline" disabled={!can(profile, 'prescrever')} onClick={() => setOpen(true)}>Solicitar fisioterapia{openReq.length ? ` (${openReq.length} ativa)` : ''}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Solicitar fisioterapia · {p.name}</DialogTitle></DialogHeader>
      <div className="grid gap-3 text-sm">
        <label className="grid gap-1">Modalidade<select className={field} value={f.modality} onChange={(e) => setF({ ...f, modality: e.target.value as PhysioModality })}>{PHYSIO_MODALITIES.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="grid gap-1">Prioridade<select className={field} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as PhysioPriority })}><option>Rotina</option><option>Urgente</option></select></label>
        <fieldset className="grid gap-1"><legend>Frequência / Quantidade</legend>{PHYSIO_FREQUENCIES.map((o) => <label key={o.id} className="flex items-center gap-2"><input type="radio" name="physio-freq" checked={f.frequency === o.id} onChange={() => setF({ ...f, frequency: o.id })} />{o.label}</label>)}</fieldset>
        <label className="grid gap-1">Suporte ventilatório atual<select className={field} value={f.support} onChange={(e) => setF({ ...f, support: e.target.value })}>{PHYSIO_SUPPORT.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label className="grid gap-1">Indicação / justificativa<textarea className="min-h-20 rounded-md border bg-background p-2" value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} /></label>
        <Button onClick={() => { if (!window.confirm(`Confirmar envio do pedido de fisioterapia para ${p.name}?`)) return; run(() => { requestPhysio(p.id, f); setOpen(false); setF({ ...f, justification: '' }); toast.success('Pedido enviado para a Fisioterapia'); }); }}>Enviar solicitação</Button>
      </div>
    </DialogContent></Dialog>
  </>;
}

type Row = { p: Patient; req: PhysioRequest };

export function PhysioBoard() {
  const patients = useStore((s) => s.patients); const profile = useStore((s) => s.profile);
  const [tab, setTab] = useState<'Aguardando' | 'Em acompanhamento' | 'hist'>('Aguardando');
  const [sector, setSector] = useState('');
  const navigate = useNavigate();
  const rows: Row[] = patients.flatMap((p) => (p.physio ?? []).map((req) => ({ p, req })));
  const sectors = [...new Set(rows.map((r) => r.p.ward))];
  const shown = sortPhysio(rows.filter((r) => (tab === 'hist' ? !isPhysioOpen(r.req) || r.req.sessions.length : r.req.status === tab) && (!sector || r.p.ward === sector)));
  const count = (s: string) => rows.filter((r) => r.req.status === s).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {([['Aguardando', `Aguardando atendimento (${count('Aguardando')})`], ['Em acompanhamento', `Em acompanhamento (${count('Em acompanhamento')})`], ['hist', 'Histórico de sessões']] as const).map(([id, l]) => <Button key={id} variant={tab === id ? 'default' : 'outline'} onClick={() => setTab(id)}>{l}</Button>)}
      <select aria-label="Setor" className="ml-auto h-9 rounded-md border bg-background px-2 text-sm" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Todos os setores</option>{sectors.map((s) => <option key={s}>{s}</option>)}</select>
    </div>
    {!shown.length && <p className="py-6 text-muted-foreground">Nenhuma solicitação nesta lista.</p>}
    {shown.map(({ p, req }) => <section key={req.id} className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><b>{p.name}</b> <span className="text-sm text-muted-foreground">({p.age})</span><div className="text-sm text-muted-foreground">Leito: {p.bed || '—'} · Setor: {p.ward}</div></div>
        <div className="flex gap-2 text-xs"><span className={cn('rounded px-2 py-1 font-semibold', req.priority === 'Urgente' ? 'bg-destructive/15 text-destructive' : 'bg-muted')}>{req.priority.toUpperCase()}</span>{req.frequency && <span className={cn('rounded px-2 py-1 font-semibold', req.frequency === 'Agora' ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary')}>{frequencyBadge(req)}</span>}<span className="rounded bg-muted px-2 py-1">{req.modality}</span><span className="rounded bg-muted px-2 py-1">{req.status}</span></div>
      </div>
      <div className="mt-2 border-t pt-2 text-sm">
        <div className="text-muted-foreground">Solicitante: {req.requestedBy} · {since(req.requestedAt)} · Suporte: {req.support}</div>
        <p className="mt-1">"{req.justification}"</p>
        {req.closedNote && <p className="text-xs text-destructive">Cancelada: {req.closedNote}</p>}
        {req.sessions.map((s) => <div key={s.id} className="mt-2 rounded-md bg-muted/50 p-2 text-xs"><b>{new Date(s.at).toLocaleString('pt-BR')} · {s.by}</b><div>{s.conduct}</div>{(s.pre || s.post) && <div className="text-muted-foreground">Pré: {s.pre || '—'} · Pós: {s.post || '—'}</div>}</div>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isPhysioOpen(req) && <Button disabled={!can(profile, 'evoluir')} onClick={() => navigate({ to: '/pacientes/$id', params: { id: p.id } })}>{req.status === 'Aguardando' ? 'Iniciar atendimento' : 'Evoluir fisioterapia'}</Button>}
        <Button variant="outline" asChild><Link to="/pacientes/$id" params={{ id: p.id }}>Ver prontuário</Link></Button>
        {isPhysioOpen(req) && can(profile, 'prescrever') && <Button variant="ghost" onClick={() => { const why = window.prompt('Motivo do cancelamento:'); if (why == null) return; run(() => { cancelPhysio(p.id, req.id, why); toast.success('Solicitação cancelada'); }); }}>Cancelar pedido</Button>}
      </div>
    </section>)}
  </div>;
}

