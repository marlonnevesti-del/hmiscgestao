import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStockLow, type StockMedication } from "@/lib/pharmacy-stock";
import { cn } from "@/lib/utils";
import { findByBarcode, internalBarcode } from "@/lib/barcode";
import { linkBarcode, useStore } from "@/lib/hospital-store";
import { BarcodeScan } from "./BarcodeScan";
import { LabelPrint, printLabels, type Label } from "./LabelPrint";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Tabela de saldos com busca, local, lotes/validade e lançamento de entradas e saídas. */
export function StockTable({ items, allowed, onAdjust, onDelete, label = "Item", kind = "stock" }: { kind?: "stock" | "warehouse"; items: StockMedication[]; allowed: boolean; onAdjust: (id: string, delta: number) => void; onDelete?: ((id: string) => void) | undefined; label?: string }) {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [adj, setAdj] = useState<Record<string, string>>({});
  const [labelData, setLabel] = useState<Label | null>(null);
  const employee = useStore((st) => st.employeeName);
  const attempt = (fn: () => void) => { try { fn(); } catch (err) { toast.error(err instanceof Error ? err.message : "Ação não concluída"); } };
  const onScan = (code: string) => { const hit = findByBarcode(items, code); if (!hit) { toast.error(`Código ${code} não cadastrado. Use o botão "Código" no produto para vincular.`); return; } setQ(hit.item.name); toast.success(`${hit.item.name}${hit.lot ? ` · lote ${hit.lot.lot}` : ""}`); };
  const lotChoice = (i: StockMedication) => { const names = (i.lots ?? []).map((l) => l.lot); if (!names.length) return ""; if (names.length === 1) return names[0]!; return window.prompt(`Lote (${names.join(", ")}) — deixe vazio para o produto`, names[0]) ?? null; };
  const link = (i: StockMedication) => { const code = window.prompt(`Bipe ou digite o código de barras de ${i.name}`); if (!code) return; const lot = lotChoice(i); if (lot === null) return; attempt(() => { linkBarcode(kind, i.id, code, lot || undefined); toast.success("Código vinculado"); }); };
  const makeLabel = (i: StockMedication) => { const lotName = lotChoice(i); if (lotName === null) return; const lot = i.lots?.find((l) => l.lot === lotName); let code = lot?.barcode ?? i.barcodes?.[0]; attempt(() => { if (!code) { code = internalBarcode(i.code ?? "", Date.now() % 100000); linkBarcode(kind, i.id, code, lot?.lot); } const copies = Number(window.prompt("Quantidade de etiquetas", "1") ?? 0); if (!copies) return; setLabel({ kind: "unit", name: i.name, lot: lot?.lot ?? "", expiry: lot?.expiry ?? "", barcode: code, pharmacist: employee, copies }); printLabels(); }); };
  const locations = useMemo(() => [...new Set(items.map((i) => i.location).filter(Boolean))] as string[], [items]);
  const term = q.trim().toLocaleLowerCase("pt-BR");
  const shown = items.filter((i) => (!loc || i.location === loc) && (!term || i.name.toLocaleLowerCase("pt-BR").includes(term) || i.code?.includes(term)));
  const total = shown.reduce((s, i) => s + i.quantity * (i.unitCost ?? 0), 0);
  return <div className="space-y-3">
    <BarcodeScan onScan={onScan} placeholder="Bipar código para localizar o produto" className="max-w-md" />
    <LabelPrint label={labelData} />
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-60 flex-1"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar no estoque" className="pl-8" placeholder="Buscar por nome ou código" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {locations.length > 1 && <select aria-label="Local de estoque" className="h-9 rounded-md border bg-background px-2 text-sm" value={loc} onChange={(e) => setLoc(e.target.value)}><option value="">Todos os locais</option>{locations.map((l) => <option key={l}>{l}</option>)}</select>}
      <span className="text-sm text-muted-foreground">{shown.length} itens · {money(total)}</span>
    </div>
    <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Código</th><th className="p-3">{label}</th><th className="p-3">Estoque</th><th className="p-3">Custo médio</th><th className="p-3">Lotes / validade</th><th className="p-3">Entrada / ajuste</th></tr></thead><tbody>
      {shown.map((i) => <tr key={i.id} className="border-t align-top">
        <td className="p-3 font-mono text-xs">{i.code ?? "—"}</td>
        <td className="p-3"><div className="font-medium">{i.name}{i.antibiotic && <span className="ml-2 rounded bg-muted px-1.5 text-[10px] uppercase">Antibiótico</span>}</div><div className="text-xs text-muted-foreground">{i.location || i.presentation || "Local não informado"}</div></td>
        <td className={cn("p-3 font-mono font-semibold", isStockLow(i) && "text-destructive")}>{i.quantity.toLocaleString("pt-BR")} {i.unit}{isStockLow(i) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}</td>
        <td className="p-3 font-mono text-xs">{i.unitCost != null ? money(i.unitCost) : "—"}</td>
        <td className="p-3 text-xs">{i.lots?.length ? i.lots.map((l) => <div key={l.lot + l.expiry} className="font-mono">{l.lot} · {l.expiry} · {l.quantity}{l.barcode && <div className="text-muted-foreground">▮ {l.barcode}</div>}</div>) : "—"}{i.barcodes?.map((b) => <div key={b} className="font-mono text-muted-foreground">▮ {b}</div>)}</td>
        <td className="p-3"><div className="flex gap-2"><Input aria-label={`Ajuste de ${i.name}`} className="w-24" type="number" placeholder="+/- qtd" value={adj[i.id] ?? ""} onChange={(e) => setAdj((c) => ({ ...c, [i.id]: e.target.value }))} /><Button size="sm" variant="secondary" disabled={!allowed || !Number(adj[i.id])} onClick={() => { try { onAdjust(i.id, Number(adj[i.id])); setAdj((c) => ({ ...c, [i.id]: "" })); toast.success("Estoque atualizado"); } catch (err) { toast.error(err instanceof Error ? err.message : "Ação não concluída"); } }}>Lançar</Button><Button size="sm" variant="outline" disabled={!allowed} onClick={() => link(i)}>Código</Button><Button size="sm" variant="outline" disabled={!allowed} onClick={() => makeLabel(i)}>Etiqueta</Button>{onDelete && <Button size="sm" variant="destructive" aria-label={`Apagar ${i.name}`} onClick={() => { if (!confirm(`Apagar ${i.name} do estoque?`)) return; try { onDelete(i.id); toast.success("Item apagado"); } catch (err) { toast.error(err instanceof Error ? err.message : "Ação não concluída"); } }}>Apagar</Button>}</div></td>
      </tr>)}
      {!shown.length && <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Nenhum item encontrado.</td></tr>}
    </tbody></table></div>
  </div>;
}
