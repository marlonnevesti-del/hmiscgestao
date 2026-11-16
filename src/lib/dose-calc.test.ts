import { describe, expect, it } from "vitest";
import { computeDose } from "./dose-calc";
describe("calculadora de dose", () => {
  it("paracetamol 12 kg em gotas 200 mg/mL: 180 mg = 18 gotas", () => expect(computeDose({ weightKg: 12, mgKgDay: 60, doses: 4, maxDay: 4000, mgPerMl: 200, dropsPerMl: 20 })).toMatchObject({ perDose: 180, ml: 0.9, drops: 18 }));
  it("amoxicilina dose alta 90 mg/kg/dia 2x em 250 mg/5 mL", () => expect(computeDose({ weightKg: 10, mgKgDay: 90, doses: 2, maxDay: 4000, mgPerMl: 50 })).toMatchObject({ perDose: 450, ml: 9 }));
  it("respeita a dose máxima diária", () => expect(computeDose({ weightKg: 50, mgKgDay: 100, doses: 4, maxDay: 4000 })).toMatchObject({ day: 4000, perDose: 1000, capped: true }));
  it("dose manual substitui o cálculo", () => expect(computeDose({ weightKg: 12, mgKgDay: 60, doses: 4, maxDay: 4000, mgPerMl: 200, dropsPerMl: 20, perDoseOverride: 150 })).toMatchObject({ perDose: 150, day: 600, drops: 15, manual: true, capped: false }));
});
