export interface StockMedication {
  id: string;
  name: string;
  presentation: string;
  unit: string;
  quantity: number;
  minimum: number;
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
