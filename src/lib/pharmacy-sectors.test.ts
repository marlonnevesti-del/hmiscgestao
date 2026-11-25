import { describe, expect, it } from "vitest";
import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";
import { hasImmediateBatchDose, matchesPharmacySector, pharmacySectorLabel, resolvePharmacySector } from "./pharmacy-sectors";

const mkPatient = (over: Partial<Patient> = {}): Patient => ({
  id: "p1", prontuario: "1", name: "Paciente", cpf: "", type: "pediatria", age: "3 anos", weight: 15,
  allergies: [], risks: [], ward: "PSP", bed: "", insurance: "SUS", authorized: true,
  diagnosis: "", admission: "", days: 1, evolutions: [], vitals: [], prescriptions: [],
  ...over,
});

const mkEncounter = (over: Partial<Encounter> = {}): Encounter => ({
  id: "e1", number: "BAA-1", patientId: "p1", status_fluxo: "AGUARDANDO_FARMACIA",
  openedAt: "2026-11-25T10:00:00Z", type: "Pronto socorro", specialty: "Pediatria",
  complaint: "Febre", history: [], prescriptionBatchId: "b1",
  ...over,
});

describe("pharmacy-sectors", () => {
  it("classifica setores clínicos corretamente", () => {
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "PSP" }))).toBe("ps");
    expect(resolvePharmacySector(mkEncounter({ type: "Maternidade" }), mkPatient({ ward: "CO" }))).toBe("maternidade");
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "UTIN", bed: "UTIN-01" }))).toBe("uti");
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "ENFP", bed: "ENFP-02" }))).toBe("internacao");
    expect(resolvePharmacySector(mkEncounter({ type: "Ambulatório" }), mkPatient({ ward: "PSP", bed: "" }))).toBe("ambulatorio");
  });

  it("identifica doses imediatas na pasta dedicada", () => {
    const p = mkPatient({
      prescriptions: [{ id: "rx1", cat: "Medicamento", item: "Dipirona", posologia: "EV · Agora", frequency: "Agora", immediate: true, pharmacy: "Pendente", batchId: "b1", times: ["Agora"] }],
    });
    const e = mkEncounter();
    expect(hasImmediateBatchDose(e, p)).toBe(true);
    expect(matchesPharmacySector("imediatas", e, p)).toBe(true);
    expect(matchesPharmacySector("ps", e, p)).toBe(true);
    expect(matchesPharmacySector("uti", e, p)).toBe(false);
  });

  it("formata rótulo do setor para etiqueta e requisição", () => {
    expect(pharmacySectorLabel(mkEncounter(), mkPatient({ ward: "UTIP" }))).toBe("UTI / UCI · UTI Pediátrica");
    expect(pharmacySectorLabel(mkEncounter({ type: "Ambulatório" }), mkPatient({ ward: "PSP", bed: "" }))).toBe("Ambulatório");
  });
});