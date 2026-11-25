import { describe, expect, it } from "vitest";
import { completeTriage, getState, openEncounter, setState } from "./hospital-store";
import { DEFAULT_TRIAGE_SIGTAP } from "./medical-sigtap";
import { bpaFile, buildSusRows } from "./sus-billing";
import type { Encounter, Triage } from "./care-flow";
import type { Patient } from "./hospital-data";

const triagePayload: Triage = {
  risk: "verde", weight: 18,
  vital: { time: "10:00", pas: 110, pad: 70, fc: 88, fr: 18, tax: 36.5, sat: 98, dor: 2, ingesta: 0, diurese: 0, vomitos: 0 },
  complaint: "Febre baixa", allergies: [], ig: "", dum: "", bcf: "", contractions: "", fluid: "Não", bleeding: "Ausente", height: "105", head: "", guardian: "Maria Silva",
};

describe("triagem com SIGTAP automático (0301060118)", () => {
  it("grava automaticamente 0301060118 ao concluir a triagem", () => {
    setState(() => ({ profile: "Administrador", employeeName: "Enf. Ana", accessAreas: null, patients: [], encounters: [], queue: [], surgeries: [], beSequence: 0 }));
    const p = { id: "p-tri-1", name: "Lucas Teste", age: "5 anos", type: "pediatria", risk: "verde", bed: "", weight: 18, allergies: [], risks: [], vitals: [], prescriptions: [], evolutions: [], exams: [] } as unknown as Patient;
    const enc = openEncounter(p, "Pronto socorro", "Pediatria", "Febre baixa");
    completeTriage(enc.id, triagePayload);
    const saved = getState().encounters.find((e) => e.id === enc.id);
    expect(saved?.triage?.sigtapCode).toBe(DEFAULT_TRIAGE_SIGTAP);
  });

  it("gera linha BPA de triagem (0301060118) junto com a consulta e exporta no arquivo BPA-I", () => {
    const p = {
      id: "p-tri-2", name: "Clara Souza", age: "6 anos", type: "pediatria", risk: "verde", bed: "", weight: 20, allergies: [], risks: [], vitals: [], prescriptions: [], evolutions: [], exams: [],
      registration: { civilName: "Clara Souza", cns: "700000000000001", cpf: "12345678901", birthDate: "2020-05-10", sex: "F", parent1: "Ana Souza", addresses: [{ primary: true, cityCode: "4204608" }] },
    } as unknown as Patient;
    const enc: Encounter = {
      id: "e-tri-2", number: "BAA-2026-0099", patientId: p.id, status_fluxo: "ALTA_HOSPITALAR", openedAt: "2026-11-25T10:00:00.000Z",
      type: "Pronto socorro", specialty: "Pediatria", complaint: "Tosse", history: [], sigtapCode: "0301010072",
      triage: { ...triagePayload, sigtapCode: DEFAULT_TRIAGE_SIGTAP },
      medical: { anamnesis: "Tosse há 2 dias", exam: "Bom estado geral", cid: "J069", diagnosis: "IVAS" },
    };
    const prof = { name: "Enf. Ana", cns: "700000000000009", cbo: "223505" };
    const rows = buildSusRows([enc], [p], "202611", prof);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.procedure)).toEqual(["0301010072", "0301060118"]);
    expect(rows[1]?.origin).toBe("triage");

    const file = bpaFile(rows, "202611", prof);
    expect(file).toContain("0301010072");
    expect(file).toContain("0301060118");
  });
});