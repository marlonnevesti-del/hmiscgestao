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

import { catalogToStock, mergeCatalog } from "./pharmacy-stock";
import CATALOG from "./stock-catalog.json";
import { canAccessPage } from "./hospital-data";
describe("importação de saldos", () => {
  it("separa almoxarifado e farmácia conforme o relatório", () => {
    expect(CATALOG.almox.every((r) => r.location === "Almoxarifado Geral")).toBe(true);
    expect(CATALOG.farm.some((r) => r.location === "Almoxarifado Geral")).toBe(false);
    expect(CATALOG.almox.find((r) => r.code === "7426")?.quantity).toBe(30);
  });
  it("não sobrescreve saldos já movimentados", () => {
    const cat = catalogToStock([{ code: "1", name: "X", unit: "AMP", quantity: 10, unitCost: 1, antibiotic: false, location: "Farmacia Central", lots: [] }], "farm");
    const moved = [{ ...cat[0]!, quantity: 3 }];
    expect(mergeCatalog(moved, cat)[0]!.quantity).toBe(3);
    expect(mergeCatalog([], cat)).toHaveLength(1);
  });
  it("almoxarifado liberado a farmacêutico e administrativo, não à recepção", () => {
    expect(canAccessPage("Farmacêutico", "/almoxarifado")).toBe(true);
    expect(canAccessPage("Administrativo", "/almoxarifado")).toBe(true);
    expect(canAccessPage("Recepção", "/almoxarifado")).toBe(false);
  });
});
