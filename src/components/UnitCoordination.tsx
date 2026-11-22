import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/hospital-store";
import { ageBand } from "@/lib/amb-reports";
import { toCsvRows } from "@/lib/ps-infantil";
import { coReport, type SurgX } from "@/lib/surgical-center";
import { ambCoordination, unitReport } from "@/lib/unit-coordination";
import type { CareUnit } from "@/lib/ambulatorio";

const box = "rounded-lg border bg-card p-3";
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`);
type Row = (string | number)[];

/** Coordenação / Indicadores da Maternidade e do Ambulatório (mesmo padrão do PS Infantil). */
export function UnitCoordination({ unit }: { unit: CareUnit }) {
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients);
  const appts = useStore((s) => s.appointments); const specs = useStore((s) => s.ambSpecialties); const surgeries = useStore((s) => s.surgeries) as SurgX[];
  const [mode, setMode] = useState<"dia" | "mes" | "ano">("mes");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); const [cmp, setCmp] = useState("");
  const info = useMemo(() => patients.map((p) => { const a = p.registration?.addresses?.find((x) => x.primary) ?? p.registration?.addresses?.[0]; return { id: p.id, city: a?.city ? `${a.city}${a.state ? `/${a.state}` : ""}` : "", sex: p.registration?.sex ?? "", ageBand: ageBand(p.registration?.birthDate, new Date()) }; }), [patients]);
  const sadt = useMemo(() => new Set(specs.filter((s) => s.group === "sadt").map((s) => s.name)), [specs]);
  const build = (per: string) => ({
    u: unitReport(encounters, info, unit, per),
    amb: unit === "Ambulatório" ? ambCoordination(appts, (id) => specs.find((s) => s.id === id)?.name ?? id, encounters, sadt, per) : null,
    co: unit === "Maternidade" ? coReport(surgeries, per) : null,
  });
  const r = useMemo(() => build(period), [encounters, info, appts, specs, surgeries, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = useMemo(() => (cmp ? build(cmp) : null), [encounters, info, appts, specs, surgeries, cmp]); // eslint-disable-line react-hooks/exhaustive-deps
  const Kpi = ({ l, v, d }: { l: string; v: string | number; d?: string | number | null | undefined }) => <div className={box}><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold">{v}</div>{c && d != null && <div className="text-[11px] text-muted-foreground">comparação: {d}</div>}</div>;
  const Tbl = ({ t, h, rows }: { t: string; h: string[]; rows: Row[] }) => <div className={box}><div className="mb-1 text-xs font-semibold">{t}</div><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground">{h.map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((x, j) => <td key={j} className="py-0.5">{x}</td>)}</tr>)}{!rows.length && <tr><td className="py-1 text-muted-foreground">Sem dados</td></tr>}</tbody></table></div>;
  const u = r.u; const cu = c?.u;
  const exportCsv = () => {
    const rows: Row[] = [[unit, period], ["Atendimentos", u.total], ["Classificados", u.classified], ["Internações", u.admitted, `${u.admissionRate}%`], ["Evasões", u.evasions, `${u.evasionRate}%`], ["Espera até classificação (min)", u.avgTriageWaitMin], ["Espera até médico (min)", u.avgDoctorWaitMin], ["Permanência média (min)", u.avgStayMin], [], ["Risco", "Qtd"], ...u.byRisk, [], ["Especialidade", "Qtd"], ...u.bySpecialty, [], ["CID", "Qtd"], ...u.byCid, [], ["Município", "Qtd"], ...u.byCity, [], ["Faixa etária", "Qtd"], ...u.byAge, [], ["Sexo", "Qtd"], ...u.bySex];
    if (r.co) rows.push([], ["Partos", r.co.births], ["Vaginais", r.co.vaginal], ["Cesáreas", r.co.cesarean, `${r.co.cesareanRate}%`], ["Episiotomia", `${r.co.episiotomyRate}%`], ["Hemorragia pós-parto", `${r.co.pphRate}%`], ["Pele a pele", `${r.co.skinToSkinRate}%`], ["Amamentação 1ª hora", `${r.co.breastfeedingRate}%`], ["Robson", "Total", "Cesáreas", "% grupo", "% cesárea", "Contribuição"], ...r.co.groups.map((g) => [g.group, g.total, g.cesarean, g.groupSize, g.cesareanRate, g.contribution]));
    if (r.amb) rows.push([], ["Agendados", r.amb.scheduled], ["Compareceram", r.amb.attended], ["Faltas", r.amb.absent, `${r.amb.absenteeism}%`], ["Cancelados", r.amb.cancelled], ["Especialidade", "Agendados", "Faltas", "%"], ...r.amb.bySpecialty, [], ["Profissional", "Agendados", "Faltas", "%"], ...r.amb.byProfessional, [], ["SADT realizados", r.amb.sadtTotal], ["Laudados", r.amb.sadtReported], ["Sem laudo", r.amb.sadtPending], ["Tempo médio até laudo (min)", r.amb.sadtAvgReportMin]);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCsvRows(rows)], { type: "text/csv;charset=utf-8" })); a.download = `coordenacao-${unit.toLowerCase()}-${period}.csv`; a.click();
  };
  const inType = mode === "dia" ? "date" : mode === "mes" ? "month" : "number";
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <select aria-label="Modo" className="h-8 rounded-md border bg-background px-2 text-xs" value={mode} onChange={(e) => { const m = e.target.value as typeof mode; setMode(m); const t = new Date().toISOString(); setPeriod(m === "dia" ? t.slice(0, 10) : m === "mes" ? t.slice(0, 7) : t.slice(0, 4)); setCmp(""); }}><option value="dia">Diário</option><option value="mes">Mensal</option><option value="ano">Anual</option></select>
      <Input aria-label="Período" type={inType} value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 w-44" />
      <span className="text-xs">Comparar com</span><Input aria-label="Período de comparação" type={inType} value={cmp} onChange={(e) => setCmp(e.target.value)} className="h-8 w-44" />
      <Button size="sm" variant="outline" onClick={exportCsv}>Exportar Excel</Button><Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir / PDF</Button>
      <span className="text-xs text-muted-foreground">Somente a porta {unit}</span>
    </div>

    <section className="space-y-2"><h2 className="font-semibold">Produção e tempos</h2><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi l="Atendimentos" v={u.total} d={cu?.total} /><Kpi l="Em aberto agora" v={u.open} /><Kpi l="Internações" v={`${u.admitted} (${u.admissionRate}%)`} d={cu && `${cu.admitted} (${cu.admissionRate}%)`} />
      {unit === "Maternidade" ? <Kpi l="Encaminhadas ao CO" v={u.toCo} d={cu?.toCo} /> : <Kpi l="Classificados" v={u.classified} d={cu?.classified} />}
      <Kpi l="Espera até médico" v={fmtMin(u.avgDoctorWaitMin)} d={cu && fmtMin(cu.avgDoctorWaitMin)} /><Kpi l="Permanência média" v={fmtMin(u.avgStayMin)} d={cu && fmtMin(cu.avgStayMin)} />
    </div></section>

    {unit === "Maternidade" && r.co && <section className="space-y-2"><h2 className="font-semibold">Partos e boas práticas</h2>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Kpi l="Partos" v={r.co.births} d={c?.co?.births} /><Kpi l="Vaginais" v={r.co.vaginal} d={c?.co?.vaginal} /><Kpi l="Taxa de cesárea" v={`${r.co.cesareanRate}%`} d={c?.co && `${c.co.cesareanRate}%`} /><Kpi l="Pele a pele" v={`${r.co.skinToSkinRate}%`} d={c?.co && `${c.co.skinToSkinRate}%`} /><Kpi l="Amamentação 1ª hora" v={`${r.co.breastfeedingRate}%`} d={c?.co && `${c.co.breastfeedingRate}%`} /><Kpi l="Hemorragia pós-parto" v={`${r.co.pphRate}%`} d={c?.co && `${c.co.pphRate}%`} /></div>
      <div className="grid gap-3 md:grid-cols-2"><Tbl t="Classificação de Robson" h={["Grupo", "Partos", "Cesáreas", "% do total", "% cesárea", "Contribuição"]} rows={r.co.groups.map((g) => [g.group, g.total, g.cesarean, `${g.groupSize}%`, `${g.cesareanRate}%`, `${g.contribution}%`])} /><Tbl t="Classificação de risco obstétrica" h={["Cor", "Qtd"]} rows={u.byRisk} /></div>
      <p className="text-xs text-muted-foreground">Indicadores neonatais detalhados ficam em <Link className="text-primary underline" to="/uti-uci">UTI / UCI</Link> e os cirúrgicos em <Link className="text-primary underline" to="/gestao-cirurgica">Gestão cirúrgica</Link>.</p>
    </section>}

    {r.amb && <section className="space-y-2"><h2 className="font-semibold">Agenda e absenteísmo</h2>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Kpi l="Agendados" v={r.amb.scheduled} d={c?.amb?.scheduled} /><Kpi l="Compareceram" v={r.amb.attended} d={c?.amb?.attended} /><Kpi l="Faltas" v={`${r.amb.absent} (${r.amb.absenteeism}%)`} d={c?.amb && `${c.amb.absent} (${c.amb.absenteeism}%)`} /><Kpi l="Cancelados" v={r.amb.cancelled} d={c?.amb?.cancelled} /><Kpi l="SADT sem laudo" v={r.amb.sadtPending} d={c?.amb?.sadtPending} /><Kpi l="Tempo até laudo" v={fmtMin(r.amb.sadtAvgReportMin)} d={c?.amb && fmtMin(c.amb.sadtAvgReportMin)} /></div>
      <div className="grid gap-3 md:grid-cols-2"><Tbl t="Absenteísmo por especialidade" h={["Especialidade", "Agendados", "Faltas", "%"]} rows={r.amb.bySpecialty} /><Tbl t="Absenteísmo por profissional" h={["Profissional", "Agendados", "Faltas", "%"]} rows={r.amb.byProfessional} /></div>
      <div className="grid gap-2 sm:grid-cols-3"><Kpi l="Exames SADT realizados" v={r.amb.sadtTotal} /><Kpi l="Pedidos de exames (todos os setores)" v={r.amb.examRequests} /><Kpi l="Pedidos em aberto" v={r.amb.examPending} /></div>
    </section>}

    <section className="space-y-2"><h2 className="font-semibold">Perfil dos pacientes</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Tbl t="Procedência por município" h={["Município", "Qtd"]} rows={u.byCity} /><Tbl t="Faixa etária" h={["Faixa", "Qtd"]} rows={u.byAge} /><Tbl t="Sexo" h={["Sexo", "Qtd"]} rows={u.bySex} /><Tbl t="Principais diagnósticos" h={["CID", "Qtd"]} rows={u.byCid} />
    </div>{unit === "Ambulatório" && <Tbl t="Atendimentos por especialidade" h={["Especialidade", "Qtd"]} rows={u.bySpecialty} />}</section>
  </div>;
}
