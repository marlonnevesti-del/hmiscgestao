import { beforeEach, describe, expect, it } from "vitest";
import { getState, registerBirth, setState } from "./hospital-store";
import type { Patient } from "./hospital-data";

const mother = (): Patient => ({
  id: "m1", prontuario: "PR-2026-000001", name: "Maria da Silva", cpf: "12345678900",
  type: "gestante", age: "28", weight: 70, allergies: [], risks: [],
  ward: "PSO", bed: "PSO-01", insurance: "SUS", authorized: true,
  diagnosis: "Trabalho de parto", admission: "19/11/2026 08:00", days: 1,
  evolutions: [], vitals: [], prescriptions: [],
});

const birth = (over: Partial<Pick<Patient["newborn"] & object, "apgar5" | "pesoNascer">> = {}) =>
  registerBirth("m1", { apgar1: 9, apgar5: 9, pesoNascer: 3250, comprimento: 49, pc: 34, tipagem: "O+", coracaozinho: "Pendente", olhinho: "Pendente", vacinas: [], ...over }, "Cesárea", "F");

beforeEach(() => setState(() => ({ profile: "Administrador", employeeName: "Teste", patients: [mother()] })));

describe("cadastro do recém-nascido no parto", () => {
  it("cria prontuário do RN vinculado à mãe, que vira puérpera no Alojamento Conjunto", () => {
    const id = birth();
    const rn = getState().patients.find((p) => p.id === id);
    const m = getState().patients.find((p) => p.id === "m1");
    expect(rn).toMatchObject({ type: "neonato", motherName: "Maria da Silva", name: "RN de Maria da Silva", ward: "AC" });
    expect(rn?.newborn?.motherId).toBe("m1");
    expect(m).toMatchObject({ type: "puerpera", ward: "AC", diagnosis: "Puerpério imediato – Cesárea" });
    expect(m?.babyIds).toEqual([id]);
  });

  it("registra o nascimento com a data de hoje, não uma data fixa", () => {
    const id = birth();
    const rn = getState().patients.find((p) => p.id === id);
    const today = new Date().toLocaleDateString("pt-BR");
    expect(rn?.admission).toContain(today);
    expect(rn?.evolutions[0]?.time).toContain(today);
    const m = getState().patients.find((p) => p.id === "m1");
    expect(m?.evolutions[0]?.time).toContain(today);
  });

  it("envia para a UTI Neonatal o RN com Apgar 5º baixo ou peso menor que 2000 g", () => {
    const baixoApgar = birth({ apgar5: 5 });
    expect(getState().patients.find((p) => p.id === baixoApgar)?.ward).toBe("UTIN");
    setState(() => ({ patients: [mother()] }));
    const baixoPeso = birth({ pesoNascer: 1800 });
    expect(getState().patients.find((p) => p.id === baixoPeso)?.ward).toBe("UTIN");
    setState(() => ({ patients: [mother()] }));
    const saudavel = birth();
    expect(getState().patients.find((p) => p.id === saudavel)?.ward).toBe("AC");
  });
});
