import type { Encounter } from "./care-flow";
import { WARDS, type Patient } from "./hospital-data";
import { isImmediatePrescription } from "./pharmacy-schedule";

export type PharmacySectorId =
  | "todos"
  | "imediatas"
  | "ps"
  | "maternidade"
  | "uti"
  | "internacao"
  | "ambulatorio";

export type PrimaryPharmacySector = Exclude<PharmacySectorId, "todos" | "imediatas">;

export const PHARMACY_SECTORS: { id: PharmacySectorId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "imediatas", label: "Doses imediatas" },
  { id: "ps", label: "Pronto-Socorro" },
  { id: "maternidade", label: "Maternidade / CO" },
  { id: "uti", label: "UTI / UCI" },
  { id: "internacao", label: "Internação / Enfermarias" },
  { id: "ambulatorio", label: "Ambulatório" },
];

const SECTOR_NAMES: Record<PrimaryPharmacySector, string> = {
  ps: "Pronto-Socorro",
  maternidade: "Maternidade / CO",
  uti: "UTI / UCI",
  internacao: "Internação / Enfermarias",
  ambulatorio: "Ambulatório",
};

export function resolvePharmacySector(encounter: Encounter, patient: Patient): PrimaryPharmacySector {
  const fiaWard = (encounter.fia?.ward ?? "").toUpperCase();
  if (patient.ward === "UTIN" || patient.ward === "UTIP" || patient.ward === "UCI" || /\b(UTI|UCI)\b/.test(fiaWard)) {
    return "uti";
  }
  if (patient.ward === "CO" || patient.ward === "AC") return "maternidade";
  if (patient.ward === "ENFP") return "internacao";
  if (encounter.type === "Ambulatório" && !encounter.fia && !patient.bed) return "ambulatorio";
  if (encounter.type === "Maternidade") return "maternidade";
  if (encounter.type === "Pronto socorro" || patient.ward === "PSO" || patient.ward === "PSP") return "ps";
  return patient.bed || encounter.fia ? "internacao" : "ps";
}

export function pharmacySectorLabel(encounter: Encounter, patient: Patient): string {
  const sector = resolvePharmacySector(encounter, patient);
  const base = SECTOR_NAMES[sector];
  if (sector === "ambulatorio") return base;
  const wardName = WARDS.find((w) => w.id === patient.ward)?.name;
  return wardName ? `${base} · ${wardName}` : base;
}

export function hasImmediateBatchDose(encounter: Encounter, patient: Patient): boolean {
  return patient.prescriptions.some(
    (rx) => rx.pharmacy && rx.batchId === encounter.prescriptionBatchId && isImmediatePrescription(rx),
  );
}

export function matchesPharmacySector(sector: PharmacySectorId, encounter: Encounter, patient: Patient): boolean {
  if (sector === "todos") return true;
  if (sector === "imediatas") return hasImmediateBatchDose(encounter, patient);
  return resolvePharmacySector(encounter, patient) === sector;
}