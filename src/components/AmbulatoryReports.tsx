import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/hospital-store";
import { buildAmbReport, type AmbReport } from "@/lib/amb-reports";

function Table({ title, rows }: { title: string; rows: [string, number][] }) {
  const total = rows.reduce((n, r) => n + r[1], 0);
  return <section className="rounded-lg border bg-card p-3"><h4 className="mb-2 text-sm font-semibold">{title}</h4>
    {!rows.length ? <p className="text-xs text-muted-foreground">Sem dados.</p> : <table className="w-full text-sm"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-b last:border-0"><td className="py-1">{k}</td><td className="text-right font-mono">{v}</td><td className="w-14 text-right text-xs text-muted-foreground">{total ? Math.round((v / total) * 100) : 0}%</td></tr>)}</tbody></table>}
  </section>;
}

function Block({ title, r, unitLabel }: { title: string; r: AmbReport; unitLabel: string }) {
  return <div className="space-y-3">
    <h3 className="font-semibold">{title}</h3>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total de {unitLabel}</div><div className="text-2xl font-bold">{r.total}</div></div>
      <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Agendados no mês</div><div className="text-2xl font-bold">{r.scheduled}</div></div>
      <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Absenteísmo (faltas)</div><div className="text-2xl font-bold">{r.absent} <span className="text-base text-muted-foreground">· {r.absenteeism}%</span></div></div>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Table title="Por profissional" rows={r.byProfessional} />
      <Table title={unitLabel === "exames" ? "Por exame" : "Por especialidade"} rows={r.bySpecialty} />
      <Table title="Por gênero" rows={r.byGender} />
      <Table title="Por faixa etária" rows={r.byAge} />
      <Table title="Por cidade" rows={r.byCity} />
    </div>
  </div>;
}

/** Relatórios mensais do Ambulatório e do SADT. */
export function AmbulatoryReports() {
  const encounters = useStore((s) => s.encounters); const appointments = useStore((s) => s.appointments);
  const patients = useStore((s) => s.patients); const specs = useStore((s) => s.ambSpecialties);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString("sv-SE").slice(0, 7));
  const amb = useMemo(() => buildAmbReport(month, "consultas", encounters, appointments, patients, specs), [month, encounters, appointments, patients, specs]);
  const sadt = useMemo(() => buildAmbReport(month, "sadt", encounters, appointments, patients, specs), [month, encounters, appointments, patients, specs]);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end gap-2 print:hidden">
      <label className="grid gap-1 text-xs">Competência (mês)<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      <Button variant="outline" onClick={() => window.print()}>Imprimir relatório</Button>
    </div>
    <Block title="Relatório do Ambulatório (consultas)" r={amb} unitLabel="atendimentos" />
    <Block title="Relatório do SADT (exames)" r={sadt} unitLabel="exames" />
  </div>;
}
