import type { StockMedication } from "./pharmacy-stock";
import type { Depot } from "./supply-flow";

export interface InventoryLine {
  itemId: string;
  code?: string;
  name: string;
  unit: string;
  category?: string;
  unitCost?: number;
  systemQty: number;
  countedQty: number;
  lot?: string;
  expiry?: string;
  countedBy: string;
  countedAt: string;
}

export interface InventorySession {
  id: string;
  depot: Depot;
  status: "rascunho" | "homologado";
  startedAt: string;
  startedBy: string;
  updatedAt: string;
  updatedBy: string;
  lines: Record<string, InventoryLine>;
  approvedAt?: string;
  approvedBy?: string;
  justification?: string;
  appliedAdjustments?: number;
}

export interface InventoryAdjustment {
  itemId: string;
  code?: string;
  name: string;
  unit: string;
  systemQty: number;
  countedQty: number;
  delta: number;
  financialDelta: number;
  lot?: string;
  expiry?: string;
  countedBy: string;
}

export interface InventorySummary {
  totalItems: number;
  countedItems: number;
  pendingItems: number;
  matchingItems: number;
  surplusItems: number;
  shortageItems: number;
  divergentItems: number;
  financialImpact: number;
  conformityRate: number;
}

/** Encontra um item do estoque pelo código de barras do produto, de algum lote ou pelo código interno. */
export function findItemByBarcodeOrCode(items: readonly StockMedication[], rawQuery: string): StockMedication | undefined {
  const q = rawQuery.trim().toLocaleLowerCase("pt-BR");
  if (!q) return undefined;
  return items.find((item) => {
    if (item.code && item.code.trim().toLocaleLowerCase("pt-BR") === q) return true;
    if (item.barcodes?.some((b) => b.trim().toLocaleLowerCase("pt-BR") === q)) return true;
    if (item.lots?.some((l) => l.barcode && l.barcode.trim().toLocaleLowerCase("pt-BR") === q)) return true;
    return false;
  });
}

/** Calcula os ajustes necessários comparando a contagem física com o saldo atual do estoque. */
export function buildInventoryAdjustments(
  items: readonly StockMedication[],
  lines: Record<string, InventoryLine>,
): InventoryAdjustment[] {
  const out: InventoryAdjustment[] = [];
  for (const item of items) {
    const line = lines[item.id];
    if (!line) continue;
    const delta = line.countedQty - item.quantity;
    if (delta === 0) continue;
    out.push({
      itemId: item.id,
      ...(item.code ? { code: item.code } : {}),
      name: item.name,
      unit: item.unit,
      systemQty: item.quantity,
      countedQty: line.countedQty,
      delta,
      financialDelta: delta * (item.unitCost ?? 0),
      ...(line.lot ? { lot: line.lot } : {}),
      ...(line.expiry ? { expiry: line.expiry } : {}),
      countedBy: line.countedBy,
    });
  }
  return out;
}

/** Consolida os indicadores de conferência e impacto financeiro do inventário em andamento. */
export function computeInventorySummary(
  items: readonly StockMedication[],
  lines: Record<string, InventoryLine>,
): InventorySummary {
  let countedItems = 0;
  let matchingItems = 0;
  let surplusItems = 0;
  let shortageItems = 0;
  let financialImpact = 0;

  for (const item of items) {
    const line = lines[item.id];
    if (!line) continue;
    countedItems++;
    const delta = line.countedQty - item.quantity;
    if (delta === 0) matchingItems++;
    else if (delta > 0) surplusItems++;
    else shortageItems++;
    financialImpact += delta * (item.unitCost ?? 0);
  }

  const totalItems = items.length;
  const pendingItems = Math.max(0, totalItems - countedItems);
  const divergentItems = surplusItems + shortageItems;
  const conformityRate = countedItems > 0 ? Math.round((matchingItems / countedItems) * 100) : 100;

  return {
    totalItems,
    countedItems,
    pendingItems,
    matchingItems,
    surplusItems,
    shortageItems,
    divergentItems,
    financialImpact,
    conformityRate,
  };
}