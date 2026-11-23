import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoPermission } from "@/components/AppShell";
import { can } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { abcCurve, allocateCosts, COST_GROUPS, summarizeCenters, type CostGroup } from "@/lib/cost-centers";
import { toCsv } from "@/lib/surgical-center";
import { competenceOf } from "@/lib/sus-billing";

export const Route = createFileRoute("/_authenticated/centro-de-custos")({
  head: () => ({ meta: [
    { title: "Centro de Custos – HMI Gestão" },
    { name: "description", content: "Custos mensais por centro de custo, grupo gerencial, curva ABC e custo por paciente-dia." },
    { property: "og:title", content: "Centro de Custos – HMI Gestão" },
    { property: "og:description", content: "Apropriação de gastos por setor do hospital." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CostCenters,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function CostCenters() {
  const movements = useStore((s) => s.movements);
  const patients = useStore((s) => s.patients);
  const surgeries = useStore((s) => s.surgeries);
  const stock = useStore((s) => s.stock);
  const warehouse = useStore((s) => s.warehouse);
  const profile = useStore((s) => s.profile);
  const [comp, setComp] = useState(() => competenceOf(new Date().toISOString()));
  const [group, setGroup] = useState<CostGroup | "">("");
  const [center, setCenter] = useState("");
  const entries = useMemo(() => allocateCosts(comp, { movements, patients, surgeries, items: [...stock, ...warehouse] }), [comp, movements, patients, surgeries, stock, warehouse]);
  const summary = useMemo(() => summarizeCenters(entries), [entries]);
  const shown = summary.filter((s) => !group || s.group === group);
  const abc = useMemo(() => abcCurve(entries.filter((e) => (!center || e.center === center) && (!group || e.group === group))), [entries, center, group]);
  const total = entries.reduce((s, e) => s + e.total, 0);
  const byGroup = (g: CostGroup) => entries.filter((e) => e.group === g).reduce((s, e) => s + e.total, 0);
  const exportCsv = () => {
    const rows: (string | number)[][] = [["Centro de custo", "Grupo", "Materiais", "Diárias", "Sala cirúrgica", "Total", "% do total", "Custo material/paciente-dia"],
      ...summary.map((s) => [s.center, s.group, s.materials, s.dailies, s.surgery, s.total, s.share, s.perPatientDay]), [], ["Curva ABC", center || "Todos"], ["Classe", "Item", "Qtd", "Total", "%", "% acumulado"],
      ...abc.map((a) => [a.cls, a.item, a.qty, a.total, a.share, a.cumulative])];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `centro-de-custos-${comp}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  if (!can(profile, "faturar")) return <NoPermission action="ver o centro de custos (perfil Faturamento)" />;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Centro de custos</h1><p className="text-sm text-muted-foreground">Gastos do mês apropriados por setor: requisições, dispensações pelo leito do paciente, diárias e salas cirúrgicas.</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <label className="text-xs font-medium">Competência<Input type="month" value={`${comp.slice(0, 4)}-${comp.slice(4)}`} onChange={(e) => e.target.value && setComp(e.target.value.replace("-", ""))} /></label>
        <label className="text-xs font-medium flex flex-col">Grupo<select aria-label="Grupo" className={sel} value={group} onChange={(e) => { setGroup(e.target.value as CostGroup | ""); setCenter(""); }}><option value="">Todos</option>{COST_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="text-xs font-medium flex flex-col">Setor (curva ABC)<select aria-label="Setor" className={sel} value={center} onChange={(e) => setCenter(e.target.value)}><option value="">Todos</option>{shown.map((s) => <option key={s.center}>{s.center}</option>)}</select></label>
        <Button variant="outline" onClick={exportCsv}>Exportar planilha</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[["Gasto total", total] as const, ...COST_GROUPS.map((g) => [g, byGroup(g)] as const)].map(([k, v]) =>
          <div key={k} className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-lg font-semibold">{brl(v)}</div></div>)}
      </div>
      <div className="rounded-lg border bg-card p-4 overflow-x-auto">
        <h3 className="mb-2 font-medium">Custos por centro de custo</h3>
        <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Centro</th><th>Grupo</th><th>Materiais</th><th>Diárias</th><th>Sala cir.</th><th>Total</th><th>%</th><th>Mat./paciente-dia</th></tr></thead>
          <tbody>{shown.map((s) => <tr key={s.center} className="border-t cursor-pointer hover:bg-muted" onClick={() => setCenter(s.center)}>
            <td className="py-1 font-medium">{s.center}</td><td>{s.group}</td><td>{brl(s.materials)}</td><td>{brl(s.dailies)}</td><td>{brl(s.surgery)}</td><td className="font-semibold">{brl(s.total)}</td>
            <td><div className="flex items-center gap-2"><div className="h-2 w-16 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, s.share)}%` }} /></div>{s.share}%</div></td>
            <td>{s.patientDays ? brl(s.perPatientDay) : "—"}</td></tr>)}
            {!shown.length && <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">Sem gastos na competência.</td></tr>}</tbody></table>
      </div>
      <div className="rounded-lg border bg-card p-4 overflow-x-auto">
        <h3 className="mb-2 font-medium">Curva ABC · {center || "todos os setores"}</h3>
        <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Classe</th><th>Item</th><th>Qtd</th><th>Total</th><th>%</th><th>% acumulado</th></tr></thead>
          <tbody>{abc.map((a) => <tr key={a.item} className="border-t"><td className="py-1 font-semibold">{a.cls}</td><td>{a.item}</td><td>{a.qty}</td><td>{brl(a.total)}</td><td>{a.share}%</td><td>{a.cumulative}%</td></tr>)}
            {!abc.length && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sem itens.</td></tr>}</tbody></table>
        <p className="mt-2 text-[11px] text-muted-foreground">Classe A: itens que somam até 80% do gasto; B: até 95%; C: restante. Valores pelo custo unitário cadastrado no estoque.</p>
      </div>
    </div>
  );
}
