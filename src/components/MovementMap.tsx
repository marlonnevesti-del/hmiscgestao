import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requisitionOut, useStore } from "@/lib/hospital-store";
import { REQUEST_SECTORS } from "@/lib/sector-request";
import { filterMovements, KIND_LABEL, movementSign, summarize, type MapFilter } from "@/lib/movement-map";
import type { Depot, MovementKind } from "@/lib/supply-flow";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const DEPOT_NAME: Record<Depot, string> = { farmacia: "Farmácia", almoxarifado: "Almoxarifado" };
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

/** Saída via requisição para paciente (FIA/BAA) ou centro de custo. */
export function RequisitionOut({ depot }: { depot: Depot }) {
  const items = useStore((s) => (depot === "farmacia" ? s.stock : s.warehouse));
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const movements = useStore((s) => s.movements);
  const [mode, setMode] = useState<"paciente" | "setor">("paciente");
  const [encounterId, setEncounterId] = useState(""); const [costCenter, setCostCenter] = useState("");
  const [urgent, setUrgent] = useState(false); const [loss, setLoss] = useState(false); const [note, setNote] = useState("");
  const [q, setQ] = useState(""); const [itemId, setItemId] = useState(""); const [lot, setLot] = useState(""); const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<{ id: string; lot: string; qty: number }[]>([]);
  const open = encounters.filter((e) => e.status_fluxo !== "ALTA_HOSPITALAR");
  const found = q.trim().length >= 2 ? items.filter((i) => `${i.code ?? ""} ${i.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const cur = items.find((i) => i.id === itemId);
  const recent = movements.filter((m) => m.kind === "requisicao" && m.from === DEPOT_NAME[depot]).slice(0, 15);
  const add = () => { if (!cur) { toast.error("Selecione o produto."); return; } if (cur.lots?.length && !lot) { toast.error("Selecione o lote."); return; } setLines([...lines, { id: cur.id, lot, qty }]); setItemId(""); setLot(""); setQty(1); setQ(""); };
  const submit = () => {
    if (!window.confirm("Confirma a baixa dos itens desta requisição?")) return;
    try { const doc = requisitionOut(depot, { ...(mode === "paciente" ? { encounterId } : { costCenter }), urgent, loss, note }, lines); toast.success(`Requisição ${doc} efetivada.`); setLines([]); setNote(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível efetivar."); }
  };
  return <div className="space-y-3"><Card><CardHeader><CardTitle className="text-base">Saída via requisição · {DEPOT_NAME[depot]}</CardTitle></CardHeader><CardContent className="space-y-3">
    <div className="flex flex-wrap gap-3 text-sm"><label className="flex items-center gap-1"><input type="radio" checked={mode === "paciente"} onChange={() => setMode("paciente")} /> Paciente / atendimento</label><label className="flex items-center gap-1"><input type="radio" checked={mode === "setor"} onChange={() => setMode("setor")} /> Centro de custo / setor</label><label className="flex items-center gap-1"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgente</label><label className="flex items-center gap-1"><input type="checkbox" checked={loss} onChange={(e) => setLoss(e.target.checked)} /> Perda</label></div>
    {mode === "paciente" ? <select className={sel} value={encounterId} onChange={(e) => setEncounterId(e.target.value)}><option value="">Paciente (BAA / FIA)…</option>{open.map((e) => { const p = patients.find((x) => x.id === e.patientId); return <option key={e.id} value={e.id}>{p?.name ?? "?"} · BAA {e.number}{e.fia ? ` · FIA ${e.fia.number}` : ""} · {e.type}</option>; })}</select>
      : <select className={sel} value={costCenter} onChange={(e) => setCostCenter(e.target.value)}><option value="">Centro de custo…</option>{REQUEST_SECTORS.map((s) => <option key={s}>{s}</option>)}</select>}
    <div className="grid gap-2 md:grid-cols-[2fr_1fr_90px_auto]"><div className="relative"><Input placeholder="Produto (código ou nome)" value={cur ? `${cur.code ?? ""} ${cur.name}` : q} onChange={(e) => { setItemId(""); setQ(e.target.value); }} />{found.length > 0 && !cur && <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow">{found.map((i) => <button type="button" key={i.id} className="block w-full px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => setItemId(i.id)}>{i.code} {i.name} <span className="text-muted-foreground">· saldo {i.quantity}</span></button>)}</div>}</div>
      <select className={sel} value={lot} onChange={(e) => setLot(e.target.value)}><option value="">Lote…</option>{cur?.lots?.filter((l) => l.quantity > 0).map((l) => <option key={l.lot} value={l.lot}>{l.lot} · {l.expiry || "s/ val."} · {l.quantity}</option>)}</select>
      <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /><Button variant="outline" onClick={add}>Adicionar</Button></div>
    {lines.length > 0 && <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Produto</th><th>Lote</th><th>Qtd</th><th /></tr></thead><tbody>{lines.map((l, i) => { const it = items.find((x) => x.id === l.id); return <tr key={i} className="border-t"><td>{it?.code} {it?.name}</td><td>{l.lot || "—"}</td><td>{l.qty}</td><td><Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Excluir</Button></td></tr>; })}</tbody></table>}
    <Textarea placeholder="Justificativa / observação" value={note} onChange={(e) => setNote(e.target.value)} />
    <div className="flex justify-between text-sm"><span>{lines.length} itens digitados</span><Button disabled={!lines.length} onClick={submit}>Efetivar baixa</Button></div>
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="text-base">Últimas requisições</CardTitle></CardHeader><CardContent>{recent.length ? <ul className="space-y-1 text-sm">{recent.map((m) => <li key={m.id}>{fmt(m.at)} · <b>{m.doc}</b> · {m.item} ({m.lot || "—"}) × {m.qty} → {m.to}{m.fia ? ` · FIA ${m.fia}` : ""}{m.urgent ? " · URGENTE" : ""} · {m.by}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma requisição ainda.</p>}</CardContent></Card></div>;
}

/** Mapa de movimentação do produto: filtros por período/hora, produto, paciente, FIA/BAA, lote, setor e tipo. */
export function MovementMap({ depot }: { depot: Depot }) {
  const movements = useStore((s) => s.movements);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<MapFilter>({ from: `${today}T00:00`, to: `${today}T23:59`, depot: DEPOT_NAME[depot], kind: "" });
  const [type, setType] = useState<"analitico" | "sintetico">("analitico");
  const rows = useMemo(() => filterMovements(movements, f), [movements, f]);
  const set = (k: keyof MapFilter) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ent = rows.filter((m) => movementSign(m, f.depot) > 0).reduce((a, m) => a + m.qty, 0); const sai = rows.reduce((a, m) => a + m.qty, 0) - ent;
  return <div className="space-y-3"><Card className="print:hidden"><CardHeader><CardTitle className="text-base">Filtros · Mapa de movimentação</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-4">
    <label className="text-xs">De<Input type="datetime-local" value={f.from} onChange={set("from")} /></label><label className="text-xs">Até<Input type="datetime-local" value={f.to} onChange={set("to")} /></label>
    <label className="text-xs">Estoque<select className={sel} value={f.depot} onChange={set("depot")}><option value="">Todos</option><option>Farmácia</option><option>Almoxarifado</option></select></label>
    <label className="text-xs">Tipo de movimento<select className={sel} value={f.kind} onChange={set("kind")}><option value="">Todos</option>{(Object.keys(KIND_LABEL) as MovementKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
    <label className="text-xs">Produto<Input placeholder="Código ou nome" value={f.product ?? ""} onChange={set("product")} /></label><label className="text-xs">Lote<Input value={f.lot ?? ""} onChange={set("lot")} /></label>
    <label className="text-xs">Paciente<Input value={f.patient ?? ""} onChange={set("patient")} /></label><label className="text-xs">FIA / BAA<Input value={f.fia ?? ""} onChange={set("fia")} /></label>
    <label className="text-xs">Centro de custo<Input value={f.costCenter ?? ""} onChange={set("costCenter")} /></label>
    <div className="flex items-end gap-3 text-sm"><label className="flex items-center gap-1"><input type="radio" checked={type === "analitico"} onChange={() => setType("analitico")} /> Analítico</label><label className="flex items-center gap-1"><input type="radio" checked={type === "sintetico"} onChange={() => setType("sintetico")} /> Sintético</label></div>
    <div className="flex items-end"><Button variant="outline" onClick={() => window.print()}>Imprimir</Button></div>
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="text-base">Mapa de movimentação · {f.depot || "Todos os estoques"}</CardTitle><p className="text-xs text-muted-foreground">Período: {f.from ? fmt(f.from) : "início"} a {f.to ? fmt(f.to) : "hoje"} · {rows.length} movimentos · Entradas +{ent} · Saídas −{sai}</p></CardHeader><CardContent className="overflow-x-auto">
    {type === "analitico" ? <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Data/Hora</th><th>Tipo</th><th>Produto</th><th>Lote</th><th>Origem</th><th>Destino / Paciente</th><th>FIA/BAA</th><th>Doc.</th><th className="text-right">Qtd</th><th>Operador</th></tr></thead><tbody>{rows.map((m) => { const sg = movementSign(m, f.depot); return <tr key={m.id} className="border-t align-top"><td className="whitespace-nowrap">{fmt(m.at)}</td><td>{KIND_LABEL[m.kind]}</td><td>{m.code} {m.item}</td><td>{m.lot || "—"}</td><td>{m.from}</td><td>{m.to}{m.reason ? <div className="text-muted-foreground">{m.reason}</div> : null}</td><td>{m.fia ? `FIA ${m.fia}` : ""}{m.baa ? ` BAA ${m.baa}` : ""}</td><td>{m.doc ?? ""}</td><td className={`text-right font-medium ${sg > 0 ? "text-primary" : "text-destructive"}`}>{sg > 0 ? "+" : "−"}{m.qty}</td><td>{m.by}</td></tr>; })}</tbody></table>
      : <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Código</th><th>Produto</th><th className="text-right">Entradas</th><th className="text-right">Saídas</th><th className="text-right">Saldo do período</th></tr></thead><tbody>{summarize(rows, f.depot).map((r) => <tr key={r.code ?? r.item} className="border-t"><td>{r.code}</td><td>{r.item}</td><td className="text-right">+{r.entradas}</td><td className="text-right">−{r.saidas}</td><td className="text-right font-medium">{r.entradas - r.saidas}</td></tr>)}</tbody></table>}
    {!rows.length && <p className="py-4 text-sm text-muted-foreground">Nenhuma movimentação no período/filtros.</p>}
  </CardContent></Card></div>;
}
