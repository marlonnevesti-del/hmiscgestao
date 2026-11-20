import { describe, expect, it } from "vitest";
import { EMPTY_MILK_BANK, autonomyDays, batchApproved, caloricClass, kcalFromCrematocrit, milkReport, rawStock, type MilkBank } from "./milk-bank";

const now = new Date("2026-11-20T12:00:00Z");
describe("banco de leite", () => {
  it("leite cru vence após 15 dias da coleta", () => {
    const m: MilkBank = { ...EMPTY_MILK_BANK, raw: [
      { id: "a", code: "C1", donorId: "d", collectedAt: "2026-11-10T08:00:00Z", volume: 100, status: "Estoque" },
      { id: "b", code: "C2", donorId: "d", collectedAt: "2026-11-01T08:00:00Z", volume: 200, status: "Estoque" },
    ] };
    expect(rawStock(m, now).map((b) => b.id)).toEqual(["a"]);
  });
  it("lote só é aprovado com Dornic até 8 e microbiologia negativa", () => {
    expect(batchApproved(8, true)).toBe(true);
    expect(batchApproved(9, true)).toBe(false);
    expect(batchApproved(4, false)).toBe(false);
  });
  it("classifica teor calórico pelo crematócrito", () => {
    expect(kcalFromCrematocrit(5)).toBe(624);
    expect(caloricClass(480)).toBe("Hipocalórico");
    expect(caloricClass(624)).toBe("Normocalórico");
    expect(caloricClass(750)).toBe("Hipercalórico");
  });
  it("autonomia = estoque pasteurizado / consumo prescrito do dia", () => {
    const m: MilkBank = { ...EMPTY_MILK_BANK,
      batches: [{ id: "l", code: "P1", scheduledAt: "", bottleIds: [], volume: 1000, remaining: 600, status: "Aprovado" }],
      recipients: [{ patientId: "p", mlPerFeed: 25, feedsPerDay: 8, since: "", active: true }] };
    expect(autonomyDays(m, now)).toBe(3);
  });
  it("relatório mensal soma litros recebidos e pasteurizados", () => {
    const m: MilkBank = { ...EMPTY_MILK_BANK,
      raw: [{ id: "a", code: "C1", donorId: "d", collectedAt: "2026-11-05T08:00:00Z", volume: 1500, status: "Pasteurizado" }],
      batches: [{ id: "l", code: "P1", scheduledAt: "", bottleIds: ["a"], volume: 1500, remaining: 1500, status: "Aprovado", doneAt: "2026-11-06T10:00:00Z", crematocrit: 5 }] };
    const r = milkReport(m, "2026-11");
    expect(r.litrosRecebidos).toBe(1.5); expect(r.litrosPasteurizados).toBe(1.5); expect(r.crematocritos).toBe(1);
  });
});
