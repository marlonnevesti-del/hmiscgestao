import { useSyncExternalStore } from "react";
import { PATIENTS, QUEUE, SURGERIES, type Admin, type Newborn, type Patient, type Profile, type QueueItem, type Surgery } from "./hospital-data";

interface State { profile: Profile; employeeName: string; patients: Patient[]; queue: QueueItem[]; surgeries: Surgery[]; admins: Record<string, Admin> }
let state: State = { profile: "Outro", employeeName: "", patients: structuredClone(PATIENTS), queue: QUEUE, surgeries: SURGERIES, admins: { "p2|rx7|06:00": { status: "checado", by: "Enf. Carla Souza", at: "06:05" }, "p1|rx3|06:00": { status: "checado", by: "Enf. Carla Souza", at: "06:10" } } };
const ls = new Set<() => void>();
export const getState = () => state;
export function setState(fn: (s: State) => Partial<State>) { state = { ...state, ...fn(state) }; ls.forEach((l) => l()); }
const sub = (l: () => void) => { ls.add(l); return () => ls.delete(l); };
export function useStore<T>(sel: (s: State) => T): T { return useSyncExternalStore(sub, () => sel(state), () => sel(state)); }

export const updatePatient = (id: string, fn: (p: Patient) => Partial<Patient>) =>
  setState((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, ...fn(p) } : p)) }));
export const professionalName = (p: Profile) => state.employeeName || ({ Médico: "Dra. Helena Prado", Enfermeiro: "Enf. Carla Souza", Farmacêutico: "Farm. João Vieira", Recepção: "Rec. Ana Lopes", Administrador: "Administrador", Outro: "Colaborador" })[p];
export const nowHM = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Registra o parto: cria prontuário "RN de <mãe>" vinculado e converte a mãe em puérpera. */
export function registerBirth(motherId: string, nb: Omit<Newborn, "motherId">, mode: "Parto Normal" | "Cesárea", sex: "F" | "M"): string {
  const m = state.patients.find((p) => p.id === motherId)!;
  const id = `rn-${state.patients.length + 1}`;
  const uti = nb.apgar5 < 7 || nb.pesoNascer < 2000;
  const rn: Patient = {
    id, prontuario: `2026-${String(4900 + state.patients.length)}`, name: `RN de ${m.name}`, cpf: "—", motherName: m.name, type: "neonato", age: "0 dia",
    ig: `${m.ig ?? ""} (ao nascer)`, weight: nb.pesoNascer / 1000, height: nb.comprimento, allergies: [], risks: [], ward: uti ? "UTIN" : "AC",
    bed: uti ? "UTIN-07" : `${m.bed}-RN`, insurance: m.insurance, ...(m.guia ? { guia: m.guia } : {}), authorized: m.authorized,
    diagnosis: `RN ${sex === "F" ? "feminino" : "masculino"} – ${mode}`, admission: `14/11 ${nowHM()}`, days: 1,
    evolutions: [{ time: `14/11 ${nowHM()}`, cat: "Médica", author: professionalName(state.profile), text: `Nascimento por ${mode.toLowerCase()}. Apgar ${nb.apgar1}/${nb.apgar5}, peso ${nb.pesoNascer} g.` }],
    vitals: [], prescriptions: [], newborn: { ...nb, motherId },
  };
  setState((s) => ({
    patients: [...s.patients.map((p) => p.id === motherId ? { ...p, type: "puerpera" as const, ward: "AC" as const, bed: m.bed.startsWith("CO") ? "AC-05" : p.bed, diagnosis: `Puerpério imediato – ${mode}`, babyIds: [...(p.babyIds ?? []), id], evolutions: [{ time: `14/11 ${nowHM()}`, cat: "Médica" as const, author: professionalName(s.profile), text: `Parto ${mode.toLowerCase()} realizado. RN vinculado (${rn.prontuario}).` }, ...p.evolutions] } : p), rn],
  }));
  if (rn.bed.endsWith("-RN")) updatePatient(id, () => ({ bed: "AC-05B" }));
  return id;
}
