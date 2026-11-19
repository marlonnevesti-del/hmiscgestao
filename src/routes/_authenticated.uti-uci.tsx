import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { Letterhead } from '@/components/DischargePrint';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoPermission } from '@/components/AppShell';
import { useStore, addIntensive, setIntensiveSafety, encounterFor } from '@/lib/hospital-store';
import { canAccessPage, type Patient } from '@/lib/hospital-data';
import { UNITS, BH_INPUTS, BH_OUTPUTS, DEVICES, balance, balance24h, scaleSum, bundleAdherencePct, type IcuUnit, type IcuScaleDef, NEO_FORMS, neoReport, type NeoKind } from '@/lib/uti-uci';

export const Route = createFileRoute('/_authenticated/uti-uci')({
  head: () => ({ meta: [
    { title: 'UTI Pediátrica e UCI – HMI Gestão' },
    { name: 'description', content: 'Gestão assistencial separada da UTI Pediátrica e da UCI: escalas, balanço hídrico, bundles, SBAR e evoluções.' },
    { property: 'og:title', content: 'UTI Pediátrica e UCI – HMI Gestão' },
    { property: 'og:description', content: 'Escalas, balanço hídrico, bundles e evoluções por unidade intensiva.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Page,
});

const run = (fn: () => void, ok: string) => { try { fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); } };
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-lg border bg-card p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3>{children}</div>;
const dt = (s: string) => new Date(s).toLocaleString('pt-BR');

function Page() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  if (!canAccessPage(profile, '/uti-uci', areas)) return <NoPermission action="acessar a UTI Pediátrica e UCI" />;
  return <div className="space-y-4 p-4"><h1 className="text-2xl font-bold">UTI Pediátrica · UCI · UTI Neonatal</h1>
    <Tabs defaultValue="UTIP"><TabsList><TabsTrigger value="UTIP">UTI Pediátrica</TabsTrigger><TabsTrigger value="UCI">UCI</TabsTrigger><TabsTrigger value="UTIN">UTI Neonatal</TabsTrigger><TabsTrigger value="neorel">Indicadores UTI Neo</TabsTrigger></TabsList>
      <TabsContent value="UTIP"><Unit u="UTIP" /></TabsContent><TabsContent value="UCI"><Unit u="UCI" /></TabsContent><TabsContent value="UTIN"><Unit u="UTIN" /></TabsContent><TabsContent value="neorel"><NeoReport /></TabsContent></Tabs></div>;
}

function Unit({ u }: { u: IcuUnit }) {
  const cfg = UNITS[u];
  const all = useStore((s) => s.patients); const patients = all.filter((p) => p.ward === cfg.ward);
  const [sel, setSel] = useState<string>('');
  const p = patients.find((x) => x.id === sel) ?? patients[0];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{cfg.profile}</span>
      <Button asChild size="sm" variant="outline"><Link to="/solicitacao-almoxarifado"><ClipboardList className="mr-1 h-4 w-4" />Solicitar ao Almoxarifado ({cfg.almoxSectors.join(' / ')})</Link></Button></div>
    {!patients.length ? <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum paciente internado na {cfg.name}. Os pacientes aparecem aqui quando o NIR libera um leito desta unidade.</div> : <>
      <div className="flex flex-wrap gap-2">{patients.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-md border px-3 py-2 text-left text-xs ${x.id === p?.id ? 'bg-primary text-primary-foreground' : 'bg-card'}`}><b>{x.bed}</b> · {x.name}<div>{x.age} · {x.weight} kg</div></button>)}</div>
      {p && <PatientPanel key={p.id} u={u} p={p} />}
    </>}
  </div>;
}

function SafetyBanner({ p }: { p: Patient }) {
  const s = p.intensive?.safety; const iso = '';
  return <div className="space-y-1 rounded-lg border-2 border-destructive/50 bg-destructive/5 p-3 text-sm">
    <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Alertas de segurança</div>
    <div><b>Alergias:</b> {p.allergies.length ? <span className="font-bold text-destructive">{p.allergies.join(', ')}</span> : 'Nenhuma informada'}</div>
    <div><b>Uso contínuo:</b> {s?.continuous || '—'}</div>
    <div><b>Precaução / SCIRAS:</b> {s?.precaution || iso || 'Padrão'}</div>
    <div><b>Dispositivos:</b> {s?.devices?.length ? s.devices.join(', ') : '—'}</div>
    <div><b>Dieta:</b> {s?.diet || '—'}</div>
  </div>;
}

function PatientPanel({ u, p }: { u: IcuUnit; p: Patient }) {
  return <div className="space-y-4"><SafetyBanner p={p} />
    <Tabs defaultValue={u === 'UTIN' ? 'neo' : 'escalas'}><TabsList className="flex-wrap">
      {[...(u === 'UTIN' ? ['neo'] : []), 'escalas', 'balanco', 'bundles', 'evolucao', 'sbar', 'exames', 'seguranca'].map((t) => <TabsTrigger key={t} value={t}>{({ neo: 'Neonatal', escalas: 'Escalas', balanco: 'Balanço hídrico', bundles: 'Bundles', evolucao: 'Evoluções', sbar: 'SAE · SBAR', exames: 'Exames', seguranca: 'Editar alertas' } as Record<string, string>)[t]}</TabsTrigger>)}
    </TabsList>
      <TabsContent value="neo"><Neo p={p} /></TabsContent>
      <TabsContent value="escalas"><Scales u={u} p={p} /></TabsContent>
      <TabsContent value="balanco"><Balance u={u} p={p} /></TabsContent>
      <TabsContent value="bundles"><Bundles u={u} p={p} /></TabsContent>
      <TabsContent value="evolucao"><Notes p={p} templates={UNITS[u].evolutions} /></TabsContent>
      <TabsContent value="sbar"><Notes p={p} templates={{ SBAR: 'S – Situação: \nB – Breve histórico: \nA – Avaliação: \nR – Recomendação: ', SAE: 'Diagnósticos de enfermagem: \nResultados esperados: \nIntervenções / aprazamento: ' }} /></TabsContent>
      <TabsContent value="exames"><Exams p={p} /></TabsContent>
      <TabsContent value="seguranca"><SafetyEdit p={p} /></TabsContent>
    </Tabs></div>;
}

function ScaleForm({ s, onSave }: { s: IcuScaleDef; onSave: (t: number, r: string) => void }) {
  const [picks, setPicks] = useState<number[]>(s.items.map(() => -1));
  const done = picks.every((x) => x >= 0); const total = scaleSum(picks.map((x, i) => x >= 0 ? (s.items[i]?.options[x]?.score ?? 0) : 0));
  return <Card title={s.name}><div className="space-y-2">{s.items.map((it, i) => <label key={it.label} className="block text-xs">{it.label}
    <select className="mt-1 w-full rounded border bg-background p-1" value={picks[i]} onChange={(e) => setPicks(picks.map((x, j) => j === i ? Number(e.target.value) : x))}><option value={-1}>Selecione…</option>{it.options.map((op, k) => <option key={k} value={k}>{op.score} – {op.label}</option>)}</select></label>)}
    <div className="text-sm">Total: <b>{total}</b> {done && <>· {s.interpret(total)}</>}</div>
    <Button size="sm" disabled={!done} onClick={() => { onSave(total, s.interpret(total)); setPicks(s.items.map(() => -1)); }}>Registrar</Button></div></Card>;
}
function Scales({ u, p }: { u: IcuUnit; p: Patient }) {
  const list = (p.intensive?.scales ?? []).slice().reverse();
  return <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="grid gap-3 md:grid-cols-2">{UNITS[u].scales.map((s) => <ScaleForm key={s.id} s={s} onSave={(total, result) => run(() => addIntensive(p.id, 'scales', { scale: s.name, total, result }), 'Escala registrada')} />)}</div>
    <Card title="Histórico">{list.length ? list.map((r) => <div key={r.id} className="border-b py-1 text-xs"><b>{r.scale}</b>: {r.total} – {r.result}<div className="text-muted-foreground">{dt(r.at)} · {r.by}</div></div>) : <p className="text-xs text-muted-foreground">Sem registros.</p>}</Card></div>;
}

function Balance({ u, p }: { u: IcuUnit; p: Patient }) {
  const horario = UNITS[u].balance === 'horario';
  const [period, setPeriod] = useState(horario ? '1h' : 'Manhã (6h)');
  const hours = horario ? Number(period.replace('h', '')) || 1 : 6;
  const [inp, setInp] = useState<Record<string, number>>({}); const [out, setOut] = useState<Record<string, number>>({});
  const [w, setW] = useState(p.weight);
  const r = balance({ inputs: inp, outputs: out, weightKg: w, hours });
  const list = (p.intensive?.balances ?? []).slice().reverse();
  const num = (set: typeof setInp, cur: Record<string, number>, k: string) => <label key={k} className="text-xs">{u === 'UCI' && k === 'Diurese' ? 'Diurese (peso fralda g)' : k}<input type="number" min={0} className="mt-1 w-full rounded border bg-background p-1" value={cur[k] ?? ''} onChange={(e) => set({ ...cur, [k]: Number(e.target.value) })} /></label>;
  return <div className="grid gap-4 lg:grid-cols-2"><Card title={horario ? 'Balanço horário (ml)' : 'Balanço por turno (ml)'}>
    <div className="mb-2 grid grid-cols-2 gap-2"><label className="text-xs">Período<select className="mt-1 w-full rounded border bg-background p-1" value={period} onChange={(e) => setPeriod(e.target.value)}>{(horario ? ['1h', '2h', '4h', '6h', '12h'] : ['Manhã (6h)', 'Tarde (6h)', 'Noite 1 (6h)', 'Noite 2 (6h)']).map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="text-xs">Peso (kg)<input type="number" step="0.01" className="mt-1 w-full rounded border bg-background p-1" value={w} onChange={(e) => setW(Number(e.target.value))} /></label></div>
    <div className="text-xs font-semibold">Entradas</div><div className="grid grid-cols-2 gap-2">{BH_INPUTS.map((k) => num(setInp, inp, k))}</div>
    <div className="mt-2 text-xs font-semibold">Perdas</div><div className="grid grid-cols-2 gap-2">{BH_OUTPUTS.map((k) => num(setOut, out, k))}</div>
    <div className="mt-3 text-sm">Entradas {r.inputs} · Perdas {r.outputs} · Balanço <b>{r.net > 0 ? '+' : ''}{r.net} ml</b> · Débito urinário <b className={r.oliguria ? 'text-destructive' : ''}>{r.debito} ml/kg/h</b>{r.oliguria && ' (oligúria)'}</div>
    <Button size="sm" className="mt-2" onClick={() => run(() => { addIntensive(p.id, 'balances', { period, inputs: inp, outputs: out, weightKg: w, hours }); setInp({}); setOut({}); }, 'Balanço registrado')}>Registrar</Button></Card>
    <Card title={`Acumulado 24h: ${balance24h(p.intensive?.balances ?? [])} ml`}>{list.map((b) => { const x = balance(b); return <div key={b.id} className="border-b py-1 text-xs">{dt(b.at)} · {b.period}: E {x.inputs} / P {x.outputs} = <b>{x.net}</b> ml · {x.debito} ml/kg/h<div className="text-muted-foreground">{b.by}</div></div>; })}</Card></div>;
}

function Bundles({ u, p }: { u: IcuUnit; p: Patient }) {
  const list = (p.intensive?.bundles ?? []).slice().reverse();
  return <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="grid gap-3 md:grid-cols-2">{Object.entries(UNITS[u].bundles).map(([name, items]) => <BundleForm key={name} name={name} items={items} onSave={(checks) => run(() => addIntensive(p.id, 'bundles', { bundle: name, checks, total: items.length }), 'Bundle registrado')} />)}</div>
    <Card title="Adesão registrada">{list.map((b) => <div key={b.id} className="border-b py-1 text-xs"><b>{b.bundle}</b>: {bundleAdherencePct(b)}% ({b.checks.length}/{b.total})<div className="text-muted-foreground">{dt(b.at)} · {b.by}</div></div>)}</Card></div>;
}
function BundleForm({ name, items, onSave }: { name: string; items: string[]; onSave: (c: string[]) => void }) {
  const [c, setC] = useState<string[]>([]);
  return <Card title={`Bundle ${name}`}>{items.map((i) => <label key={i} className="flex items-center gap-2 py-0.5 text-xs"><input type="checkbox" checked={c.includes(i)} onChange={(e) => setC(e.target.checked ? [...c, i] : c.filter((x) => x !== i))} />{i}</label>)}
    <Button size="sm" className="mt-2" onClick={() => { onSave(c); setC([]); }}>Registrar checklist</Button></Card>;
}

function Notes({ p, templates }: { p: Patient; templates: Record<string, string> }) {
  const keys = Object.keys(templates); const [kind, setKind] = useState<string>(keys[0] ?? ''); const [text, setText] = useState(templates[keys[0] ?? ''] ?? '');
  const list = (p.intensive?.notes ?? []).filter((n) => keys.includes(n.kind)).slice().reverse();
  return <div className="grid gap-4 lg:grid-cols-2"><Card title="Novo registro">
    <div className="mb-2 flex flex-wrap gap-1">{keys.map((k) => <button key={k} onClick={() => { setKind(k); setText(templates[k] ?? ''); }} className={`rounded-full border px-3 py-1 text-xs ${k === kind ? 'bg-primary text-primary-foreground' : ''}`}>{k}</button>)}</div>
    <textarea className="h-56 w-full rounded border bg-background p-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
    <Button size="sm" className="mt-2" disabled={text.trim() === (templates[kind] ?? '').trim()} onClick={() => { if (!confirm(`Confirmar registro de ${kind}?`)) return; run(() => { addIntensive(p.id, 'notes', { kind, text }); setText(templates[kind] ?? ''); }, 'Registro salvo'); }}>Salvar</Button></Card>
    <Card title="Histórico">{list.map((n) => <div key={n.id} className="border-b py-2 text-xs"><b>{n.kind}</b> · {dt(n.at)} · {n.by}<pre className="whitespace-pre-wrap font-sans">{n.text}</pre></div>)}</Card></div>;
}

function Exams({ p }: { p: Patient }) {
  useStore((s) => s.encounters); const reqs = encounterFor(p.id)?.examRequests ?? [];
  return <Card title="Exames solicitados (vinculados ao atendimento)">{reqs.length ? <table className="w-full text-xs"><thead><tr className="text-left"><th>Data</th><th>Tipo</th><th>Exames</th><th>Status</th><th>Resultado / laudo</th></tr></thead><tbody>
    {reqs.map((r) => <tr key={r.id} className="border-t align-top"><td>{dt(r.requestedAt)}</td><td>{r.kind}</td><td>{r.exams}</td><td><b>{r.status}</b></td><td className="whitespace-pre-wrap">{r.report || '—'}</td></tr>)}</tbody></table>
    : <p className="text-xs text-muted-foreground">Nenhum exame solicitado. O médico solicita no prontuário (PEP) e aqui a enfermagem acompanha o status e o laudo.</p>}</Card>;
}

function SafetyEdit({ p }: { p: Patient }) {
  const s = p.intensive?.safety; const [f, setF] = useState({ continuous: s?.continuous ?? '', devices: s?.devices ?? [], precaution: s?.precaution ?? '', diet: s?.diet ?? '' });
  return <Card title="Alertas de segurança do paciente"><div className="grid gap-2 md:grid-cols-2">
    <label className="text-xs">Medicamentos de uso contínuo<input className="mt-1 w-full rounded border bg-background p-1" value={f.continuous} onChange={(e) => setF({ ...f, continuous: e.target.value })} /></label>
    <label className="text-xs">Precaução / isolamento<select className="mt-1 w-full rounded border bg-background p-1" value={f.precaution} onChange={(e) => setF({ ...f, precaution: e.target.value })}>{['', 'Padrão', 'Contato', 'Gotículas', 'Aerossóis'].map((x) => <option key={x}>{x}</option>)}</select></label>
    <label className="text-xs">Dieta / jejum<input className="mt-1 w-full rounded border bg-background p-1" value={f.diet} onChange={(e) => setF({ ...f, diet: e.target.value })} placeholder="Ex.: Jejum para exame" /></label>
    <div className="text-xs">Dispositivos<div className="mt-1 flex flex-wrap gap-2">{DEVICES.map((d) => <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={f.devices.includes(d)} onChange={(e) => setF({ ...f, devices: e.target.checked ? [...f.devices, d] : f.devices.filter((x) => x !== d) })} />{d}</label>)}</div></div>
  </div><p className="mt-2 text-xs text-muted-foreground">Alergias vêm do cadastro/triagem do paciente.</p>
    <Button size="sm" className="mt-2" onClick={() => run(() => setIntensiveSafety(p.id, f), 'Alertas atualizados')}>Salvar alertas</Button></Card>;
}


const COLORS: Record<string, string> = { 'Médica (Neonatologista)': 'border-l-primary', 'Enfermeiro': 'border-l-accent', 'Lactário / Nutrição': 'border-l-secondary', 'Fisioterapia': 'border-l-muted-foreground', 'Fonoaudiologia': 'border-l-muted-foreground', 'Serviço Social': 'border-l-muted-foreground' };
void COLORS;

function NeoForm({ p, kind }: { p: Patient; kind: NeoKind }) {
  const f = NEO_FORMS[kind]; const [d, setD] = useState<Record<string, string>>({});
  return <Card title={f.title}><div className="grid grid-cols-2 gap-2">{f.fields.map((x) => <label key={x.key} className="text-xs">{x.label}
    {x.options ? <select className="mt-1 w-full rounded border bg-background p-1" value={d[x.key] ?? ''} onChange={(e) => setD({ ...d, [x.key]: e.target.value })}><option value="">Selecione…</option>{x.options.map((o) => <option key={o}>{o}</option>)}</select>
      : <input type={x.type ?? 'text'} className="mt-1 w-full rounded border bg-background p-1" value={d[x.key] ?? ''} onChange={(e) => setD({ ...d, [x.key]: e.target.value })} />}</label>)}</div>
    <Button size="sm" className="mt-2" disabled={!Object.values(d).some(Boolean)} onClick={() => { if (!confirm(`Confirmar registro: ${f.title}?`)) return; run(() => { addIntensive(p.id, 'neo', { type: kind, data: d }); setD({}); }, 'Registro salvo'); }}>Registrar</Button></Card>;
}

function printHtml(id: string) { const el = document.getElementById(id); if (!el) return; const w = window.open('', '_blank'); if (!w) return; w.document.write(`<html><head><title>Impressão</title><style>body{font-family:sans-serif;padding:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;font-size:12px}.lbl{display:inline-block;border:1px dashed #000;padding:8px;margin:4px;width:320px;font-size:12px}</style></head><body>${el.innerHTML}</body></html>`); w.document.close(); w.print(); }

function Neo({ p }: { p: Patient }) {
  const neo = (p.intensive?.neo ?? []).slice().reverse(); const rec = neo.find((e) => e.type === 'recebimento');
  const lastGrowth = neo.find((e) => e.type === 'crescimento');
  const devices = neo.filter((e) => e.type === 'dispositivo');
  const [drug, setDrug] = useState({ farmaco: '', diluente: '', conc: '', vazao: '', validade: '', checagem: '' });
  const motherId = p.newborn?.motherId;
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Placa de identificação do leito"><div id="placa" className="space-y-1 text-sm">
        <div className="text-lg font-bold">{p.name}</div><div>Leito <b>{p.bed}</b> · Nascimento/idade: {p.age}</div>
        <div>Mãe: <b>{rec?.data['mae'] || p.motherName || '—'}</b> · Tipo sanguíneo: {rec?.data['tipoSang'] || '—'}</div>
        <div>Peso nascer: {rec?.data['pesoNasc'] || p.newborn?.pesoNascer || '—'} g · Peso atual: <b>{lastGrowth?.data['peso'] || Math.round(p.weight * 1000)} g</b></div>
        <div>IG nascer: {rec?.data['ig'] || '—'} sem · IG corrigida: <b>{lastGrowth?.data['igc'] || '—'} sem</b></div>
        <div className="font-bold text-destructive">Alergias: {p.allergies.join(', ') || 'Nenhuma'}</div></div>
        <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => printHtml('placa')}>Imprimir placa</Button>
          {motherId && <Button asChild size="sm" variant="outline"><Link to="/pacientes/$id" params={{ id: motherId }}>Prontuário da mãe</Link></Button>}</div></Card>
      <Card title="Etiqueta de bomba de seringa"><div className="grid grid-cols-2 gap-2">{(['farmaco', 'diluente', 'conc', 'vazao', 'validade', 'checagem'] as const).map((k) => <label key={k} className="text-xs">{({ farmaco: 'Fármaco', diluente: 'Diluente', conc: 'Concentração', vazao: 'Vazão (ml/h)', validade: 'Validade', checagem: 'Dupla checagem' })[k]}<input className="mt-1 w-full rounded border bg-background p-1" value={drug[k]} onChange={(e) => setDrug({ ...drug, [k]: e.target.value })} /></label>)}</div>
        <div id="etq" className="hidden"><div className="lbl"><b>{p.name}</b> · Leito {p.bed}<br />{drug.farmaco} em {drug.diluente} · {drug.conc}<br />Vazão {drug.vazao} ml/h · Preparo {new Date().toLocaleString('pt-BR')}<br />Validade {drug.validade} · Checado: {drug.checagem}</div>
          {devices.filter((d) => d.data['acao'] === 'Inserção').map((d) => <div key={d.id} className="lbl"><b>{d.data['disp']}</b> · {p.name} · Leito {p.bed}<br />Inserido {dt(d.at)} · Sítio {d.data['sitio']}<br />Validade: {d.data['validade'] || '—'}</div>)}</div>
        <Button size="sm" className="mt-2" disabled={!drug.farmaco} onClick={() => printHtml('etq')}>Imprimir etiquetas (seringa + dispositivos)</Button></Card>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(Object.keys(NEO_FORMS) as NeoKind[]).map((k) => <NeoForm key={k} p={p} kind={k} />)}</div>
    <Card title="Linha do tempo neonatal">{neo.length ? <table className="w-full text-xs"><thead><tr className="text-left"><th>Data</th><th>Tipo</th><th>Detalhes</th><th>Por</th></tr></thead><tbody>
      {neo.map((e) => <tr key={e.id} className="border-t align-top"><td>{dt(e.at)}</td><td>{NEO_FORMS[e.type].title}</td><td>{Object.entries(e.data).filter(([, v]) => v).map(([k, v]) => `${NEO_FORMS[e.type].fields.find((f) => f.key === k)?.label ?? k}: ${v}`).join(' · ')}</td><td>{e.by}</td></tr>)}</tbody></table> : <p className="text-xs text-muted-foreground">Sem registros. Comece pelo recebimento do paciente.</p>}</Card>
  </div>;
}

function NeoReport() {
  const all = useStore((s) => s.patients); const beds = all.filter((p) => p.ward === 'UTIN');
  const [comp, setComp] = useState(new Date().toISOString().slice(0, 7));
  const r = neoReport(all, comp);
  const T = ({ title, m }: { title: string; m: Record<string, number> }) => <Card title={title}><table className="w-full text-xs"><tbody>{Object.entries(m).length ? Object.entries(m).map(([k, v]) => <tr key={k} className="border-t"><td>{k}</td><td className="text-right font-semibold">{v}</td></tr>) : <tr><td className="text-muted-foreground">Sem dados</td></tr>}</tbody></table></Card>;
  const csv = () => { const rows = [['Indicador', 'Valor'], ['Internações', r.admissions], ['Ocupação atual', `${beds.length}/8`], ['Sepse provável', r.sepse], ['Extubações acidentais', r.extubacao], ['Transfusões', r.transfusoes], ['Triagens alteradas', r.triagensAlteradas], ['Gestação alto risco', r.altoRisco], ...Object.entries({ ...r.peso, ...r.ig, ...r.sexo, ...r.eventos })]; const b = new Blob([rows.map((x) => x.join(';')).join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `uti-neonatal-${comp}.csv`; a.click(); };
  return <div className="space-y-4"><div className="flex flex-wrap items-center gap-2 print:hidden"><input type="month" className="rounded border bg-background p-1 text-sm" value={comp} onChange={(e) => setComp(e.target.value)} /><Button size="sm" variant="outline" onClick={csv}>Exportar Excel</Button><Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button></div>
    <div className="hidden print:block"><Letterhead title={`INDICADORES UTI NEONATAL – ${comp}`} /></div>
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">{[['Internações', r.admissions], ['Ocupação atual', `${beds.length}/8 (${Math.round(beds.length / 8 * 100)}%)`], ['Sepse provável', r.sepse], ['Extubação acidental', r.extubacao], ['Transfusões', r.transfusoes], ['Triagens alteradas', r.triagensAlteradas], ['Alto risco gestacional', r.altoRisco]].map(([k, v]) => <div key={String(k)} className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="text-xl font-bold">{v}</div></div>)}</div>
    <div className="grid gap-3 md:grid-cols-3"><T title="Peso ao nascer" m={r.peso} /><T title="Idade gestacional" m={r.ig} /><T title="Sexo" m={r.sexo} /><T title="Cidade de origem" m={r.cidade} /><T title="Diagnóstico" m={r.diagnostico} /><T title="Eventos (LPP, vacinas, altas, óbitos, transferências)" m={r.eventos} /></div>
    <p className="text-xs text-muted-foreground">Internações contam pelo registro de "Recebimento do paciente" no mês. Consumo de materiais e medicamentos está em Prestação de contas OS (setor UTI Neo).</p></div>;
}
