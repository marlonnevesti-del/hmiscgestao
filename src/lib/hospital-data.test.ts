import { describe, it, expect } from "vitest";
import { doseByWeight, PATIENTS } from "./hospital-data";
describe("dose por peso", () => {
  it("calcula mg/kg × peso", () => expect(doseByWeight(15, 8.2)).toBe(123));
  it("limita à dose máxima", () => expect(doseByWeight(15, 50, 500)).toBe(500));
});
it("tem 8 pacientes de demonstração", () => expect(PATIENTS).toHaveLength(8));
