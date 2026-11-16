import { beforeEach, expect, it } from "vitest";
import type { Patient } from "./hospital-data";
import { getState, openEncounter, savePatientRegistration, setState } from "./hospital-store";
import { registrationFor } from "./patient-registration-mapping";

const patient: Patient = { id: "registration-test", prontuario: "PR-1", name: "Civil", cpf: "—", type: "pediatria", age: "8", weight: 25, allergies: ["Dipirona"], risks: [], motherName: "Mãe", guardian: "Responsável", insurance: "SUS", authorized: true, diagnosis: "Em avaliação", ward: "PSP", bed: "", admission: "", days: 1, evolutions: [], vitals: [], prescriptions: [{ id: "rx", cat: "Cuidados", item: "Repouso", posologia: "" }] };
beforeEach(() => setState(() => ({ profile: "Recepção", employeeName: "Recepcionista", patients: [], encounters: [], queue: [], beSequence: 0 })));
it("recupera cadastro antigo sem apagar peso, filiação e responsável", () => {
  expect(registrationFor(patient)).toMatchObject({ civilName: "Civil", weight: "25", parent1: "Mãe", guardian: "Responsável", ageYears: "8" });
});
it("salva dados gerais, contatos e legado preservando o BE e informações clínicas", () => {
  openEncounter(patient, "Pronto socorro", "Pediatria", "Avaliação");
  savePatientRegistration(patient.id, { ...registrationFor(patient), useSocialName: true, socialName: "Social", legacyRecord: "123", cns: "123456789012345" });
  expect(getState().patients[0]?.registration).toMatchObject({ civilName: "Civil", socialName: "Social", legacyRecord: "123", cns: "123456789012345", createdBy: "Recepcionista" });
  expect(getState().patients[0]?.prescriptions).toEqual(patient.prescriptions);
  expect(getState().patients[0]?.allergies).toEqual(["Dipirona"]);
  expect(getState().queue[0]?.name).toBe("Social");
  expect(getState().encounters).toHaveLength(1);
});
it("não permite médico alterar cadastro pela ação de recepção", () => {
  openEncounter(patient, "Pronto socorro", "Pediatria", "Avaliação");
  setState(() => ({ profile: "Médico" }));
  expect(() => savePatientRegistration(patient.id, registrationFor(patient))).toThrow("perfil");
});