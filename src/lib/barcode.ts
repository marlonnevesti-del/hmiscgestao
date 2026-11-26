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

/** Extrai GTIN (AI 01) e Lote (AI 10) de um código GS1 DataMatrix quando presente. */
export function parseGs1(raw: string): { gtin?: string; lot?: string } {
  const clean = raw.trim();
  const gtinParen = clean.match(/\(01\)(\d{13,14})/)?.[1];
  const lotParen = clean.match(/\(10\)([^\(\)\s\x1d]{1,20})/)?.[1];
  if (gtinParen || lotParen) return { ...(gtinParen ? { gtin: gtinParen } : {}), ...(lotParen ? { lot: lotParen } : {}) };
  const gtinPlain = clean.match(/^01(\d{14})(?:17\d{6})?(?:10([^\x1d\s]{1,20}))?/);
  if (gtinPlain) return { ...(gtinPlain[1] ? { gtin: gtinPlain[1] } : {}), ...(gtinPlain[2] ? { lot: gtinPlain[2] } : {}) };
  return {};
}

function pickDefaultLot(item: StockMedication): StockLot | undefined {
  const lots = (item.lots ?? []).filter((l) => l.quantity > 0);
  if (!lots.length) return item.lots?.[0];
  return lots.slice().sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
}

/** Localiza o produto (e o lote, quando vinculado) por um código bipado. */
export function findByBarcode(items: StockMedication[], raw: string): { item: StockMedication; lot?: StockLot } | undefined {
  const code = cleanCode(raw);
  if (!code) return undefined;
  const gs1 = parseGs1(raw);
  const gtin13 = gs1.gtin?.length === 14 && gs1.gtin.startsWith("0") ? gs1.gtin.slice(1) : gs1.gtin;
  for (const item of items) {
    const lot = item.lots?.find((l) => l.barcode === code);
    if (lot) return { item, lot };
    if (gs1.gtin && (item.barcodes?.includes(gs1.gtin) || (gtin13 && item.barcodes?.includes(gtin13)) || item.code === gs1.gtin || (gtin13 && item.code === gtin13))) {
      const matchedLot = gs1.lot ? item.lots?.find((l) => l.lot.toUpperCase() === gs1.lot!.toUpperCase()) : undefined;
      const resolved = matchedLot ?? pickDefaultLot(item);
      return resolved ? { item, lot: resolved } : { item };
    }
    if (item.barcodes?.includes(code) || item.code === code) {
      const resolved = pickDefaultLot(item);
      return resolved ? { item, lot: resolved } : { item };
    }
  }
  for (const item of items) {
    const byLot = item.lots?.find((l) => l.lot.toUpperCase() === code.toUpperCase());
    if (byLot) return { item, lot: byLot };
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
