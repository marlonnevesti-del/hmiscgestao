import { beforeEach, describe, expect, it } from "vitest";
import { finishEncounter, getState, saveSimplePrescription, setState } from "./hospital-store";
import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";

const pat = (): Patient => ({
  id: "p-out-1", prontuario: "PR-2026-000999", name: "Lucas Teste", cpf: "111.222.333-44",
  type: "pediatria", age: "6 anos", weight: 22, allergies: [], risks: [],
  ward: "PSP", bed: "PSP-01", insurance: "SUS", authorized: true,
  diagnosis: "Febre", admission: "27/11/2026", days: 1, evolutions: [], vitals: [], prescriptions: [],
});

const enc = (): Encounter => ({
  id: "e-out-1", number: "BAA-2026-000999", patientId: "p-out-1",
  status_fluxo: "EM_ATENDIMENTO_MEDICO", openedAt: "2026-11-27T12:00:00.000Z",
  type: "Pronto socorro", specialty: "Pediatria", complaint: "Febre",
  sigtapCode: "0301060096", history: [],
});

beforeEach(() => {
  setState(() => ({ profile: "Médico", patients: [pat()], encounters: [enc()], surgeries: [] }));
});

describe("Desfechos de Evasão e Transferência + Receita Simples", () => {
  it("registra evasão, encerra atendimento, libera leito e alimenta indicador do PS", () => {
    expect(() => finishEncounter("e-out-1", "evasao", { summary: "", recipe: "", exam: "" })).toThrow("evasão");
    finishEncounter("e-out-1", "evasao", { summary: "Paciente evadiu da sala de observação", recipe: "", exam: "" });
    const s = getState();
    const e = s.encounters[0] as Encounter & { ps?: { evasion?: { note: string } } };
    expect(e.status_fluxo).toBe("ALTA_HOSPITALAR");
    expect(e.discharge?.kind).toBe("evasao");
    expect(e.ps?.evasion?.note).toContain("evadiu");
    expect(s.patients[0]?.bed).toBe("");
  });

  it("registra alta para transferência exigindo destino e resumo", () => {
    expect(() => finishEncounter("e-out-1", "transferencia", { destination: "", summary: "Instável", recipe: "", exam: "" })).toThrow("destino");
    finishEncounter("e-out-1", "transferencia", { destination: "Hospital São José", summary: "Transferido para cirurgia pediátrica", recipe: "Manter acesso venoso", exam: "" });
    const s = getState();
    expect(s.encounters[0]?.status_fluxo).toBe("ALTA_HOSPITALAR");
    expect(s.encounters[0]?.discharge?.kind).toBe("transferencia");
    expect(s.encounters[0]?.discharge?.destination).toBe("Hospital São José");
    expect(s.patients[0]?.bed).toBe("");
  });

  it("salva receita simples no prontuário e exige ao menos um medicamento", () => {
    expect(() => saveSimplePrescription("p-out-1", { items: [{ drug: " ", qty: "", dose: "" }], doctor: "Dr. João", council: "CRM/SC 1234" })).toThrow("medicamento");
    const saved = saveSimplePrescription("p-out-1", {
      items: [{ drug: "Dipirona 500 mg/mL", qty: "1 frasco", dose: "20 gotas VO 6/6h se febre" }],
      notes: "Retornar se persistir febre > 48h",
      doctor: "Dr. João",
      council: "CRM/SC 1234",
      encounterNumber: "BAA-2026-000999",
    });
    expect(saved.items).toHaveLength(1);
    expect(getState().patients[0]?.simplePrescriptions?.[0]?.doctor).toBe("Dr. João");
  });
});