import { useMemo, useState } from "react";
import { Barcode, CheckCircle2, ClipboardCheck, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canApproveInventory } from "@/lib/hospital-data";
import { approveInventoryCorrection, clearInventoryCount, saveInventoryCount, useStore } from "@/lib/hospital-store";
import { buildInventoryAdjustments, computeInventorySummary, findItemByBarcodeOrCode } from "@/lib/inventory";
import { isControlled } from "@/lib/controlled";
import type { StockMedication } from "@/lib/pharmacy-stock";
import { DEPOT_LABEL, type Depot } from "@/lib/supply-flow";

type Filter = "todos" | "divergentes" | "contados" | "pendentes";
type InvCategory = "todos" | "medicamento" | "controlados" | "armario-controlados" | "materiais";

const INV_CATEGORIES: { id: InvCategory; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "medicamento", label: "Medicamento" },
  { id: "controlados", label: "Medicamentos controlados" },
  { id: "armario-controlados", label: "Armários controlados" },
  { id: "materiais", label: "Materiais médicos" },
];

const MATERIAL_RE = /\b(seringa|agulha|equipo|cateter|sonda|gaze|luva|atadura|esparadrapo|micropore|curativo|scalp|jelco|abocath|fralda|algod[aã]o|compressa|l[aâ]mina|bisturi|fio\s+cir|m[aá]scara|avental|touca|prop[eé]|tubo\s+endotraq|c[aâ]nula|coletor|frasco\s+coletor|eletrodo|material|insumo)\b/i;
const CONTROLLED_RE = /\b(controlad|psicotr[oó]pic|entorpecent|morfina|fentanil|midazolam|diazepam|clonazepam|fenobarbital|tramadol|code[ií]na|petidina|cetamina|propofol|haloperidol|clorpromazina|alprazolam|lorazepam|zolpidem)\b/i;

function matchesInvCategory(item: StockMedication, cat: InvCategory, depot: Depot): boolean {
  if (cat === "todos") return true;
  const text = `${item.name} ${item.category ?? ""} ${item.presentation ?? ""} ${item.location ?? ""}`;
  const inCabinet = isControlled(item);
  const isMat = depot === "almoxarifado" || /material|m[ée]dic|hospitalar|insumo/i.test(item.category ?? "") || MATERIAL_RE.test(text);
  const isCtrl = inCabinet || CONTROLLED_RE.test(text);
  if (cat === "armario-controlados") return inCabinet;
  if (cat === "controlados") return isCtrl;
  if (cat === "materiais") return isMat && !isCtrl;
  return !isMat && !isCtrl;
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const groupOrder = (g: string) => Number(g.match(/^(\d+)/)?.[1] ?? 999);

export function InventoryPanel({ depot }: { depot: Depot }) {
  const items = useStore((s) => (depot === "farmacia" ? s.stock : s.warehouse));
  const inventories = useStore((s) => (Array.isArray(s.inventories) ? s.inventories : []));
  const profile = useStore((s) => s.profile);
  const accessAreas = useStore((s) => s.accessAreas);

  const [scan, setScan] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [invCat, setInvCat] = useState<InvCategory>("todos");
  const [group, setGroup] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [lotChoice, setLotChoice] = useState<Record<string, string>>({});
  const [manualLot, setManualLot] = useState<Record<string, { lot: string; expiry: string }>>({});

  const purchaseGroups = useMemo(() => {
    if (depot !== "almoxarifado") return [];
    const counts = new Map<string, number>();
    items.forEach((i) => { if (i.purchaseGroup) counts.set(i.purchaseGroup, (counts.get(i.purchaseGroup) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => groupOrder(a[0]) - groupOrder(b[0]) || a[0].localeCompare(b[0], "pt-BR"));
  }, [items, depot]);
  const usePurchaseGroups = depot === "almoxarifado" && purchaseGroups.length > 0;

  const draft = useMemo(() => inventories.find((i) => i.depot === depot && i.status === "rascunho"), [inventories, depot]);
  const history = useMemo(() => inventories.filter((i) => i.depot === depot && i.status === "homologado"), [inventories, depot]);
  const lines = draft?.lines ?? {};
  const summary = useMemo(() => computeInventorySummary(items, lines), [items, lines]);
  const adjustments = useMemo(() => buildInventoryAdjustments(items, lines), [items, lines]);
  const canApprove = canApproveInventory(profile, depot, accessAreas);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      if (usePurchaseGroups) {
        if (group && item.purchaseGroup !== group) return false;
      } else if (!matchesInvCategory(item, invCat, depot)) return false;
      const line = lines[item.id];
      if (filter === "contados" && !line) return false;
      if (filter === "pendentes" && line) return false;
      if (filter === "divergentes" && (!line || line.countedQty === item.quantity)) return false;
      if (!q) return true;
      return item.name.toLocaleLowerCase("pt-BR").includes(q) || (item.code ?? "").toLocaleLowerCase("pt-BR").includes(q) || (item.category ?? "").toLocaleLowerCase("pt-BR").includes(q) || (item.purchaseGroup ?? "").toLocaleLowerCase("pt-BR").includes(q);
    });
  }, [items, lines, query, filter, invCat, group, usePurchaseGroups, depot]);

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const found = findItemByBarcodeOrCode(items, scan);
    if (!found) { toast.error("Código não encontrado neste estoque."); return; }
    const next = (lines[found.id]?.countedQty ?? 0) + 1;
    try {
      saveInventoryCount(depot, found.id, next);
      toast.success(`${found.name}: contagem atualizada para ${next} ${found.unit}`);
      setScan("");
    } catch (err) { toast.error((err as Error).message); }
  }

  function handleCountChange(itemId: string, raw: string) {
    if (raw.trim() === "") {
      try { clearInventoryCount(depot, itemId); } catch (err) { toast.error((err as Error).message); }
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return;
    const item = items.find((x) => x.id === itemId);
    const mode = lotChoice[itemId] ?? (lines[itemId]?.lot ? (item?.lots?.some((l) => l.lot === lines[itemId]?.lot) ? lines[itemId]!.lot! : "__manual__") : "");
    const lotInfo = mode === "__manual__"
      ? { lot: manualLot[itemId]?.lot ?? lines[itemId]?.lot ?? "", expiry: manualLot[itemId]?.expiry ?? lines[itemId]?.expiry ?? "" }
      : mode
        ? { lot: mode, expiry: item?.lots?.find((l) => l.lot === mode)?.expiry ?? "" }
        : undefined;
    try { saveInventoryCount(depot, itemId, n, lotInfo); } catch (err) { toast.error((err as Error).message); }
  }

  function handleLotSelect(item: StockMedication, value: string) {
    setLotChoice((c) => ({ ...c, [item.id]: value }));
    const line = lines[item.id];
    if (!line) return;
    const lotInfo = value === "__manual__"
      ? { lot: manualLot[item.id]?.lot ?? "", expiry: manualLot[item.id]?.expiry ?? "" }
      : value
        ? { lot: value, expiry: item.lots?.find((l) => l.lot === value)?.expiry ?? "" }
        : undefined;
    try { saveInventoryCount(depot, item.id, line.countedQty, lotInfo); } catch (err) { toast.error((err as Error).message); }
  }

  function handleManualLotChange(itemId: string, patch: Partial<{ lot: string; expiry: string }>) {
    const next = { lot: manualLot[itemId]?.lot ?? lines[itemId]?.lot ?? "", expiry: manualLot[itemId]?.expiry ?? lines[itemId]?.expiry ?? "", ...patch };
    setManualLot((c) => ({ ...c, [itemId]: next }));
    const line = lines[itemId];
    if (!line) return;
    try { saveInventoryCount(depot, itemId, line.countedQty, next); } catch (err) { toast.error((err as Error).message); }
  }

  function handleApprove() {
    try {
      const count = approveInventoryCorrection(depot, justification);
      toast.success(`Inventário homologado! ${count} item(ns) corrigido(s) no estoque.`);
      setJustification("");
      setApproveOpen(false);
    } catch (err) { toast.error((err as Error).message); }
  }

  function printSheet() {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Permita pop-ups para imprimir a ficha de inventário."); return; }
    const rows = filtered.map((it) => {
      const ln = lines[it.id];
      const diff = ln ? ln.countedQty - it.quantity : null;
      return `<tr><td>${it.code ?? "-"}</td><td>${it.name}</td><td style="text-align:right">${it.quantity} ${it.unit}</td><td style="text-align:right">${ln ? ln.countedQty : "______"}</td><td style="text-align:right">${diff === null ? "-" : diff > 0 ? `+${diff}` : diff}</td></tr>`;
    }).join("");
    w.document.write(`<!doctype html><html><head><title>Ficha de Inventário – ${DEPOT_LABEL[depot]}</title><style>body{font-family:sans-serif;padding:24px;font-size:12px}h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f4f4f5}.sig{display:flex;gap:48px;margin-top:40px}.sig div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center}</style></head><body><h1>HMISC – Ficha de Conferência de Inventário (${DEPOT_LABEL[depot]})</h1><div>Emissão: ${new Date().toLocaleString("pt-BR")} · Itens listados: ${filtered.length} · Divergências: ${summary.divergentItems}</div><table><thead><tr><th>Código</th><th>Produto</th><th style="text-align:right">Sistema</th><th style="text-align:right">Contagem Física</th><th style="text-align:right">Divergência</th></tr></thead><tbody>${rows}</tbody></table><div class="sig"><div>Conferente / Equipe</div><div>Coordenador de Estoque</div></div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return <div className="space-y-4">
    {usePurchaseGroups ? (
      <div className="space-y-1.5 border-b pb-3">
        <p className="text-xs font-medium text-muted-foreground">Grupo de Compra</p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Grupos de Compra do inventário">
          <Button size="sm" role="tab" aria-selected={group === ""} variant={group === "" ? "default" : "outline"} onClick={() => setGroup("")}>Todos ({items.length})</Button>
          {purchaseGroups.map(([g, count]) => (
            <Button key={g} size="sm" role="tab" aria-selected={group === g} variant={group === g ? "default" : "outline"} onClick={() => setGroup(g)}>{g} ({count})</Button>
          ))}
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap gap-2 border-b pb-3" role="tablist" aria-label="Categorias do inventário">
        {INV_CATEGORIES.map((c) => {
          const count = items.filter((it) => matchesInvCategory(it, c.id, depot)).length;
          return (
            <Button key={c.id} size="sm" variant={invCat === c.id ? "default" : "outline"} role="tab" aria-selected={invCat === c.id} onClick={() => setInvCat(c.id)}>
              {c.label} ({count})
            </Button>
          );
        })}
      </div>
    )}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Itens no estoque</div><div className="text-2xl font-semibold">{summary.totalItems}</div></div>
      <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Contados / Pendentes</div><div className="text-2xl font-semibold">{summary.countedItems} <span className="text-sm font-normal text-muted-foreground">/ {summary.pendingItems}</span></div></div>
      <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Divergências</div><div className="text-2xl font-semibold">{summary.divergentItems} <span className="text-xs font-normal text-muted-foreground">(+{summary.surplusItems} / -{summary.shortageItems})</span></div></div>
      <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Conformidade</div><div className="text-2xl font-semibold">{summary.conformityRate}%</div></div>
      <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Impacto financeiro</div><div className={`text-xl font-semibold ${summary.financialImpact < 0 ? "text-destructive" : summary.financialImpact > 0 ? "text-emerald-600" : ""}`}>{brl(summary.financialImpact)}</div></div>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
      <form onSubmit={handleScan} className="flex flex-1 min-w-[240px] items-center gap-2">
        <Barcode className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Bipar código de barras ou código do item (+1 na contagem)..." />
        <Button type="submit" variant="secondary" size="sm">Somar +1</Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={printSheet}><Printer className="mr-1.5 h-4 w-4" />Imprimir ficha</Button>
        <Button type="button" size="sm" disabled={!canApprove || adjustments.length === 0} onClick={() => setApproveOpen(true)}>
          <ShieldCheck className="mr-1.5 h-4 w-4" />Efetivar Correção de Inventário ({adjustments.length})
        </Button>
      </div>
    </div>

    {!canApprove && <div className="rounded-md border border-amber-300 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      Você pode registrar a contagem física normalmente. A efetivação das correções no estoque é exclusiva do <strong>Coordenador de Inventário ({DEPOT_LABEL[depot]})</strong> ou <strong>Administrador</strong> (configurável em Colaboradores → Áreas).
    </div>}

    <div className="flex flex-wrap items-center gap-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto, código ou categoria..." className="max-w-sm" />
      {(["todos", "divergentes", "contados", "pendentes"] as Filter[]).map((f) => (
        <Button key={f} type="button" size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
          {f === "todos" ? "Todos" : f === "divergentes" ? `Divergentes (${summary.divergentItems})` : f === "contados" ? `Contados (${summary.countedItems})` : `Pendentes (${summary.pendingItems})`}
        </Button>
      ))}
    </div>

    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
          <tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Produto</th><th className="p-2 text-left">Lote / Validade</th><th className="p-2 text-right">Saldo Sistema</th><th className="p-2 text-right w-36">Contagem Física</th><th className="p-2 text-right">Divergência</th><th className="p-2 text-right">Impacto</th><th className="p-2 w-10"></th></tr>
        </thead>
        <tbody className="divide-y">
          {filtered.slice(0, 150).map((item) => {
            const line = lines[item.id];
            const delta = line ? line.countedQty - item.quantity : null;
            const fin = delta !== null ? delta * (item.unitCost ?? 0) : 0;
            const currentMode = lotChoice[item.id] ?? (line?.lot ? (item.lots?.some((l) => l.lot === line.lot) ? line.lot : "__manual__") : "");
            const mLot = manualLot[item.id] ?? { lot: line?.lot ?? "", expiry: line?.expiry ?? "" };
            return <tr key={item.id} className="hover:bg-muted/30">
              <td className="p-2 font-mono text-xs text-muted-foreground">{item.code ?? "-"}</td>
              <td className="p-2"><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.purchaseGroup ?? item.category ?? item.presentation}{line ? ` · Contado por ${line.countedBy}` : ""}</div></td>
              <td className="p-2">
                <div className="space-y-1">
                  <select aria-label={`Lote de ${item.name}`} className="h-8 w-44 rounded-md border bg-background px-2 text-xs" value={currentMode} onChange={(e) => handleLotSelect(item, e.target.value)}>
                    <option value="">Saldo geral</option>
                    {(item.lots ?? []).map((l) => <option key={l.lot + l.expiry} value={l.lot}>{`${l.lot} · val. ${l.expiry || "—"} (${l.quantity})`}</option>)}
                    <option value="__manual__">Digitar lote/validade manual</option>
                  </select>
                  {currentMode === "__manual__" && (
                    <div className="flex gap-1">
                      <Input aria-label={`Lote manual de ${item.name}`} placeholder="Lote" className="h-7 w-24 text-xs" value={mLot.lot} onChange={(e) => handleManualLotChange(item.id, { lot: e.target.value })} />
                      <Input aria-label={`Validade manual de ${item.name}`} type="date" className="h-7 w-32 text-xs" value={mLot.expiry} onChange={(e) => handleManualLotChange(item.id, { expiry: e.target.value })} />
                    </div>
                  )}
                </div>
              </td>
              <td className="p-2 text-right font-mono">{item.quantity} {item.unit}</td>
              <td className="p-2 text-right"><Input type="number" min={0} step={1} aria-label={`Contagem de ${item.name}`} className="h-8 w-28 ml-auto text-right font-mono" placeholder="—" value={line ? String(line.countedQty) : ""} onChange={(e) => handleCountChange(item.id, e.target.value)} /></td>
              <td className="p-2 text-right">{delta === null ? <span className="text-xs text-muted-foreground">Pendente</span> : delta === 0 ? <Badge variant="secondary">Conforme</Badge> : <Badge variant={delta > 0 ? "default" : "destructive"}>{delta > 0 ? `+${delta}` : delta}</Badge>}</td>
              <td className="p-2 text-right font-mono text-xs">{delta === null || fin === 0 ? "—" : brl(fin)}</td>
              <td className="p-2 text-right">{line && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Limpar contagem" onClick={() => clearInventoryCount(depot, item.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>}</td>
            </tr>;
          })}
          {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum item encontrado para o filtro selecionado.</td></tr>}
        </tbody>
      </table>
      {filtered.length > 150 && <div className="border-t p-2 text-center text-xs text-muted-foreground">Mostrando os primeiros 150 de {filtered.length} itens. Use a busca ou o leitor de código de barras para localizar rapidamente.</div>}
    </div>

    {history.length > 0 && <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" />Histórico de inventários homologados</div>
      <div className="divide-y text-xs">
        {history.slice(0, 10).map((h) => <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div><span className="font-medium">{h.approvedAt}</span> · Coordenador: <strong>{h.approvedBy}</strong> · {h.appliedAdjustments ?? 0} ajuste(s) aplicado(s)<div className="text-muted-foreground">Justificativa: {h.justification}</div></div>
          <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />Homologado</Badge>
        </div>)}
      </div>
    </div>}

    <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Efetivar Correção de Inventário · {DEPOT_LABEL[depot]}</DialogTitle>
          <DialogDescription>Esta ação atualizará o saldo oficial de <strong>{adjustments.length} item(ns)</strong> (impacto de {brl(summary.financialImpact)}) e gravará a movimentação de auditoria.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Justificativa formal do coordenador *</label>
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Ex.: Inventário mensal conferido em prateleira com a equipe da farmácia..." rows={3} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>Cancelar</Button>
          <Button type="button" onClick={handleApprove}>Confirmar e corrigir estoque</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}