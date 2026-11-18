import { describe, expect, it } from "vitest";
import { PURCHASE_GROUP_CATEGORY } from "./warehouse-categories";
import { WAREHOUSE_CATALOG } from "./hospital-store";
describe("categorias do almoxarifado", () => {
  it("agrupa os grupos de compra nas 5 categorias escolhidas", () => {
    expect(PURCHASE_GROUP_CATEGORY[7]).toBe("escritorio");
    expect(PURCHASE_GROUP_CATEGORY[2]).toBe("hospitalar");
    expect(PURCHASE_GROUP_CATEGORY[10]).toBe("alimentacao");
    expect(PURCHASE_GROUP_CATEGORY[13]).toBe("higiene");
  });
  it("todo item importado tem categoria", () => {
    expect(WAREHOUSE_CATALOG.length).toBeGreaterThan(800);
    expect(WAREHOUSE_CATALOG.every((i) => i.category)).toBe(true);
  });
});
