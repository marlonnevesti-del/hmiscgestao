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
    expect(resolvePharmacySector(mkEncounter({ type: "Maternidade" }), mkPatient({ ward: "CO" }))).toBe("co");
    expect(resolvePharmacySector(mkEncounter({ type: "Maternidade" }), mkPatient({ ward: "AC" }))).toBe("maternidade");
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "UTIN", bed: "UTIN-01" }))).toBe("uti-neo");
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "UTIP", bed: "UTIP-01" }))).toBe("uti-ped");
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "UCI", bed: "UCI-01" }))).toBe("uci");
    expect(resolvePharmacySector(mkEncounter(), mkPatient({ ward: "ENFP", bed: "ENFP-02" }))).toBe("pediatria");
    const fiaBase = { openedAt: "2026-11-25T10:00:00Z", doctor: "Dr. Teste", authorizedBy: "NIR", cid: "K35", justification: "Cirurgia", character: "Urgência" as const };
    expect(resolvePharmacySector(mkEncounter({ fia: { ...fiaBase, number: "FIA-1", ward: "Clínica Cirúrgica", bed: "CCIR-01" } }), mkPatient({ ward: "ENFP", bed: "CCIR-01" }))).toBe("clinica-cirurgica");
    expect(resolvePharmacySector(mkEncounter({ fia: { ...fiaBase, number: "FIA-2", ward: "Centro Cirúrgico", bed: "CC-01" } }), mkPatient({ ward: "ENFP", bed: "CC-01" }))).toBe("cc");
    expect(resolvePharmacySector(mkEncounter({ fia: { ...fiaBase, number: "FIA-3", ward: "RPA", bed: "RPA-01" } }), mkPatient({ ward: "ENFP", bed: "RPA-01" }))).toBe("rpa");
  });

  it("identifica doses imediatas na pasta dedicada", () => {
    const p = mkPatient({
      prescriptions: [{ id: "rx1", cat: "Medicamento", item: "Dipirona", posologia: "EV · Agora", frequency: "Agora", immediate: true, pharmacy: "Pendente", batchId: "b1", times: ["Agora"] }],
    });
    const e = mkEncounter();
    expect(hasImmediateBatchDose(e, p)).toBe(true);
    expect(matchesPharmacySector("imediatas", e, p)).toBe(true);
    expect(matchesPharmacySector("ps", e, p)).toBe(true);
    expect(matchesPharmacySector("uti-ped", e, p)).toBe(false);
  });

  it("formata rótulo do setor para etiqueta e requisição", () => {
    expect(pharmacySectorLabel(mkEncounter(), mkPatient({ ward: "UTIP" }))).toBe("Uti Ped");
    expect(pharmacySectorLabel(mkEncounter(), mkPatient({ ward: "UTIN" }))).toBe("Uti Neo");
  });
});