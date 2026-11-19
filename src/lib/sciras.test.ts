import { describe, it, expect } from "vitest";
import { atbMissing, isRestricted, isAntimicrobial, newAtb, atbBlocksPharmacy, readmittedWithin6Months } from "./sciras";
const ok = { weight: 70, vitals: "PA 120/80", dose: "1 g", interval: "8/8h", focus: "Pulmonar", days: 7, justification: "Pneumonia hospitalar grave" };
describe("sciras", () => {
  it("meropenem is restricted and starts waiting for SCIRAS", () => { expect(isRestricted("Meropenem 1 g")).toBe(true); expect(newAtb("Meropenem 1 g", ok, "Dr").status).toBe("Aguardando SCIRAS"); });
  it("ceftriaxona is antimicrobial but free", () => { expect(isAntimicrobial("Ceftriaxona 1 g")).toBe(true); expect(newAtb("Ceftriaxona", ok, "Dr").status).toBe("Livre"); });
  it("requires weight, vitals, dose, interval and justification", () => { expect(atbMissing({ ...ok, weight: 0, vitals: "", dose: "", interval: "", justification: "" })).toEqual(["Peso atualizado", "Sinais vitais", "Dose", "Intervalo", "Justificativa (mín. 10 caracteres)"]); expect(atbMissing(ok)).toEqual([]); });
  it("pharmacy blocked while waiting or denied", () => { const a = newAtb("Vancomicina", ok, "Dr"); expect(atbBlocksPharmacy({ id: "1", cat: "Medicamento", item: "Vancomicina", posologia: "", atb: a })).toBe(true); expect(atbBlocksPharmacy({ id: "1", cat: "Medicamento", item: "Vancomicina", posologia: "", atb: { ...a, status: "Autorizado" } })).toBe(false); });
  it("readmission under 6 months", () => { expect(readmittedWithin6Months(["2026-01-01", "2026-06-01"])).toBe(true); expect(readmittedWithin6Months(["2025-01-01", "2026-06-01"])).toBe(false); });
});
