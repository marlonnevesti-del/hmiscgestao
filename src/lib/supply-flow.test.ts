import { describe, expect, it } from "vitest";
import { changeQty, transferItem } from "./supply-flow";
const item = (id: string, q: number) => ({ id, code: "6495", name: "AGULHA", presentation: "", unit: "UN", quantity: q, minimum: 0, lots: [{ lot: "L1", expiry: "", quantity: q }] });
describe("movimentação de estoque", () => {
  it("transferência abate na origem e soma no destino", () => {
    const r = transferItem([item("a", 10)], [], "a", 4, "L1", "farm");
    expect(r.src[0]?.quantity).toBe(6);
    expect(r.dst[0]?.quantity).toBe(4);
    expect(r.dst[0]?.lots?.[0]).toMatchObject({ lot: "L1", quantity: 4 });
  });
  it("transferência exige lote", () => expect(() => transferItem([item("a", 10)], [], "a", 1, "", "f")).toThrow("lote"));
  it("não permite saldo negativo", () => expect(() => changeQty([item("a", 2)], "a", -3, "L1")).toThrow("insuficiente"));
  it("devolução soma ao lote", () => expect(changeQty([item("a", 2)], "a", 3, "L1")[0]?.lots?.[0]?.quantity).toBe(5));
});

import { lotsByExpiry } from "./pharmacy-stock";
describe("lotes por validade", () => {
  it("ordena do vencimento mais próximo e oculta lotes zerados", () => {
    const r = lotsByExpiry({ lots: [{ lot: "B", expiry: "2028-02-29", quantity: 30 }, { lot: "Z", expiry: "2026-12-01", quantity: 0 }, { lot: "A", expiry: "2027-04-30", quantity: 8 }] });
    expect(r.map((l) => l.lot)).toEqual(["A", "B"]);
  });
});

import { changeQty as cq } from "./supply-flow";
describe("entrada de lote novo", () => {
  it("cria lote com validade e soma ao saldo", () => {
    const r = cq([{ id: "a", name: "X", unit: "UN", quantity: 5, minimum: 0, lots: [{ lot: "L1", expiry: "2027-01-01", quantity: 5 }] } as never], "a", 10, "L2", "2028-05-01");
    expect(r[0]!.quantity).toBe(15);
    expect(r[0]!.lots).toContainEqual({ lot: "L2", expiry: "2028-05-01", quantity: 10 });
  });
});
