import { beforeEach, expect, it } from "vitest";
import type { Patient } from "./hospital-data";
import { getState, openEncounter, savePatientRegistration, setState } from "./hospital-store";
import { patientsByCpf, registrationFor } from "./patient-registration-mapping";

const patient: Patient = { id: "registration-test", prontuario: "PR-1", name: "Civil", cpf: "—", type: "pediatria", age: "8", weight: 25, allergies: ["Dipirona"], risks: [], motherName: "Mãe", guardian: "Responsável", insurance: "SUS", authorized: true, diagnosis: "Em avaliação", ward: "PSP", bed: "", admission: "", days: 1, evolutions: [], vitals: [], prescriptions: [{ id: "rx", cat: "Cuidados", item: "Repouso", posologia: "" }] };
beforeEach(() => setState(() => ({ profile: "Recepção", employeeName: "Recepcionista", patients: [], encounters: [], queue: [], beSequence: 0 })));
it("recupera por CPF completo formatado os dados já cadastrados sem alterar o prontuário", () => {
  const saved: Patient = { ...patient, cpf: "12345678901", registration: { ...registrationFor(patient), cpf: "12345678901", birthDate: "2018-01-01", cns: "700000000000005", phones: [{ primary: true, type: "Celular", areaCode: "48", number: "999999999", complement: "" }] } };
  const found = patientsByCpf([saved], "123.456.789-01")[0];
  expect(found).toBe(saved);
  expect(registrationFor(found)).toMatchObject({ civilName: "Civil", birthDate: "2018-01-01", parent1: "Mãe", cns: "700000000000005", phones: [{ areaCode: "48", number: "999999999" }] });
  expect(saved.prescriptions).toEqual(patient.prescriptions);
});
it("não identifica CPF incompleto ou ausente na base", () => {
  expect(patientsByCpf([{ ...patient, cpf: "12345678901" }], "123456")).toEqual([]);
  expect(patientsByCpf([{ ...patient, cpf: "12345678901" }], "98765432100")).toEqual([]);
});
it("expõe todos os cadastros duplicados para impedir escolha automática", () => {
  const saved = { ...patient, cpf: "12345678901" };
  expect(patientsByCpf([saved, { ...saved, id: "other" }], "12345678901")).toHaveLength(2);
});
it("prioriza o CPF atualizado do cadastro estruturado sobre o legado", () => {
  const saved = { ...patient, cpf: "12345678901", registration: { ...registrationFor(patient), cpf: "98765432100" } };
  expect(patientsByCpf([saved], "12345678901")).toEqual([]);
  expect(patientsByCpf([saved], "98765432100")).toEqual([saved]);
});
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