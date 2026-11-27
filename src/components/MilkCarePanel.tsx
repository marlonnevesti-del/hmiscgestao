import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { Printer, Save, Plus, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SigtapPicker } from './SigtapPicker';
import { Letterhead } from './DischargePrint';
import { printProcedure } from './ProcedurePrint';
import { canAct } from '@/lib/hospital-data';
import { createSectorRequest, openEncounter, requestExam, saveMilkCare, useStore } from '@/lib/hospital-store';
import { MILK_REASONS } from '@/lib/milk-care';
import type { ExtraProcedure } from '@/lib/care-flow';
import type { Depot } from '@/lib/supply-flow';

const selectClass = 'h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm';
const attempt = (fn: () => void) => { try { fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); } };
const blank = { reason: 'Atendimento no Banco de Leite', assessment: '', conduct: '', plan: '', cid: '', council: '', consultationCode: '', procedures: [] as ExtraProcedure[] };

export function MilkCarePanel() {
  const patients = useStore((s) => s.patients); const encounters = useStore((s) => s.encounters);
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  const [mode, setMode] = useState('amb'); const [patientId, setPatientId] = useState('');
  const [q, setQ] = useState(''); const [day, setDay] = useState(''); const [encId, setEncId] = useState('');
  const [form, setForm] = useState(blank); const [printId, setPrintId] = useState('');
  const list = encounters.filter((e) => (mode === 'amb' ? e.type === 'Ambulatório' && e.specialty === 'Banco de Leite' : !!e.fia && e.status_fluxo !== 'ALTA_HOSPITALAR') && (!day || e.openedAt.slice(0, 10) === day) && `${patients.find((p) => p.id === e.patientId)?.name} ${e.number}`.toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR'))).slice().reverse();
  const enc = encounters.find((e) => e.id === encId); const patient = patients.find((p) => p.id === enc?.patientId);
  const records = enc?.milkCare ?? []; const printed = records.find((r) => r.id === printId);
  const editable = !!enc && enc.status_fluxo !== 'ALTA_HOSPITALAR' && canAct(profile, 'evoluir', areas);
  const open = () => attempt(() => {
    const p = patients.find((x) => x.id === patientId); if (!p) throw new Error('Selecione uma paciente cadastrada.');
    const e = openEncounter(p, 'Ambulatório', 'Banco de Leite', form.reason);
    setEncId(e.id); toast.success('BAA do Banco de Leite aberto.');
  });
  const save = (finish: boolean) => attempt(() => {
    if (!enc) return;
    if (finish && !window.confirm('Finalizar este atendimento do Banco de Leite e encerrar seu BAA?')) return;
    saveMilkCare(enc.id, form, finish); setForm({ ...blank, council: form.council });
    toast.success(finish ? 'Atendimento finalizado e disponível para conferência no Faturamento.' : 'Evolução salva no prontuário.');
  });
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Button variant={mode === 'amb' ? 'default' : 'outline'} onClick={() => { setMode('amb'); setEncId(''); setForm(blank); }}>Ambulatorial / Doadoras</Button><Button variant={mode === 'int' ? 'default' : 'outline'} onClick={() => { setMode('int'); setEncId(''); setForm(blank); }}>Pacientes internados</Button></div>
    {mode === 'amb' && canAct(profile, 'recepcao', areas) && <div className="grid gap-3 border-b pb-4 sm:grid-cols-2">
      <label className="grid gap-1 text-xs">Paciente cadastrada<Input aria-label="Buscar paciente para BAA" value={q} onChange={(e) => setQ(e.target.value)} /><select aria-label="Paciente para BAA" className={selectClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Selecione</option>{patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80).map((p) => <option value={p.id} key={p.id}>{p.name} · {p.prontuario}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Motivo<select className={selectClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>{MILK_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
      <div className="text-sm text-muted-foreground">Eletiva · Setor / Sala: Banco de Leite</div><Button onClick={open}><Plus className="mr-1 h-4 w-4" />Abrir BAA</Button>
    </div>}
    <div className="grid gap-2 sm:grid-cols-3"><Input aria-label="Buscar atendimento BLH" placeholder="Paciente ou BAA/FIA" value={q} onChange={(e) => setQ(e.target.value)} /><Input aria-label="Data do atendimento BLH" type="date" value={day} onChange={(e) => setDay(e.target.value)} /><Button variant="outline" onClick={() => { setQ(''); setDay(''); }}>Limpar filtros</Button></div>
    <label className="grid gap-1 text-xs">Atendimento<select aria-label="Atendimento BLH" className={selectClass} value={encId} onChange={(e) => { setEncId(e.target.value); setForm(blank); setPrintId(''); }}><option value="">Selecione</option>{list.map((e) => <option key={e.id} value={e.id}>{patients.find((p) => p.id === e.patientId)?.name} · {e.fia?.number ?? e.number} · {e.status_fluxo === 'ALTA_HOSPITALAR' ? 'Finalizado' : 'Aberto'}</option>)}</select></label>
    {enc && patient && <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"><strong>{patient.name} · {enc.fia?.number ?? enc.number} {enc.fia ? `· ${patient.ward} ${patient.bed}` : ''}</strong><Button asChild variant="outline" size="sm"><Link to="/pacientes/$id" params={{ id: patient.id }}>Prontuário</Link></Button></div>
      {editable && <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">Motivo do atendimento<select className={selectClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>{MILK_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="grid gap-1 text-xs">COREN / CRM<Input value={form.council} onChange={(e) => setForm({ ...form, council: e.target.value })} /></label>
        {(['assessment', 'conduct', 'plan'] as const).map((key) => <label key={key} className="grid gap-1 text-xs sm:col-span-2">{key === 'assessment' ? 'Avaliação clínica / mamária' : key === 'conduct' ? 'Conduta realizada' : 'Plano e orientações'}<textarea rows={4} className="w-full resize-y rounded-md border bg-background p-2 text-sm" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
        <label className="grid gap-1 text-xs">CID da avaliação<Input value={form.cid} onChange={(e) => setForm({ ...form, cid: e.target.value })} /></label>
        {mode === 'amb' && <label className="grid gap-1 text-xs">Consulta efetivamente realizada<select aria-label="Consulta efetivamente realizada" className={selectClass} value={form.consultationCode} onChange={(e) => setForm({ ...form, consultationCode: e.target.value })}><option value="">Selecione</option><option value="0301010048">0301010048 · Profissional de nível superior (não médico)</option><option value="0301010072">0301010072 · Consulta médica especializada</option></select></label>}
        <h3 className="font-semibold sm:col-span-2">Exames efetivamente realizados / confirmados</h3>
        <SigtapPicker onPick={(p) => { if (!p.c.startsWith('02')) { toast.error('Selecione exames do grupo 02.'); return; } if (!form.procedures.some((x) => x.code === p.c)) setForm({ ...form, procedures: [...form.procedures, { id: crypto.randomUUID(), code: p.c, name: p.n, at: '', by: '' }] }); }} />
        <div className="space-y-2 sm:col-span-2">{form.procedures.map((p) => <div key={p.id} className="flex items-center justify-between gap-2 border-b py-1 text-sm"><span>{p.code} · {p.name}</span><Button size="icon" variant="ghost" aria-label={`Remover ${p.name}`} onClick={() => setForm({ ...form, procedures: form.procedures.filter((x) => x.id !== p.id) })}><X className="h-4 w-4" /></Button></div>)}</div>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button onClick={() => save(false)}><Save className="mr-1 h-4 w-4" />Salvar evolução</Button>{mode === 'amb' && <Button onClick={() => save(true)}>Salvar e finalizar atendimento</Button>}
          {canAct(profile, 'prescrever', areas) && <Button variant="outline" disabled={!form.procedures.length} onClick={() => attempt(() => { const r = requestExam(enc.id, { kind: 'laboratorial', exams: form.procedures.map((p) => p.name).join('; '), items: form.procedures.map((p) => ({ name: p.name, sigtapCode: p.code })), justification: form.assessment, cid: form.cid, council: form.council }); setForm({ ...form, procedures: [] }); toast.success(`Pedido ${r.orderNumber} gerado; ainda não faturado como realizado.`); })}><Send className="mr-1 h-4 w-4" />Solicitar exames (a realizar)</Button>}
        </div>
      </div>}
      <h3 className="font-semibold">Histórico de evoluções</h3>{!records.length && <p className="text-sm text-muted-foreground">Nenhuma evolução do Banco de Leite neste atendimento.</p>}
      {records.slice().reverse().map((r) => <div className="space-y-2 border-b pb-3" key={r.id}><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{r.reason} · {new Date(r.at).toLocaleString('pt-BR')}</b><Button size="sm" variant="outline" onClick={() => { setPrintId(r.id); printProcedure(); }}><Printer className="mr-1 h-4 w-4" />Ficha + evolução</Button></div><p className="whitespace-pre-wrap text-sm">{r.assessment}\n{r.conduct}</p><div className="text-xs text-muted-foreground">{r.by} · {r.council}</div></div>)}
      {(enc.examRequests ?? []).map((r) => <div key={r.id} className="border-b py-2 text-sm">{r.orderNumber} · {r.exams} · {r.status}</div>)}
      {printed && typeof document !== 'undefined' && createPortal(<div className="proc-root print-doc-root">
        <section className="doc-page"><Letterhead title="BANCO DE LEITE · FICHA DE ATENDIMENTO" /><table className="doc-id"><tbody><tr><td>Paciente: {patient.name}</td><td>Documento: {enc.fia?.number ?? enc.number}</td></tr><tr><td>CNS: {patient.registration?.cns || 'Não informado'}</td><td>Nascimento: {patient.registration?.birthDate || 'Não informado'}</td></tr><tr><td>Setor / Sala: Banco de Leite</td><td>Tipo: {enc.fia ? 'Internação' : 'Eletiva'}</td></tr><tr><td>Motivo: {printed.reason}</td><td>CID: {printed.cid}</td></tr></tbody></table><h3>Procedimentos confirmados</h3><p>Consulta: {printed.consultationCode || 'Não registrada nesta evolução'}</p>{printed.procedures.map((p) => <p key={p.id}>{p.code} · {p.name}</p>)}<p>Profissional: {printed.by} · {printed.council}</p><p>Data: {new Date(printed.at).toLocaleString('pt-BR')}</p></section>
        <section className="doc-page"><Letterhead title="BANCO DE LEITE · EVOLUÇÃO CLÍNICA" /><p>{patient.name} · {enc.fia?.number ?? enc.number}</p><h3>Avaliação</h3><p className="pre">{printed.assessment}</p><h3>Conduta</h3><p className="pre">{printed.conduct}</p><h3>Plano e orientações</h3><p className="pre">{printed.plan}</p><div className="doc-sign"><div className="line" />{printed.by} · {printed.council}<br />{new Date(printed.at).toLocaleString('pt-BR')} · Registro eletrônico</div></section>
      </div>, document.body)}
    </>}
  </div>;
}

export function MilkSuppliesPanel() {
  const stock = useStore((s) => s.stock); const warehouse = useStore((s) => s.warehouse); const requests = useStore((s) => s.requests);
  const [target, setTarget] = useState<Depot>('almoxarifado'); const [q, setQ] = useState(''); const [itemId, setItemId] = useState(''); const [qty, setQty] = useState(''); const [note, setNote] = useState('');
  const [lines, setLines] = useState<string[]>([]); const products = target === 'farmacia' ? stock : warehouse;
  return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs">Destino<select aria-label="Destino dos insumos BLH" className={selectClass} value={target} onChange={(e) => { setTarget(e.target.value as Depot); setLines([]); setItemId(''); }}><option value="almoxarifado">Almoxarifado</option><option value="farmacia">Farmácia</option></select></label><div className="self-end text-sm">Setor / Centro de custo: Banco de Leite</div><Input aria-label="Buscar insumo BLH" placeholder="Nome ou código do produto" value={q} onChange={(e) => setQ(e.target.value)} /><select aria-label="Insumo BLH" className={selectClass} value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">Selecione o produto</option>{products.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} · {p.unit}</option>)}</select><Input aria-label="Quantidade do insumo BLH" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /><Button onClick={() => attempt(() => { const p = products.find((x) => x.id === itemId); if (!p || !Number.isInteger(Number(qty)) || Number(qty) <= 0) throw new Error('Selecione produto e quantidade inteira positiva.'); setLines([...lines, `${p.code ?? ''} · ${p.name}: ${qty} ${p.unit}`]); setQty(''); })}><Plus className="mr-1 h-4 w-4" />Adicionar insumo</Button></div>
    {lines.map((line, i) => <div key={i} className="flex items-center justify-between gap-2 border-b py-1 text-sm"><span>{line}</span><Button size="icon" variant="ghost" aria-label={`Remover insumo ${i + 1}`} onClick={() => setLines(lines.filter((_, n) => n !== i))}><X className="h-4 w-4" /></Button></div>)}
    <Input aria-label="Observação dos insumos BLH" placeholder="Observação" value={note} onChange={(e) => setNote(e.target.value)} /><Button disabled={!lines.length} onClick={() => attempt(() => { createSectorRequest('Banco de Leite', lines.join('\n'), note, target); setLines([]); setNote(''); toast.success('Requisição enviada.'); })}><Send className="mr-1 h-4 w-4" />Enviar requisição</Button>
    <h3 className="font-semibold">Requisições do Banco de Leite</h3>{requests.filter((r) => r.sector === 'Banco de Leite').map((r) => <div key={r.id} className="border-b py-2 text-sm"><b>{r.target === 'farmacia' ? 'Farmácia' : 'Almoxarifado'} · {r.status}</b><p className="whitespace-pre-wrap">{r.items}</p><small>{new Date(r.at).toLocaleString('pt-BR')} · {r.by}{r.answer ? ` · ${r.answer}` : ''}</small></div>)}
  </div>;
}