import { describe, expect, it } from "vitest";
import { buildOsReport } from "./os-report";
import type { Movement } from "./supply-flow";

const mv = (o: Partial<Movement>): Movement => ({ id: "1", kind: "consumo", from: "Farmácia", to: "Ana", item: "Dipirona", qty: 2, lot: "", reason: "", at: "2026-11-10T10:00:00Z", by: "x", ...o });
const items = [{ id: "a", name: "Dipirona", presentation: "", unit: "amp", quantity: 10, minimum: 0, unitCost: 1.5 }];
const base = { encounters: [], patients: [], surgeries: [], items };

describe("relatório de gastos da OS", () => {
  it("valoriza consumo pelo custo unitário", () => expect(buildOsReport("202611", { ...base, movements: [mv({})] }).total).toBe(3));
  it("ignora movimentos de outra competência", () => expect(buildOsReport("202611", { ...base, movements: [mv({ at: "2026-10-10T10:00:00Z" })] }).total).toBe(0));
  it("transferência não é gasto", () => expect(buildOsReport("202611", { ...base, movements: [mv({ kind: "transferencia" })] }).total).toBe(0));
  it("vencido entra como perda por validade", () => expect(buildOsReport("202611", { ...base, movements: [mv({ kind: "vencimento" })] }).bySector[0]?.label).toBe("Perda por validade"));
});
