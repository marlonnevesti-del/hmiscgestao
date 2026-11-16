import type { StockLot, StockMedication } from "./pharmacy-stock";

/** Dígito verificador EAN-13 calculado sobre os 12 primeiros dígitos. */
export function ean13Check(digits12: string) {
  if (!/^\d{12}$/.test(digits12)) throw new Error("O código precisa de 12 dígitos.");
  const sum = [...digits12].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}
export const isValidEan13 = (code: string) => /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === code[12];

/** Código interno da instituição (prefixo 2, reservado pela GS1): 2 + produto (6) + sequência (5) + verificador. */
export function internalBarcode(productCode: string, sequence: number) {
  const product = (productCode.replace(/\D/g, "") || "0").slice(-6).padStart(6, "0");
  const base = `2${product}${String(sequence % 100000).padStart(5, "0")}`;
  return base + ean13Check(base);
}

export const cleanCode = (raw: string) => raw.replace(/[\s\r\n]/g, "");

/** Localiza o produto (e o lote, quando vinculado) por um código bipado. */
export function findByBarcode(items: StockMedication[], raw: string): { item: StockMedication; lot?: StockLot } | undefined {
  const code = cleanCode(raw);
  if (!code) return undefined;
  for (const item of items) {
    const lot = item.lots?.find((l) => l.barcode === code);
    if (lot) return { item, lot };
    if (item.barcodes?.includes(code) || item.code === code) return { item };
  }
  return undefined;
}

/** Vincula um código ao produto ou a um lote; o mesmo código não pode pertencer a dois produtos. */
export function linkCode(items: StockMedication[], id: string, raw: string, lot?: string) {
  const code = cleanCode(raw);
  if (code.length < 4) throw new Error("Código de barras inválido.");
  const owner = findByBarcode(items, code);
  if (owner && owner.item.id !== id) throw new Error(`Este código já pertence a ${owner.item.name}.`);
  return items.map((i) => {
    if (i.id !== id) return i;
    if (lot) {
      if (!i.lots?.some((l) => l.lot === lot)) throw new Error("Lote não encontrado neste produto.");
      return { ...i, lots: i.lots.map((l) => l.lot === lot ? { ...l, barcode: code } : l) };
    }
    return { ...i, barcodes: [...new Set([...(i.barcodes ?? []), code])] };
  });
}
