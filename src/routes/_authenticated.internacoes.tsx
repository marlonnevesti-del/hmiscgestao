import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoPermission } from '@/components/AppShell';
import { useStore } from '@/lib/hospital-store';
import { BASE_BEDS, WARDS, canAccessPage } from '@/lib/hospital-data';
import { admissionsReport, pct } from '@/lib/inpatient-docs';

export const Route = createFileRoute('/_authenticated/internacoes')({
  head: () => ({ meta: [
    { title: 'Censo Hospitalar e Internações – HMI Gestão' },
    { name: 'description', content: 'Ocupação dos leitos em tempo real e relatório de internações e reinternações.' },
    { property: 'og:title', content: 'Censo Hospitalar e Internações – HMI Gestão' },
    { property: 'og:description', content: 'Taxa de ocupação por unidade, reinternações em 30 dias e 6 meses.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Page,
});

const Kpi = ({ l, v }: { l: string; v: string | number }) => <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-bold">{v}</div></div>;

function Page() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  if (!canAccessPage(profile, '/internacoes', areas)) return <NoPermission action="acessar o censo e internações" />;
  return <div className="space-y-4 p-4"><h1 className="text-2xl font-bold">Censo Hospitalar · Internações</h1>
    <Tabs defaultValue="censo"><TabsList><TabsTrigger value="censo">Ocupação dos leitos</TabsTrigger><TabsTrigger value="rel">Internações e reinternações</TabsTrigger></TabsList>
      <TabsContent value="censo"><Census /></TabsContent><TabsContent value="rel"><Report /></TabsContent></Tabs></div>;
}

function Census() {
  const patients = useStore((s) => s.patients); const encounters = useStore((s) => s.encounters);
  const occupied = new Set([...patients.filter((p) => p.bed).map((p) => p.bed), ...encounters.filter((e) => e.fia && !e.discharge).map((e) => e.fia!.bed)]);
  const rows = WARDS.map((w) => { const b = BASE_BEDS.filter((x) => x.ward === w.id); const o = b.filter((x) => occupied.has(x.id)).length; return { w, total: b.length, o }; }).filter((r) => r.total);
  const T = rows.reduce((s, r) => s + r.total, 0), O = rows.reduce((s, r) => s + r.o, 0);
  const inpatients = encounters.filter((e) => e.fia && !e.discharge);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-4"><Kpi l="Leitos" v={T} /><Kpi l="Ocupados" v={O} /><Kpi l="Livres" v={T - O} /><Kpi l="Taxa de ocupação" v={`${pct(O, T)}%`} /></div>
    <table className="w-full rounded-lg border text-sm"><thead className="bg-muted"><tr><th className="p-2 text-left">Unidade</th><th>Leitos</th><th>Ocupados</th><th>Livres</th><th>Ocupação</th></tr></thead>
      <tbody>{rows.map((r) => { const p = pct(r.o, r.total); return <tr key={r.w.id} className="border-t"><td className="p-2">{r.w.name}</td><td className="text-center">{r.total}</td><td className="text-center">{r.o}</td><td className="text-center">{r.total - r.o}</td>
        <td className="p-2"><div className="h-2 rounded bg-muted"><div className={p >= 85 ? 'h-2 rounded bg-destructive' : 'h-2 rounded bg-primary'} style={{ width: `${p}%` }} /></div><span className="text-xs">{p}%</span></td></tr>; })}</tbody></table>
    <div className="rounded-lg border"><div className="border-b p-2 font-semibold">Pacientes internados ({inpatients.length})</div>
      <table className="w-full text-sm"><tbody>{inpatients.map((e) => { const p = patients.find((x) => x.id === e.patientId); const d = (Date.now() - Date.parse(e.fia!.openedAt)) / 86_400_000;
        return <tr key={e.id} className="border-t"><td className="p-2">{p?.name}</td><td>{e.fia!.number}</td><td>{e.fia!.ward} / {e.fia!.bed}</td><td>{e.fia!.cid}</td><td>{Math.floor(d)} dia(s)</td></tr>; })}</tbody></table></div>
  </div>;
}

function Report() {
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const r = admissionsReport(encounters, patients, month);
  return <div className="space-y-4">
    <div className="flex items-center gap-2 print:hidden"><input type="month" className="rounded-md border px-2 py-1" value={month} onChange={(e) => setMonth(e.target.value)} /><Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button></div>
    <div className="grid gap-3 sm:grid-cols-5"><Kpi l="Internações" v={r.total} /><Kpi l="Reinternações ≤ 30 dias" v={`${r.r30} (${pct(r.r30, r.total)}%)`} /><Kpi l="Reinternações ≤ 6 meses" v={`${r.r6m} (${pct(r.r6m, r.total)}%)`} /><Kpi l="Altas" v={r.altas} /><Kpi l="Permanência média" v={`${r.avgLos.toFixed(1)} d`} /></div>
    <table className="w-full rounded-lg border text-sm"><thead className="bg-muted"><tr><th className="p-2 text-left">Paciente</th><th>FIA</th><th>Data</th><th>CID</th><th>Unidade</th><th>Permanência</th><th>Reinternação</th></tr></thead>
      <tbody>{r.rows.map(({ e, p, gap, los }) => <tr key={e.id} className="border-t"><td className="p-2">{p?.name}</td><td>{e.fia!.number}</td><td>{new Date(e.fia!.openedAt).toLocaleDateString('pt-BR')}</td><td>{e.fia!.cid}</td><td>{e.fia!.ward}</td><td>{los === null ? 'Internado' : `${los.toFixed(1)} d`}</td>
        <td className={gap !== null && gap <= 30 ? 'font-semibold text-destructive' : ''}>{gap === null ? '—' : `${Math.round(gap)} dias após anterior`}</td></tr>)}
        {!r.rows.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhuma internação no mês.</td></tr>}</tbody></table>
  </div>;
}
