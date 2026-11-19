import { describe, it, expect } from "vitest";
import { SURGICAL_KITS, searchKits, kitGroup } from "./surgical-kits";
describe("surgical kits", () => {
  it("loads the official catalog", () => { expect(SURGICAL_KITS.length).toBe(66); });
  it("finds a kit by barcode", () => { expect(searchKits("14073")[0]?.name).toBe("KIT APENDICECTOMIA ABERTA"); });
  it("groups cesarean as obstetrics", () => { expect(kitGroup("KIT CESÁREA / GINECOLOGIA GERAL")).toBe("Ginecologia e Obstetrícia"); });
});
