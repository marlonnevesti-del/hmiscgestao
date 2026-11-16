import { describe, expect, it } from "vitest";
import { ean13Check, findByBarcode, internalBarcode, isValidEan13, linkCode } from "./barcode";
import type { StockMedication } from "./pharmacy-stock";

const items: StockMedication[] = [
  { id: "a", name: "OMEPRAZOL 40MG FA EV", presentation: "", unit: "FA", quantity: 10, minimum: 0, code: "570005", lots: [{ lot: "26020695", expiry: "30/09/2027", quantity: 10 }] },
  { id: "b", name: "DIPIRONA GOTAS", presentation: "", unit: "FR", quantity: 5, minimum: 0 },
];
describe("barcode", () => {
  it("valida o código da etiqueta do Omeprazol", () => { expect(isValidEan13("2570005533264")).toBe(true); expect(ean13Check("257000553326")).toBe("4"); });
  it("gera código interno com prefixo 2", () => { expect(internalBarcode("570005", 53326)).toBe("2570005533264"); });
  it("vincula código existente ao lote e encontra ao bipar", () => {
    const linked = linkCode(items, "a", "2570005533264", "26020695");
    expect(findByBarcode(linked, "2570005533264")?.lot?.lot).toBe("26020695");
  });
  it("impede o mesmo código em dois produtos", () => {
    const linked = linkCode(items, "b", "7891234567895");
    expect(() => linkCode(linked, "a", "7891234567895")).toThrow();
  });
});
