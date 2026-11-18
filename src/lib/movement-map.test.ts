import { describe, expect, it } from "vitest";
import { filterMovements, movementSign, summarize } from "./movement-map";
import type { Movement } from "./supply-flow";
const mk = (o: Partial<Movement>): Movement => ({ id: Math.random().toString(), kind: "consumo", from: "Farmácia", to: "X", item: "Dipirona", qty: 1, lot: "L1", reason: "", at: "2026-11-18T10:00:00", by: "a", ...o });
const list = [mk({ patient: "Maria", fia: "00041/2026" }), mk({ kind: "entrada", at: "2026-11-18T08:00:00", qty: 100, to: "Farmácia" }), mk({ kind: "requisicao", item: "Seringa", costCenter: "Higienização", at: "2026-11-18T14:00:00" })];
describe("mapa de movimentação", () => {
  it("filtra por horário", () => { expect(filterMovements(list, { from: "2026-11-18T09:00", to: "2026-11-18T12:00" })).toHaveLength(1); });
  it("filtra por paciente e FIA", () => { expect(filterMovements(list, { patient: "mar" })).toHaveLength(1); expect(filterMovements(list, { fia: "00041" })).toHaveLength(1); });
  it("filtra por produto", () => { expect(filterMovements(list, { product: "seringa" })[0]?.kind).toBe("requisicao"); });
  it("transferência entra no destino e sai na origem", () => { const t = mk({ kind: "transferencia", from: "Almoxarifado", to: "Farmácia" }); expect(movementSign(t, "Farmácia")).toBe(1); expect(movementSign(t, "Almoxarifado")).toBe(-1); });
  it("sintético soma entradas e saídas", () => { expect(summarize(list.filter((m) => m.item === "Dipirona"))[0]).toMatchObject({ entradas: 100, saidas: 1 }); });
});
