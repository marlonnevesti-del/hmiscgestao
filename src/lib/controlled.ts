import type { StockMedication } from "./pharmacy-stock";
import type { Movement } from "./supply-flow";

export const CONTROLLED_LOCATION = "Armário de Controlados";
export const isControlled = (i: Pick<StockMedication, "location">) => i.location === CONTROLLED_LOCATION;

export type ExpiryStatus = "vencido" | "critico" | "alerta" | "ok" | "sem";
export const EXPIRY_LABEL: Record<ExpiryStatus, string> = { vencido: "Vencido", critico: "Vence em até 30 dias", alerta: "Vence em 31–90 dias", ok: "Válido", sem: "Sem validade" };

/** Dias até o vencimento (negativo = vencido). Validade vale até o fim do dia indicado. */
export function daysToExpiry(expiry: string, today: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  const [y, m, d] = expiry.split("-").map(Number);
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y!, m! - 1, d!) - t) / 86400000);
}
export function expiryStatus(expiry: string, today: Date): ExpiryStatus {
  const n = daysToExpiry(expiry, today);
  if (n === null) return "sem";
  if (n < 0) return "vencido";
  if (n <= 30) return "critico";
  if (n <= 90) return "alerta";
  return "ok";
}

export interface LotRow { itemId: string; item: string; code?: string | undefined; unit: string; lot: string; expiry: string; quantity: number; days: number | null; status: ExpiryStatus; month: string }
/** Todos os lotes com saldo, ordenados por validade, com mês de vencimento (AAAA-MM) para o mapa. */
export function lotMap(stock: StockMedication[], today: Date): LotRow[] {
  return stock.flatMap((i) => (i.lots ?? []).filter((l) => l.quantity > 0).map((l) => ({ itemId: i.id, item: i.name, code: i.code, unit: i.unit, lot: l.lot, expiry: l.expiry, quantity: l.quantity, days: daysToExpiry(l.expiry, today), status: expiryStatus(l.expiry, today), month: l.expiry.slice(0, 7) })))
    .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
}

export interface ConsumptionRow { item: string; code?: string | undefined; unit: string; consumed: number; lost: number; balance: number; validBalance: number; minimum: number; suggestion: number }
/**
 * Consumo do mês (AAAA-MM): dispensações + quebras. Perdas por vencimento aparecem à parte.
 * Sugestão de pedido = consumo × (1 + margem) + mínimo − saldo válido (lotes não vencidos), nunca negativa.
 */
export function monthlyConsumption(stock: StockMedication[], movements: Movement[], month: string, today: Date, margin = 0.2): ConsumptionRow[] {
  const inMonth = movements.filter((m) => m.at.slice(0, 7) === month);
  return stock.map((i) => {
    const mine = inMonth.filter((m) => (m.code && i.code ? m.code === i.code : m.item === i.name));
    const consumed = mine.filter((m) => m.kind === "consumo" || m.kind === "quebra").reduce((s, m) => s + m.qty, 0);
    const lost = mine.filter((m) => m.kind === "vencimento").reduce((s, m) => s + m.qty, 0);
    const validBalance = (i.lots ?? []).filter((l) => l.quantity > 0 && expiryStatus(l.expiry, today) !== "vencido").reduce((s, l) => s + l.quantity, 0) || ((i.lots ?? []).length ? 0 : i.quantity);
    const suggestion = Math.max(0, Math.ceil(consumed * (1 + margin) + i.minimum - validBalance));
    return { item: i.name, code: i.code, unit: i.unit, consumed, lost, balance: i.quantity, validBalance, minimum: i.minimum, suggestion };
  });
}
