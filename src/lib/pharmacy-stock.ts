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
  barcodes?: string[];
  category?: string;
  purchaseGroup?: string;
}
export interface StockLot { lot: string; expiry: string; quantity: number; barcode?: string }
export interface CatalogRow { code: string; name: string; unit: string; quantity: number; unitCost: number; antibiotic: boolean; location: string; lots: StockLot[]; category?: string; purchaseGroup?: string }

/** Converte as linhas do relatório de saldos em itens de estoque com id estável por código e local. */
export function catalogToStock(rows: CatalogRow[], prefix: string): StockMedication[] {
  return rows.map((r) => ({ id: `${prefix}-${r.code}-${r.location.toLocaleLowerCase("pt-BR").replace(/\W+/g, "-")}`, code: r.code, name: r.name, presentation: r.location, location: r.location, unit: r.unit, quantity: r.quantity, minimum: 0, unitCost: r.unitCost, antibiotic: r.antibiotic, lots: r.lots, ...(r.category ? { category: r.category } : {}), ...(r.purchaseGroup ? { purchaseGroup: r.purchaseGroup } : {}) }));
}
/** Acrescenta itens importados que ainda não existem, sem sobrescrever saldos já movimentados. */
export function mergeCatalog(stock: StockMedication[], catalog: StockMedication[], removed: readonly string[] = []) {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  // Itens já salvos sem lotes recebem os lotes do relatório importado.
  stock = stock.map((i) => (!i.lots || i.lots.length === 0) && byId.get(i.id)?.lots?.length ? { ...i, lots: byId.get(i.id)!.lots ?? [] } : i);
  // Itens já salvos recebem a categoria do catálogo importado.
  stock = stock.map((i) => !i.category && byId.get(i.id)?.category ? { ...i, category: byId.get(i.id)!.category! } : i);
  // Itens já salvos recebem o Grupo de Compra do catálogo importado.
  stock = stock.map((i) => !i.purchaseGroup && byId.get(i.id)?.purchaseGroup ? { ...i, purchaseGroup: byId.get(i.id)!.purchaseGroup! } : i);
  const ids = new Set([...stock.map((i) => i.id), ...removed]);
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
        ...(Array.isArray(raw.barcodes) ? { barcodes: raw.barcodes.filter((b): b is string => typeof b === "string" && b.trim().length > 0) } : {}),
        ...(typeof raw.category === "string" && raw.category ? { category: raw.category } : {}),
        ...(typeof raw.purchaseGroup === "string" && raw.purchaseGroup ? { purchaseGroup: raw.purchaseGroup } : {}),
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

/** Lotes com saldo, do vencimento mais próximo para o mais distante. */
export function lotsByExpiry(item?: Pick<StockMedication, "lots">) {
  return (item?.lots ?? []).filter((l) => l.quantity > 0).sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
}
export const fmtExpiry = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d || "sem validade");
