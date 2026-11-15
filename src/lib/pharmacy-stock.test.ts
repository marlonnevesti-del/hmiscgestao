import { describe, expect, it } from "vitest";
import { findStockMedication, isStockLow, normalizeStock } from "./pharmacy-stock";

describe("estoque da farmácia", () => {
  it("alerta quando o saldo atinge o mínimo", () => {
    expect(isStockLow({ quantity: 10, minimum: 10 })).toBe(true);
    expect(isStockLow({ quantity: 11, minimum: 10 })).toBe(false);
  });

  it("preserva os saldos do estoque antigo", () => {
    expect(normalizeStock({ Paracetamol: 12, Dipirona: 4 }).map((item) => [item.name, item.quantity])).toEqual([["Paracetamol", 12], ["Dipirona", 4]]);
  });

  it("localiza o medicamento sem confundir a dose prescrita com seu nome", () => {
    const stock = normalizeStock([{ id: "1", name: "Paracetamol 500 mg", presentation: "Comprimido", unit: "comp", quantity: 20, minimum: 5 }]);
    expect(findStockMedication(stock, "Paracetamol 180 mg (60 mg/kg/dia)")?.id).toBe("1");
  });
});
