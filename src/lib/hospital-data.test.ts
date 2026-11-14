import { describe, it, expect } from "vitest";
import { DRUGS, PATIENTS, allergyConflict, buildBill, can, doseByWeight, interactionsWith, pediatricDose } from "./hospital-data";
const drug = (n: string) => DRUGS.find((d) => d.name === n)!;
describe("dose por peso", () => {
  it("calcula mg/kg × peso", () => expect(doseByWeight(15, 8.2)).toBe(123));
  it("limita à dose máxima", () => expect(doseByWeight(15, 50, 500)).toBe(500));
  it("divide a dose diária pelo nº de tomadas", () => expect(pediatricDose(drug("Paracetamol"), 12.4)).toEqual({ day: 744, perDose: 186, capped: false }));
  it("limita prednisolona a 60 mg/dia", () => expect(pediatricDose(drug("Prednisolona"), 40).day).toBe(60));
});
describe("alertas", () => {
  it("alergia à penicilina bloqueia amoxicilina", () => expect(allergyConflict(drug("Amoxicilina"), ["Penicilina"])).toBe("Penicilina"));
  it("sem alergia relacionada", () => expect(allergyConflict(drug("Paracetamol"), ["Látex"])).toBeUndefined());
  it("detecta interação ibuprofeno + prednisolona", () => expect(interactionsWith(drug("Ibuprofeno"), [{ id: "x", cat: "Medicamento", item: "Prednisolona 20 mg", posologia: "" }])).toHaveLength(1));
});
describe("perfis", () => {
  it("só médico prescreve", () => { expect(can("Médico", "prescrever")).toBe(true); expect(can("Enfermeiro", "prescrever")).toBe(false); });
  it("só enfermeiro checa", () => { expect(can("Enfermeiro", "checar")).toBe(true); expect(can("Farmacêutico", "checar")).toBe(false); });
});
it("conta inclui diárias e medicamento checado", () => {
  const p = PATIENTS.find((x) => x.id === "p2")!;
  const b = buildBill(p, [], { [`p2|${p.prescriptions[1]!.id}|06:00`]: { status: "checado", by: "x", at: "06:00" } });
  expect(b.total).toBe(2 * 420 + 18.5);
});
it("tem 10 pacientes de demonstração", () => expect(PATIENTS).toHaveLength(10));
