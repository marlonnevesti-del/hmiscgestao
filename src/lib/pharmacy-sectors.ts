import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";
import { isImmediatePrescription } from "./pharmacy-schedule";

export type PharmacySectorId =
  | "todos"
  | "imediatas"
  | "uti-ped"
  | "uti-neo"
  | "uci"
  | "pediatria"
  | "maternidade"
  | "clinica-cirurgica"
  | "co"
  | "cc"
  | "rpa"
  | "ps";

export type PrimaryPharmacySector = Exclude<PharmacySectorId, "todos" | "imediatas">;

export const PHARMACY_SECTORS: { id: PharmacySectorId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "imediatas", label: "Doses imediatas" },
  { id: "uti-ped", label: "Uti Ped" },
  { id: "uti-neo", label: "Uti Neo" },
  { id: "uci", label: "UCI" },
  { id: "pediatria", label: "Pediatria" },
  { id: "maternidade", label: "Maternidade" },
  { id: "clinica-cirurgica", label: "Clinica cirurgica" },
  { id: "co", label: "CO" },
  { id: "cc", label: "CC" },
  { id: "rpa", label: "RPA" },
  { id: "ps", label: "Pronto Socorro" },
];

const SECTOR_NAMES: Record<PrimaryPharmacySector, string> = {
  "uti-ped": "Uti Ped",
  "uti-neo": "Uti Neo",
  uci: "UCI",
  pediatria: "Pediatria",
  maternidade: "Maternidade",
  "clinica-cirurgica": "Clinica cirurgica",
  co: "CO",
  cc: "CC",
  rpa: "RPA",
  ps: "Pronto Socorro",
};

export function resolvePharmacySector(encounter: Encounter, patient: Patient): PrimaryPharmacySector {
  const fiaWard = (encounter.fia?.ward ?? "").toUpperCase();
  const bed = (patient.bed ?? "").toUpperCase();
  const ward = String(patient.ward ?? "").toUpperCase();
  const text = `${ward} ${fiaWard} ${bed}`;
  if (ward === "UTIP" || /UTI\s*PED/.test(text)) return "uti-ped";
  if (ward === "UTIN" || /UTI\s*NEO/.test(text)) return "uti-neo";
  if (ward === "UCI" || /\bUCI\b/.test(text)) return "uci";
  if (/\b(RPA|SRPA)\b/.test(text)) return "rpa";
  if (/\bCC\b|CENTRO\s*CIR[ÚU]RGICO/.test(text)) return "cc";
  if (/CL[ÍI]NICA\s*CIR[ÚU]RGICA|CCIR/.test(text)) return "clinica-cirurgica";
  if (ward === "CO" || /CENTRO\s*OBST[ÉE]TRICO|\bCO\b/.test(text)) return "co";
  if (ward === "AC" || /MATERNIDADE|ALOJAMENTO/.test(text)) return "maternidade";
  if (ward === "ENFP" || /PEDIATRIA|ENFERMARIA\s*PED/.test(text)) return "pediatria";
  if (encounter.type === "Maternidade") return "maternidade";
  if (encounter.type === "Pronto socorro" || ward === "PSO" || ward === "PSP") return "ps";
  return patient.type === "pediatria" || patient.type === "neonato" ? "pediatria" : "ps";
}

export function pharmacySectorLabel(encounter: Encounter, patient: Patient): string {
  const sector = resolvePharmacySector(encounter, patient);
  return SECTOR_NAMES[sector];
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