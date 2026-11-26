import type { Depot } from "@/lib/supply-flow";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, writeOffExpired } from "@/lib/hospital-store";
import { fmtExpiry, lotsByExpiry } from "@/lib/pharmacy-stock";
import { EXPIRY_LABEL, isControlled, lotMap, consumptionByPeriod, expiryStatus, type ConsumptionPeriod, type ExpiryStatus } from "@/lib/controlled";
import { MovementLog } from "./SupplyPanels";
import { cn } from "@/lib/utils";

const TONE: Record<ExpiryStatus, string> = { vencido: "bg-destructive text-destructive-foreground", critico: "bg-destructive/15 text-destructive", alerta: "bg-accent text-accent-foreground", ok: "bg-primary/10 text-primary", sem: "bg-muted text-muted-foreground" };
const Badge = ({ s }: { s: ExpiryStatus }) => <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONE[s])}>{EXPIRY_LABEL[s]}</span>;
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function ControlledCabinet() {
  const stock = useStore((s) => s.stock).filter(isControlled);
  const [q, setQ] = useState(""); const today = new Date();
  const list = stock.filter((i) => `${i.code} ${i.name}`.toLocaleLowerCase("pt-BR").includes(q.toLocaleLowerCase("pt-BR")));
  const total = stock.reduce((s, i) => s + i.quantity * (i.unitCost ?? 0), 0);
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Medicamentos" value={String(stock.length)} /><Stat label="Unidades em estoque" value={stock.reduce((s, i) => s + i.quantity, 0).toLocaleString("pt-BR")} /><Stat label="Valor em estoque" value={money(total)} />
    </div>
    <Input placeholder="Buscar por código ou nome" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Código</th><th className="p-2">Medicamento</th><th className="p-2">Un.</th><th className="p-2 text-right">Saldo</th><th className="p-2">Lotes (validade · qtd)</th></tr></thead>
        <tbody>{list.map((i) => <tr key={i.id} className={cn("border-t align-top", i.quantity === 0 && "text-muted-foreground")}>
          <td className="p-2 font-mono">{i.code}</td><td className="p-2 font-medium">{i.name}</td><td className="p-2">{i.unit}</td><td className="p-2 text-right font-semibold">{i.quantity}</td>
          <td className="p-2"><div className="flex flex-wrap gap-1">{lotsByExpiry(i).map((l) => <span key={l.lot} className={cn("rounded border px-1.5 py-0.5 text-xs", TONE[expiryStatus(l.expiry, today)])}>{l.lot} · {fmtExpiry(l.expiry)} · {l.quantity}</span>)}{!lotsByExpiry(i).length && <span className="text-xs">sem saldo</span>}</div></td>
        </tr>)}</tbody></table>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>; }

export function ExpiryPanel({ depot = "farmacia" }: { depot?: Depot }) {
  const wh = depot === "almoxarifado";
  const all = useStore((s) => (wh ? s.warehouse : s.stock)); const today = new Date();
  const [scope, setScope] = useState<"ctrl" | "all">(wh ? "all" : "ctrl");
  const rows = useMemo(() => lotMap(scope === "ctrl" ? all.filter(isControlled) : all, today), [all, scope]);
  const byMonth = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => { if (r.month) m.set(r.month, (m.get(r.month) ?? 0) + 1); }); return [...m.entries()].slice(0, 18); }, [rows]);
  const [pick, setPick] = useState<{ itemId: string; lot: string } | null>(null); const [qty, setQty] = useState(""); const [reason, setReason] = useState("Vencimento do prazo de validade");
  const sel = rows.find((r) => r.itemId === pick?.itemId && r.lot === pick?.lot);
  const count = (s: ExpiryStatus) => rows.filter((r) => r.status === s).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {!wh && <><Button size="sm" variant={scope === "ctrl" ? "default" : "outline"} onClick={() => setScope("ctrl")}>Armário de controlados</Button>
      <Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>Toda a farmácia</Button></>}
      <div className="ml-auto flex flex-wrap gap-2 text-xs">{(["vencido", "critico", "alerta", "ok"] as const).map((s) => <span key={s} className={cn("rounded-full px-2 py-1", TONE[s])}>{EXPIRY_LABEL[s]}: {count(s)}</span>)}</div>
    </div>
    <div className="rounded-xl border bg-card p-3"><p className="mb-2 text-sm font-semibold">Mapa de vencimentos por mês</p>
      <div className="flex flex-wrap gap-2">{byMonth.map(([m, n]) => { const [y, mm] = m.split("-"); const s = expiryStatus(`${m}-28`, today); return <div key={m} className={cn("min-w-20 rounded-lg px-2 py-1 text-center", TONE[s])}><p className="text-xs">{MONTHS[Number(mm) - 1]}/{y}</p><p className="text-lg font-semibold">{n}</p><p className="text-[10px]">lote(s)</p></div>; })}</div>
    </div>
    {sel && <form className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (!window.confirm(`Confirmar estorno de ${qty} ${sel.unit} de ${sel.item}, lote ${sel.lot}?`)) return; try { writeOffExpired(sel.itemId, sel.lot, Number(qty), reason, depot); toast.success("Estorno registrado e saldo baixado"); setPick(null); setQty(""); } catch (err) { toast.error((err as Error).message); } }}>
      <p className="font-semibold">Estorno: {sel.item} · lote {sel.lot} · validade {fmtExpiry(sel.expiry)} · saldo {sel.quantity}</p>
      <div className="flex flex-wrap gap-2"><Input type="number" min={1} max={sel.quantity} placeholder="Quantidade" value={qty} onChange={(e) => setQty(e.target.value)} className="w-32" />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>{["Vencimento do prazo de validade", "Avaria / ampola danificada", "Recolhimento ANVISA / fabricante"].map((r) => <option key={r}>{r}</option>)}</select>
        <Button type="submit" variant="destructive">Confirmar estorno</Button><Button type="button" variant="ghost" onClick={() => setPick(null)}>Cancelar</Button></div>
    </form>}
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Validade</th><th className="p-2">Situação</th><th className="p-2">Medicamento</th><th className="p-2">Lote</th><th className="p-2 text-right">Qtd</th><th className="p-2"></th></tr></thead>
      <tbody>{rows.filter((r) => r.status !== "ok" || scope === "ctrl").map((r) => <tr key={r.itemId + r.lot} className="border-t"><td className="p-2 whitespace-nowrap">{fmtExpiry(r.expiry)}{r.days !== null && <span className="ml-1 text-xs text-muted-foreground">({r.days < 0 ? `há ${-r.days} d` : `${r.days} d`})</span>}</td><td className="p-2"><Badge s={r.status} /></td><td className="p-2">{r.item}</td><td className="p-2 font-mono">{r.lot}</td><td className="p-2 text-right">{r.quantity}</td>
        <td className="p-2 text-right"><Button size="sm" variant={r.status === "vencido" ? "destructive" : "outline"} onClick={() => { setPick({ itemId: r.itemId, lot: r.lot }); setQty(String(r.quantity)); setReason(r.status === "vencido" ? "Vencimento do prazo de validade" : "Avaria / ampola danificada"); }}>Estornar</Button></td></tr>)}</tbody></table></div>
    <p className="text-sm font-semibold">Histórico de estornos</p><MovementLog kinds={["vencimento"]} {...(wh ? { depot } : {})} />
  </div>;
}

export function ConsumptionReport({ depot = "farmacia" }: { depot?: Depot }) {
  const wh = depot === "almoxarifado";
  const all = useStore((s) => (wh ? s.warehouse : s.stock)); const movements = useStore((s) => s.movements);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const [period, setPeriod] = useState<ConsumptionPeriod>("month");
  const [day, setDay] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [scope, setScope] = useState<"ctrl" | "all">(wh ? "all" : "ctrl"); const [margin, setMargin] = useState("20");
  const periodValue = period === "day" ? day : period === "month" ? month : year;
  const periodLabel = period === "day" ? day.split("-").reverse().join("/") : period === "month" ? `${MONTHS[Number(month.slice(5)) - 1]}/${month.slice(0, 4)}` : `Ano ${year}`;
  const periodUnit = period === "day" ? "dia" : period === "month" ? "mês" : "ano";
  const rows = consumptionByPeriod(scope === "ctrl" ? all.filter(isControlled) : all, movements, period, periodValue, now, Number(margin) / 100).sort((a, b) => b.suggestion - a.suggestion || b.consumed - a.consumed || a.item.localeCompare(b.item, "pt-BR"));
  const shown = scope === "ctrl" ? rows : rows.filter((r) => r.consumed || r.lost || r.suggestion);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-2 print:hidden">
      <div className="flex items-center gap-1">{([["day", "Dia"], ["month", "Mês"], ["year", "Ano"]] as const).map(([k, label]) => <Button key={k} size="sm" variant={period === k ? "default" : "outline"} onClick={() => setPeriod(k)}>{label}</Button>)}</div>
      {period === "day" && <label className="text-xs">Data<Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-40" /></label>}
      {period === "month" && <label className="text-xs">Mês<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" /></label>}
      {period === "year" && <label className="text-xs">Ano<Input type="number" min={2020} max={2099} value={year} onChange={(e) => setYear(e.target.value)} className="w-28" /></label>}
      <label className="text-xs">Margem de segurança (%)<Input type="number" min={0} value={margin} onChange={(e) => setMargin(e.target.value)} className="w-28" /></label>
      {!wh && <><Button size="sm" variant={scope === "ctrl" ? "default" : "outline"} onClick={() => setScope("ctrl")}>Controlados</Button><Button size="sm" variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>Toda a farmácia</Button></>}
      <Button size="sm" variant="outline" className="ml-auto" onClick={() => window.print()}><Printer className="mr-1 size-4" />Imprimir</Button>
    </div>
    <div className="rounded-xl border bg-card p-3"><p className="font-semibold">Relatório de consumo — {periodLabel}</p><p className="text-xs text-muted-foreground">Consumo = dispensações + quebras do {periodUnit}. Sugestão de pedido = consumo + {margin}% + estoque mínimo − saldo válido (sem lotes vencidos).</p></div>
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Código</th><th className="p-2">Medicamento</th><th className="p-2">Un.</th><th className="p-2 text-right">Consumo</th><th className="p-2 text-right">Perda validade</th><th className="p-2 text-right">Saldo válido</th><th className="p-2 text-right">Pedido sugerido</th></tr></thead>
      <tbody>{shown.map((r) => <tr key={r.item} className="border-t"><td className="p-2 font-mono">{r.code}</td><td className="p-2">{r.item}</td><td className="p-2">{r.unit}</td><td className="p-2 text-right">{r.consumed}</td><td className="p-2 text-right">{r.lost || ""}</td><td className="p-2 text-right">{r.validBalance}</td><td className={cn("p-2 text-right font-semibold", r.suggestion > 0 && "text-primary")}>{r.suggestion}</td></tr>)}
        {!shown.length && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Sem consumo registrado neste {periodUnit}.</td></tr>}</tbody></table></div>
  </div>;
}
