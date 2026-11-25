import { describe, expect, it } from "vitest";
import { canApproveInventory } from "./hospital-data";
import { buildInventoryAdjustments, computeInventorySummary, findItemByBarcodeOrCode } from "./inventory";
import { approveInventoryCorrection, getState, saveInventoryCount, setState } from "./hospital-store";

describe("Inventário – permissões e apuração", () => {
  it("permite homologação apenas para Administrador ou colaborador com área de coordenação do setor", () => {
    expect(canApproveInventory("Administrador", "farmacia", null)).toBe(true);
    expect(canApproveInventory("Administrador", "almoxarifado", [])).toBe(true);
    expect(canApproveInventory("Farmacêutico", "farmacia", ["farmacia"])).toBe(false);
    expect(canApproveInventory("Farmacêutico", "farmacia", ["farmacia", "inventario:farmacia"])).toBe(true);
    expect(canApproveInventory("Farmacêutico", "almoxarifado", ["farmacia", "inventario:farmacia"])).toBe(false);
    expect(canApproveInventory("Administrativo", "almoxarifado", ["almoxarifado", "inventario:almoxarifado"])).toBe(true);
  });

  it("calcula resumo, divergências e localiza item por código de barras ou código interno", () => {
    const items = [
      { id: "a", code: "1001", name: "Dipirona 500mg", presentation: "cx", unit: "cp", quantity: 10, minimum: 2, unitCost: 2.5, barcodes: ["789000111"] },
      { id: "b", code: "1002", name: "Soro Fisiológico", presentation: "fr", unit: "fr", quantity: 5, minimum: 1, unitCost: 4.0 },
    ];
    expect(findItemByBarcodeOrCode(items, "789000111")?.id).toBe("a");
    expect(findItemByBarcodeOrCode(items, "1002")?.id).toBe("b");
    const lines = {
      a: { itemId: "a", name: "Dipirona 500mg", unit: "cp", systemQty: 10, countedQty: 8, countedBy: "Ana", countedAt: "25/11" },
      b: { itemId: "b", name: "Soro Fisiológico", unit: "fr", systemQty: 5, countedQty: 5, countedBy: "Ana", countedAt: "25/11" },
    };
    const summary = computeInventorySummary(items, lines);
    expect(summary.countedItems).toBe(2);
    expect(summary.divergentItems).toBe(1);
    expect(summary.shortageItems).toBe(1);
    expect(summary.conformityRate).toBe(50);
    expect(summary.financialImpact).toBe(-5);
    expect(buildInventoryAdjustments(items, lines)).toHaveLength(1);
  });

  it("bloqueia efetivação sem permissão de coordenador e aplica correção com auditoria quando autorizado", () => {
    const item = getState().stock[0]!;
    const originalQty = item.quantity;
    setState(() => ({ profile: "Farmacêutico", employeeName: "Carla", accessAreas: ["farmacia"], inventories: [] }));
    saveInventoryCount("farmacia", item.id, originalQty + 3);
    expect(() => approveInventoryCorrection("farmacia", "Conferência mensal")).toThrow(/coordenador/i);

    setState(() => ({ profile: "Farmacêutico", employeeName: "Dr. Marcos", accessAreas: ["farmacia", "inventario:farmacia"] }));
    expect(() => approveInventoryCorrection("farmacia", "   ")).toThrow(/justificativa/i);
    const adjusted = approveInventoryCorrection("farmacia", "Conferência física de prateleira");
    expect(adjusted).toBe(1);
    expect(getState().stock.find((x) => x.id === item.id)?.quantity).toBe(originalQty + 3);
    const mv = getState().movements[0]!;
    expect(mv.kind).toBe("inventario");
    expect(mv.reason).toContain("Carla");
    expect(mv.reason).toContain("Dr. Marcos");
    expect(mv.reason).toContain("Conferência física de prateleira");
  });
});