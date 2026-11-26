import type { Patient } from "./hospital-data";
import { emptyRegistration, patientAge, presentationName, registrationSchema, type PatientRegistration } from "./patient-registration";

/** Only an exact, unique CPF may identify a patient automatically. */
export function patientsByCpf(patients: readonly Patient[], input: string): Patient[] {
  const cpf = input.replace(/\D/g, "");
  if (cpf.length !== 11) return [];
  return patients.filter((patient) => (patient.registration?.cpf || patient.cpf).replace(/\D/g, "") === cpf);
}

export function registrationFor(patient?: Patient): PatientRegistration {
  if (patient?.registration) return { ...emptyRegistration(), ...patient.registration };
  return { ...emptyRegistration(), civilName: patient?.name ?? "", cpf: patient?.cpf === "—" ? "" : patient?.cpf ?? "", parent1: patient?.motherName ?? "", guardian: patient?.guardian ?? "", insurance: patient?.insurance ?? "SUS", weight: patient?.weight ? String(patient.weight) : "", height: patient?.height ? String(patient.height) : "", ageYears: patient?.age.match(/^\d+$/)?.[0] ?? "", estimatedAge: !!patient?.age.match(/^\d+$/) };
}
export function registrationPatch(input: PatientRegistration, employee: string, patient?: Patient): Partial<Patient> {
  const data = registrationSchema.parse(input);
  const at = new Date().toISOString();
  return {
    registration: { ...data, createdBy: patient?.registration?.createdBy || employee, createdAt: patient?.registration?.createdAt || at, updatedBy: employee, updatedAt: at },
    name: presentationName(data), cpf: data.cpf || "—", motherName: data.parent1, guardian: data.guardian,
    age: data.birthDate || data.ageYears || data.ageMonths || data.ageDays ? patientAge(data) : patient?.age ?? "—",
    insurance: data.insurance || "SUS", weight: data.weight ? Number(data.weight) : patient?.weight ?? 0,
    ...(data.height ? { height: Number(data.height) } : {}),
  };
}