import { describe, expect, it } from "vitest";
import { consumptionByPeriod, expiryStatus, monthlyConsumption } from "./controlled";
import type { StockMedication } from "./pharmacy-stock";
import type { Movement } from "./supply-flow";

const today = new Date(2026, 10, 17);
describe("validade de controlados", () => {
  it("lote com data passada é vencido", () => expect(expiryStatus("2026-11-16", today)).toBe("vencido"));
  it("vence hoje ainda não é vencido", () => expect(expiryStatus("2026-11-17", today)).toBe("critico"));
  it("até 30 dias é crítico, até 90 alerta", () => { expect(expiryStatus("2026-12-17", today)).toBe("critico"); expect(expiryStatus("2027-02-10", today)).toBe("alerta"); expect(expiryStatus("2027-06-01", today)).toBe("ok"); });
});
describe("relatório mensal de consumo", () => {
  const item: StockMedication = { id: "a", code: "7970", name: "FENTANILA", presentation: "", unit: "AMP", quantity: 30, minimum: 10, lots: [{ lot: "V", expiry: "2026-01-01", quantity: 10 }, { lot: "B", expiry: "2028-01-01", quantity: 20 }] };
  const mv = (kind: Movement["kind"], qty: number, at: string): Movement => ({ id: at + kind, kind, from: "", to: "", item: "FENTANILA", code: "7970", qty, lot: "B", reason: "", at, by: "" });
  const rows = monthlyConsumption([item], [mv("consumo", 50, "2026-11-03T10:00:00Z"), mv("consumo", 99, "2026-10-03T10:00:00Z"), mv("vencimento", 4, "2026-11-05T10:00:00Z")], "2026-11", today);
  it("soma só o consumo do mês escolhido", () => expect(rows[0]!.consumed).toBe(50));
  it("perda por validade fica separada", () => expect(rows[0]!.lost).toBe(4));
  it("sugestão = consumo +20% + mínimo − saldo válido", () => expect(rows[0]!.suggestion).toBe(50));
  it("filtra consumo por dia específico", () => {
    const mvs = [mv("consumo", 12, "2026-11-03T10:00:00Z"), mv("consumo", 30, "2026-11-04T10:00:00Z")];
    expect(consumptionByPeriod([item], mvs, "day", "2026-11-03", today)[0]!.consumed).toBe(12);
  });
  it("soma consumo do ano inteiro", () => {
    const mvs = [mv("consumo", 12, "2026-01-10T10:00:00Z"), mv("consumo", 30, "2026-11-04T10:00:00Z"), mv("consumo", 50, "2025-12-31T10:00:00Z")];
    expect(consumptionByPeriod([item], mvs, "year", "2026", today)[0]!.consumed).toBe(42);
  });
});
