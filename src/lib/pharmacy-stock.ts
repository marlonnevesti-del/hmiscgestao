export interface StockMedication {
  id: string;
  name: string;
  presentation: string;
  unit: string;
  quantity: number;
  minimum: number;
  code?: string;
  location?: string;
  unitCost?: number;
  antibiotic?: boolean;
  lots?: StockLot[];
}
export interface StockLot { lot: string; expiry: string; quantity: number }
export interface CatalogRow { code: string; name: string; unit: string; quantity: number; unitCost: number; antibiotic: boolean; location: string; lots: StockLot[] }

/** Converte as linhas do relatório de saldos em itens de estoque com id estável por código e local. */
export function catalogToStock(rows: CatalogRow[], prefix: string): StockMedication[] {
  return rows.map((r) => ({ id: `${prefix}-${r.code}-${r.location.toLocaleLowerCase("pt-BR").replace(/\W+/g, "-")}`, code: r.code, name: r.name, presentation: r.location, location: r.location, unit: r.unit, quantity: r.quantity, minimum: 0, unitCost: r.unitCost, antibiotic: r.antibiotic, lots: r.lots }));
}
/** Acrescenta itens importados que ainda não existem, sem sobrescrever saldos já movimentados. */
export function mergeCatalog(stock: StockMedication[], catalog: StockMedication[]) {
  const ids = new Set(stock.map((i) => i.id));
  const missing = catalog.filter((i) => !ids.has(i.id));
  return missing.length ? [...stock, ...missing].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) : stock;
}

export function isStockLow(item: Pick<StockMedication, "quantity" | "minimum">) {
  return item.quantity <= item.minimum;
}

/** Vincula a prescrição ao medicamento pelo nome base, sem incluir dose ou posologia. */
export function medicationKey(item: string) {
  return (item.trim().split(/\s+/)[0] ?? "").toLocaleLowerCase("pt-BR");
}

export function findStockMedication(stock: StockMedication[], prescriptionItem: string) {
  const key = medicationKey(prescriptionItem);
  return stock.find((item) => medicationKey(item.name) === key);
}

/** Converte o estoque antigo (nome → quantidade) sem perder os saldos já gravados. */
export function normalizeStock(value: unknown): StockMedication[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const raw = item as Partial<StockMedication>;
      if (!raw.id || !raw.name) return [];
      return [{
        id: raw.id,
        name: raw.name,
        presentation: raw.presentation ?? "",
        unit: raw.unit || "un",
        quantity: Math.max(0, Number(raw.quantity) || 0),
        minimum: Math.max(0, Number(raw.minimum) || 0),
        ...(raw.code ? { code: raw.code } : {}),
        ...(raw.location ? { location: raw.location } : {}),
        ...(raw.unitCost != null ? { unitCost: Number(raw.unitCost) || 0 } : {}),
        ...(raw.antibiotic != null ? { antibiotic: !!raw.antibiotic } : {}),
        ...(Array.isArray(raw.lots) ? { lots: raw.lots } : {}),
      }];
    });
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).map(([name, quantity]) => ({
    id: `legacy-${encodeURIComponent(name)}`,
    name,
    presentation: "",
    unit: "un",
    quantity: Math.max(0, Number(quantity) || 0),
    minimum: 0,
  }));
}
