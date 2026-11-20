import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Baby, CalendarClock, Droplets, FlaskConical, Milk } from 'lucide-react';
import { NoPermission } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { canAccessPage, type Patient } from '@/lib/hospital-data';
import { addMilkDonor, addRawBottle, discardRawBottle, dispenseMilk, finishMilkBatch, scheduleMilkBatch, setMilkRecipient, toggleMilkDonor, useStore } from '@/lib/hospital-store';
import { DORNIC_MAX, EMPTY_MILK_BANK, autonomyDays, caloricClass, dailyNeed, daysLeft, lhpStock, milkReport, nextPasteurization, rawExpiresAt, rawStock, sum } from '@/lib/milk-bank';

export const Route = createFileRoute('/_authenticated/banco-de-leite')({
  head: () => ({ meta: [
    { title: 'Banco de Leite Humano – HMI Gestão' },
    { name: 'description', content: 'Estoque de leite cru e pasteurizado, pasteurização, controle de qualidade e bebês receptores de LHP.' },
    { property: 'og:title', content: 'Banco de Leite Humano – HMI Gestão' },
    { property: 'og:description', content: 'Gestão do BLH: estoques, lotes de pasteurização, receptores e indicadores mensais.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Page,
});

const dt = (iso?: string) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const run = (fn: () => void, ok: string) => { try { fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); } };
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="grid gap-1 text-xs font-medium">{label}{children}</label>;
const sel = 'h-9 rounded-md border bg-background px-2 text-sm';

function Page() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  const raw = useStore((s) => s.milkBank); const m = raw ?? EMPTY_MILK_BANK;
  const patients = useStore((s) => s.patients);
  if (!canAccessPage(profile, '/banco-de-leite', areas)) return <NoPermission action="acessar o Banco de Leite" />;
  const cru = rawStock(m); const lhp = lhpStock(m); const next = nextPasteurization(m); const auto = autonomyDays(m);
  const users = m.recipients.filter((r) => r.active);
  const oldest = cru.map((b) => daysLeft(rawExpiresAt(b))).sort((a, b) => a - b)[0];
  const cards = [
    { icon: Milk, title: 'Leite pasteurizado (LHP)', value: `${sum(lhp, 'remaining')} mL`, sub: auto == null ? 'Sem receptores ativos' : `Autonomia de ${auto} dia(s)`, warn: auto != null && auto < 2 },
    { icon: Droplets, title: 'Leite cru (LHC)', value: `${sum(cru)} mL`, sub: oldest == null ? 'Nenhum frasco' : `${cru.length} frasco(s) · mais antigo vence em ${oldest} dia(s)`, warn: oldest != null && oldest <= 3 },
    { icon: CalendarClock, title: 'Próxima pasteurização', value: next ? dt(next.scheduledAt) : 'Não agendada', sub: next ? `${next.code} · ${next.volume} mL` : 'Agende na aba Pasteurização', warn: !next && cru.length > 0 },
    { icon: Baby, title: 'Crianças em uso de LHP', value: `${users.length}`, sub: `${dailyNeed(m)} mL/dia prescritos`, warn: false },
  ];
  return <div className="space-y-4 p-4">
    <h1 className="text-2xl font-bold">Banco de Leite Humano</h1>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((c) => <div key={c.title} className={`rounded-lg border bg-card p-4 ${c.warn ? 'border-destructive' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><c.icon className="h-4 w-4" />{c.title}</div>
      <div className="mt-1 text-2xl font-semibold">{c.value}</div><div className={`text-xs ${c.warn ? 'text-destructive' : 'text-muted-foreground'}`}>{c.sub}</div></div>)}</div>
    <Tabs defaultValue="cru"><TabsList className="flex-wrap">
      <TabsTrigger value="cru">Leite cru</TabsTrigger><TabsTrigger value="past">Pasteurização</TabsTrigger><TabsTrigger value="lhp">Estoque LHP</TabsTrigger>
      <TabsTrigger value="rec">Receptores</TabsTrigger><TabsTrigger value="doad">Doadoras</TabsTrigger><TabsTrigger value="rel">Relatório mensal</TabsTrigger></TabsList>
      <TabsContent value="cru"><RawTab /></TabsContent><TabsContent value="past"><PastTab /></TabsContent><TabsContent value="lhp"><LhpTab /></TabsContent>
      <TabsContent value="rec"><RecTab patients={patients} /></TabsContent><TabsContent value="doad"><DonorTab /></TabsContent><TabsContent value="rel"><ReportTab /></TabsContent>
    </Tabs>
  </div>;
}

const useMilk = () => useStore((s) => s.milkBank) ?? EMPTY_MILK_BANK;
const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{head.map((h) => <th key={h} className="p-2 text-left font-medium">{h}</th>)}</tr></thead>
  <tbody>{rows.length ? rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>) : <tr><td colSpan={head.length} className="p-4 text-center text-muted-foreground">Nenhum registro.</td></tr>}</tbody></table></div>;

function RawTab() {
  const m = useMilk(); const donors = m.donors.filter((d) => d.active);
  const [f, setF] = useState({ donorId: '', collectedAt: new Date().toISOString().slice(0, 16), volume: '', homeVisit: false });
  const name = (id: string) => m.donors.find((d) => d.id === id)?.name ?? '—';
  const list = m.raw.filter((b) => b.status === 'Estoque' || b.status === 'Em lote').sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
  return <div className="space-y-3">
    <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_200px_120px_auto_auto] md:items-end">
      <Field label="Doadora"><select className={sel} value={f.donorId} onChange={(e) => setF({ ...f, donorId: e.target.value })}><option value="">Selecione…</option>{donors.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.origin})</option>)}</select></Field>
      <Field label="Data/hora da ordenha"><Input type="datetime-local" value={f.collectedAt} onChange={(e) => setF({ ...f, collectedAt: e.target.value })} /></Field>
      <Field label="Volume (mL)"><Input type="number" min={1} value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.homeVisit} onChange={(e) => setF({ ...f, homeVisit: e.target.checked })} />Coleta domiciliar</label>
      <Button onClick={() => run(() => { addRawBottle({ ...f, volume: Number(f.volume) }); setF({ ...f, volume: '' }); }, 'Frasco registrado no freezer de leite cru')}>Registrar frasco</Button>
    </div>
    {!donors.length && <p className="text-sm text-muted-foreground">Cadastre uma doadora na aba Doadoras para registrar frascos.</p>}
    <Table head={['Frasco', 'Doadora', 'Ordenha', 'Volume', 'Validade', 'Situação', '']} rows={list.map((b) => { const d = daysLeft(rawExpiresAt(b)); return [b.code, name(b.donorId), dt(b.collectedAt), `${b.volume} mL`,
      <span className={d <= 3 ? 'font-semibold text-destructive' : ''}>{d > 0 ? `${d} dia(s)` : 'Vencido'}</span>, b.status,
      b.status === 'Estoque' ? <Button size="sm" variant="outline" onClick={() => { const n = prompt('Motivo do descarte:', d > 0 ? '' : 'Validade expirada'); if (n) run(() => discardRawBottle(b.id, n), 'Frasco descartado'); }}>Descartar</Button> : null]; })} />
  </div>;
}

function PastTab() {
  const m = useMilk(); const cru = rawStock(m);
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 86_400_000); d.setHours(8, 0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [picked, setPicked] = useState<string[]>([]);
  const [res, setRes] = useState<Record<string, { dornic: string; crematocrit: string; microOk: boolean }>>({});
  const scheduled = m.batches.filter((b) => b.status === 'Agendado');
  const done = m.batches.filter((b) => b.status !== 'Agendado').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 30);
  return <div className="space-y-4">
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Agendar pasteurização</h2>
      <div className="flex flex-wrap items-end gap-3"><Field label="Data/hora"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Button size="sm" variant="outline" onClick={() => setPicked(cru.map((b) => b.id))}>Selecionar todos</Button>
        <Button onClick={() => run(() => { scheduleMilkBatch(when, picked); setPicked([]); }, 'Pasteurização agendada')}>Agendar lote ({sum(cru.filter((b) => picked.includes(b.id)))} mL)</Button></div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{cru.map((b) => <label key={b.id} className="flex items-center gap-2 rounded border p-2 text-sm"><input type="checkbox" checked={picked.includes(b.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, b.id] : picked.filter((x) => x !== b.id))} />{b.code} · {b.volume} mL · vence em {daysLeft(rawExpiresAt(b))} d</label>)}
        {!cru.length && <p className="text-sm text-muted-foreground">Sem leite cru disponível.</p>}</div>
    </div>
    <div className="space-y-2"><h2 className="font-semibold">Lotes agendados — registrar resultado (62,5 °C por 30 min)</h2>
      {scheduled.map((b) => { const r = res[b.id] ?? { dornic: '', crematocrit: '', microOk: true }; const set = (p: Partial<typeof r>) => setRes({ ...res, [b.id]: { ...r, ...p } });
        return <div key={b.id} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_120px_140px_auto_auto] md:items-end">
          <div><div className="font-medium">{b.code}</div><div className="text-xs text-muted-foreground">{dt(b.scheduledAt)} · {b.bottleIds.length} frasco(s) · {b.volume} mL</div></div>
          <Field label={`Acidez Dornic (≤ ${DORNIC_MAX} °D)`}><Input type="number" step="0.1" value={r.dornic} onChange={(e) => set({ dornic: e.target.value })} /></Field>
          <Field label="Crematócrito (%)"><Input type="number" step="0.1" value={r.crematocrit} onChange={(e) => set({ crematocrit: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.microOk} onChange={(e) => set({ microOk: e.target.checked })} />Microbiológico negativo</label>
          <Button onClick={() => { if (r.dornic === '' || r.crematocrit === '') { toast.error('Informe Dornic e crematócrito.'); return; } const ok = finishMilkBatch(b.id, { dornic: Number(r.dornic), crematocrit: Number(r.crematocrit), microOk: r.microOk }); ok ? toast.success('Lote aprovado e liberado no estoque LHP') : toast.error('Lote reprovado e descartado'); }}>Concluir</Button>
        </div>; })}
      {!scheduled.length && <p className="text-sm text-muted-foreground">Nenhuma pasteurização agendada.</p>}</div>
    <Table head={['Lote', 'Concluído', 'Volume', 'Dornic', 'Kcal/L', 'Resultado', 'Responsável']} rows={done.map((b) => [b.code, dt(b.doneAt), `${b.volume} mL`, `${b.dornic ?? '—'} °D`, b.kcal ? `${b.kcal} (${caloricClass(b.kcal)})` : '—', <span className={b.status === 'Reprovado' ? 'text-destructive' : ''}>{b.status}</span>, b.doneBy ?? '—'])} />
  </div>;
}

function LhpTab() {
  const m = useMilk(); const patients = useStore((s) => s.patients); const lhp = lhpStock(m);
  const [f, setF] = useState({ batchId: '', patientId: '', volume: '' });
  const recips = m.recipients.filter((r) => r.active).map((r) => patients.find((p) => p.id === r.patientId)).filter(Boolean);
  const pname = (id: string) => patients.find((p) => p.id === id)?.name ?? '—';
  return <div className="space-y-3">
    <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_1fr_120px_auto] md:items-end">
      <Field label="Lote LHP"><select className={sel} value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })}><option value="">Selecione…</option>{lhp.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.remaining} mL · {b.kcal ? caloricClass(b.kcal) : ''}</option>)}</select></Field>
      <Field label="Bebê receptor"><select className={sel} value={f.patientId} onChange={(e) => setF({ ...f, patientId: e.target.value })}><option value="">Selecione…</option>{recips.map((p) => <option key={p!.id} value={p!.id}>{p!.name} · {p!.ward} {p!.bed}</option>)}</select></Field>
      <Field label="Volume (mL)"><Input type="number" min={1} value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} /></Field>
      <Button onClick={() => { if (!f.patientId) { toast.error('Selecione o bebê.'); return; } run(() => { dispenseMilk(f.batchId, f.patientId, Number(f.volume)); setF({ ...f, volume: '' }); }, 'Dispensação registrada'); }}>Dispensar</Button>
    </div>
    <Table head={['Lote', 'Pasteurizado', 'Disponível', 'Teor calórico', 'Validade']} rows={lhp.map((b) => [b.code, dt(b.doneAt), `${b.remaining} / ${b.volume} mL`, b.kcal ? `${b.kcal} kcal/L · ${caloricClass(b.kcal)}` : '—', b.expiresAt ? `${daysLeft(b.expiresAt)} dia(s)` : '—'])} />
    <h2 className="font-semibold">Últimas dispensações</h2>
    <Table head={['Data', 'Bebê', 'Lote', 'Volume', 'Por']} rows={[...m.dispenses].reverse().slice(0, 30).map((d) => [dt(d.at), pname(d.patientId), m.batches.find((b) => b.id === d.batchId)?.code ?? '—', `${d.volume} mL`, d.by])} />
  </div>;
}

function RecTab({ patients }: { patients: Patient[] }) {
  const m = useMilk();
  const babies = useMemo(() => patients.filter((p) => p.type === 'neonato' || p.ward === 'UTIN' || p.ward === 'UCI'), [patients]);
  const [edit, setEdit] = useState<Record<string, { ml: string; n: string }>>({});
  const today = new Date().toISOString().slice(0, 10);
  return <div className="space-y-2"><p className="text-sm text-muted-foreground">Bebês da UTI Neonatal, UCI e recém-nascidos. Informe a prescrição de LHP (mL por mamada × mamadas/dia).</p>
    <Table head={['Bebê', 'Setor/Leito', 'Peso', 'mL/mamada', 'Mamadas/dia', 'Total/dia', 'Recebido hoje', '']} rows={babies.map((p) => {
      const r = m.recipients.find((x) => x.patientId === p.id); const e = edit[p.id] ?? { ml: String(r?.mlPerFeed ?? ''), n: String(r?.feedsPerDay ?? 8) };
      const got = m.dispenses.filter((d) => d.patientId === p.id && d.at.slice(0, 10) === today).reduce((t, d) => t + d.volume, 0);
      return [<span className={r?.active ? 'font-semibold' : ''}>{p.name}</span>, `${p.ward} ${p.bed}`, p.weight ? `${p.weight} g` : '—',
        <Input className="h-8 w-20" type="number" value={e.ml} onChange={(ev) => setEdit({ ...edit, [p.id]: { ...e, ml: ev.target.value } })} />,
        <Input className="h-8 w-20" type="number" value={e.n} onChange={(ev) => setEdit({ ...edit, [p.id]: { ...e, n: ev.target.value } })} />,
        r?.active ? `${r.mlPerFeed * r.feedsPerDay} mL` : '—', `${got} mL`,
        <Button size="sm" variant="outline" onClick={() => run(() => setMilkRecipient(p.id, Number(e.ml) || 0, Number(e.n) || 0), Number(e.ml) > 0 ? 'Prescrição de LHP salva' : 'Bebê retirado do uso de LHP')}>Salvar</Button>];
    })} /></div>;
}

function DonorTab() {
  const m = useMilk(); const [f, setF] = useState({ name: '', phone: '', origin: 'Interna' as 'Interna' | 'Domiciliar', serologyOk: false });
  return <div className="space-y-3">
    <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_160px_150px_auto_auto] md:items-end">
      <Field label="Nome da doadora"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Telefone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Origem"><select className={sel} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value as 'Interna' })}><option>Interna</option><option>Domiciliar</option></select></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.serologyOk} onChange={(e) => setF({ ...f, serologyOk: e.target.checked })} />Sorologias negativas (HIV, VDRL, Hep. B/C)</label>
      <Button onClick={() => run(() => { addMilkDonor(f); setF({ ...f, name: '', phone: '' }); }, 'Doadora cadastrada')}>Cadastrar</Button>
    </div>
    <Table head={['Doadora', 'Origem', 'Telefone', 'Triagem', 'Doado', 'Situação', '']} rows={m.donors.map((d) => [d.name, d.origin, d.phone || '—', d.serologyOk ? 'Liberada' : <span className="text-destructive">Pendente</span>, `${sum(m.raw.filter((b) => b.donorId === d.id))} mL`, d.active ? 'Ativa' : 'Inativa',
      <Button size="sm" variant="outline" onClick={() => toggleMilkDonor(d.id)}>{d.active ? 'Inativar' : 'Reativar'}</Button>])} />
  </div>;
}

function ReportTab() {
  const m = useMilk(); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const r = milkReport(m, month);
  const rows: [string, string | number][] = [['Litros de leite recebidos', r.litrosRecebidos.toFixed(2)], ['Litros de leite pasteurizados', r.litrosPasteurizados.toFixed(2)], ['Litros distribuídos aos receptores', r.litrosDistribuidos.toFixed(2)],
    ['Exames microbiológicos realizados', r.examesMicrobiologicos], ['Crematócritos realizados', r.crematocritos], ['Lotes reprovados', r.lotesReprovados],
    ['Visitas domiciliares (coleta)', r.visitasDomiciliares], ['Doadoras ativas', r.doadorasAtivas], ['Bebês receptores no mês', r.receptores]];
  return <div className="space-y-3"><div className="flex items-end gap-3"><Field label="Competência"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field><Button variant="outline" onClick={() => window.print()}><FlaskConical className="mr-1 h-4 w-4" />Imprimir</Button></div>
    <p className="text-xs text-muted-foreground">Indicadores do Banco de Leite exigidos na Planilha de Supervisão (AT46) da SES/SC.</p>
    <Table head={['Indicador', 'Valor']} rows={rows.map(([k, v]) => [k, <span className="font-semibold">{v}</span>])} /></div>;
}
