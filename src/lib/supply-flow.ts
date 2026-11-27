import type { StockMedication } from "./pharmacy-stock";

export type Depot = "farmacia" | "almoxarifado";
export type MovementKind = "transferencia" | "devolucao" | "quebra" | "entrada" | "emprestimo_saida" | "emprestimo_entrada" | "vencimento" | "consumo" | "requisicao" | "inventario";
export interface Movement { id: string; kind: MovementKind; from: string; to: string; item: string; code?: string | undefined; qty: number; lot: string; reason: string; at: string; by: string; prescriber?: string | undefined; expiry?: string; doc?: string; due?: string; settledAt?: string; settledBy?: string; returnedQty?: number; returns?: { qty: number; at: string; by: string }[]; patient?: string; patientId?: string; fia?: string; baa?: string; costCenter?: string; urgent?: boolean }
export const loanReturnedQty = (m: Movement) => m.returnedQty ?? (m.settledAt ? m.qty : 0);
export interface SupplyRequest { id: string; target: Depot; items: string; sector: string; patient: string; note: string; status: "Pendente" | "Atendido" | "Recusado"; at: string; by: string; handledBy?: string; handledAt?: string; answer?: string }

export const DEPOT_LABEL: Record<Depot, string> = { farmacia: "Farmácia", almoxarifado: "Almoxarifado" };

function checkQty(qty: number) { if (!Number.isInteger(qty) || qty <= 0) throw new Error("Informe uma quantidade inteira maior que zero."); }

/** Soma (ou subtrai) quantidade do item e do lote informado; nunca deixa saldo negativo. */
export function changeQty(items: StockMedication[], id: string, delta: number, lot: string, expiry = ""): StockMedication[] {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error("Item não encontrado.");
  if (item.quantity + delta < 0) throw new Error(`Saldo insuficiente de ${item.name}. Disponível: ${item.quantity}.`);
  const l = lot.trim();
  let lots = item.lots ? [...item.lots] : [];
  const idx = lots.findIndex((x) => x.lot === l);
  if (idx >= 0) {
    const cur = lots[idx]!;
    if (cur.quantity + delta < 0) throw new Error(`Lote ${l} tem apenas ${cur.quantity}.`);
    lots[idx] = { ...cur, quantity: cur.quantity + delta, expiry: cur.expiry || expiry };
  } else if (delta > 0 && l) lots = [...lots, { lot: l, expiry, quantity: delta }];
  return items.map((i) => i.id === id ? { ...i, quantity: i.quantity + delta, lots } : i);
}

/** Move quantidade de um estoque para outro, criando o item no destino quando não existir. */
export function transferItem(src: StockMedication[], dst: StockMedication[], id: string, qty: number, lot: string, prefix: string) {
  checkQty(qty);
  if (!lot.trim()) throw new Error("Informe o lote transferido.");
  const item = src.find((i) => i.id === id);
  if (!item) throw new Error("Item não encontrado.");
  const nextSrc = changeQty(src, id, -qty, lot);
  const key = (i: StockMedication) => (i.code ? `c${i.code}` : `n${i.name.toLocaleLowerCase("pt-BR")}`);
  let target = dst.find((i) => key(i) === key(item));
  let nextDst = dst;
  if (!target) { target = { ...item, id: `${prefix}-${crypto.randomUUID()}`, quantity: 0, lots: [] }; nextDst = [...dst, target].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); }
  nextDst = changeQty(nextDst, target.id, qty, lot);
  return { src: nextSrc, dst: nextDst, item };
}

export { checkQty };
