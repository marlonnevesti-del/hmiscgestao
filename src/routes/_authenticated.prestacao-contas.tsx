import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoPermission } from "@/components/AppShell";
import { Letterhead, LetterFooter } from "@/components/DischargePrint";
import { printProcedure } from "@/components/ProcedurePrint";
import { can } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { buildOsReport, type OsReport } from "@/lib/os-report";
import { toCsv } from "@/lib/surgical-center";
import { CNES, competenceOf } from "@/lib/sus-billing";

export const Route = createFileRoute("/_authenticated/prestacao-contas")({
  head: () => ({ meta: [
    { title: "Prestação de Contas da OS – Gastos Totais – HMI Gestão" },
    { name: "description", content: "Relatório mensal de produção e gastos totais por setor, estoque e diárias para a Secretaria de Estado." },
    { property: "og:title", content: "Prestação de Contas da OS – HMI Gestão" },
    { property: "og:description", content: "Produção e gastos totais do hospital por competência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OsAccounts,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function OsAccounts() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const surgeries = useStore((s) => s.surgeries);
  const movements = useStore((s) => s.movements);
  const stock = useStore((s) => s.stock);
  const warehouse = useStore((s) => s.warehouse);
  const profile = useStore((s) => s.profile);
  const [comp, setComp] = useState(() => competenceOf(new Date().toISOString()));
  const [printing, setPrinting] = useState(false);
  const r = useMemo(() => buildOsReport(comp, { encounters, patients, surgeries, movements, items: [...stock, ...warehouse] }), [comp, encounters, patients, surgeries, movements, stock, warehouse]);
  const month = `${comp.slice(4)}/${comp.slice(0, 4)}`;
  const exportCsv = () => {
    const rows: (string | number)[][] = [["Seção", "Descrição", "Quantidade", "Valor (R$)"],
      ...r.production.map((p) => ["Produção", p.label, p.value, ""]),
      ...r.dailies.map((d) => ["Diárias", d.label, d.days, d.total]),
      ["Materiais cirúrgicos", "Gastos de sala", "", r.surgeryMaterials],
      ...r.costs.map((c) => [`Estoque · ${c.depot}`, `${c.item} → ${c.sector}`, c.qty, c.total]),
      ["TOTAL", "", "", r.total]];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `prestacao-contas-${comp}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  if (!can(profile, "faturar")) return <NoPermission action="ver a prestação de contas (perfil Faturamento)" />;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Prestação de contas da OS · Gastos totais</h1><p className="text-sm text-muted-foreground">Produção assistencial e gastos do hospital por competência · CNES {CNES}</p></div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <label className="text-xs font-medium">Competência<Input type="month" value={`${comp.slice(0, 4)}-${comp.slice(4)}`} onChange={(e) => e.target.value && setComp(e.target.value.replace("-", ""))} /></label>
        <Button variant="outline" onClick={exportCsv}>Exportar planilha</Button>
        <Button onClick={() => { setPrinting(true); printProcedure(); }}>Imprimir relatório</Button>
      </div>
      <Body r={r} />
      {printing && createPortal(<div className="proc-root"><Letterhead title={`PRESTAÇÃO DE CONTAS – GASTOS TOTAIS – COMPETÊNCIA ${month}`} /><p>HMISC · CNES {CNES} · Emitido em {new Date().toLocaleString("pt-BR")}</p><Body r={r} print />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 48, textAlign: "center", fontSize: "9pt" }}>{["Diretor(a) Técnico(a)", "Coordenação de Faturamento", "Diretor(a) Administrativo(a) da OS"].map((t) => <div key={t}>______________________<br />{t}</div>)}</div>
        <LetterFooter /></div>, document.body)}
    </div>
  );
}

function Body({ r, print }: { r: OsReport; print?: boolean }) {
  const box = print ? "" : "rounded-lg border bg-card p-4";
  const td = print ? { border: "1px solid #000", padding: 2 } : undefined;
  const table = (head: string[], rows: (string | number)[][]) => (
    <table className="w-full text-sm" style={print ? { width: "100%", borderCollapse: "collapse", fontSize: "9pt", marginBottom: 8 } : undefined}>
      <thead className="text-left text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h} style={td} className="py-1">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((c, j) => <td key={j} style={td} className="py-1">{c}</td>)}</tr>)}
        {!rows.length && <tr><td colSpan={head.length} style={td} className="py-4 text-center text-muted-foreground">Sem registros na competência.</td></tr>}</tbody>
    </table>);
  const stockTotal = r.costs.reduce((s, c) => s + c.total, 0);
  return (<div className="space-y-4">
    <div className={print ? "" : "grid gap-3 md:grid-cols-4"}>
      {[["Gasto total", brl(r.total)], ["Estoque (farmácia/almox.)", brl(stockTotal)], ["Diárias", brl(r.dailies.reduce((s, d) => s + d.total, 0))], ["Materiais cirúrgicos", brl(r.surgeryMaterials)]].map(([k, v]) =>
        print ? <p key={k}><b>{k}:</b> {v}</p> : <div key={k} className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-lg font-semibold">{v}</div></div>)}
    </div>
    <div className={box}><h3 className="mb-2 font-medium">Produção assistencial (metas físicas)</h3>{table(["Indicador", "Quantidade"], r.production.map((p) => [p.label, p.value]))}</div>
    <div className={print ? "" : "grid gap-4 md:grid-cols-2"}>
      <div className={box}><h3 className="mb-2 font-medium">Gastos por estoque de origem</h3>{table(["Origem", "Valor"], r.byDepot.map((x) => [x.label, brl(x.total)]))}</div>
      <div className={box}><h3 className="mb-2 font-medium">Gastos por setor / centro de custo</h3>{table(["Setor", "Valor"], r.bySector.map((x) => [x.label, brl(x.total)]))}</div>
    </div>
    <div className={box}><h3 className="mb-2 font-medium">Diárias (pacientes internados)</h3>{table(["Unidade", "Diárias", "Valor unit.", "Total"], r.dailies.map((d) => [d.label, d.days, brl(d.unit), brl(d.total)]))}</div>
    <div className={box}><h3 className="mb-2 font-medium">Detalhamento de saídas de estoque</h3>{table(["Item", "Origem", "Destino", "Qtd", "Custo unit.", "Total"], r.costs.map((c) => [c.item, c.depot, c.sector, c.qty, brl(c.unit), brl(c.total)]))}</div>
    {!print && <p className="text-[11px] text-muted-foreground">Valores pelo custo unitário cadastrado no estoque. Itens sem custo cadastrado aparecem com R$ 0,00.</p>}
  </div>);
}
