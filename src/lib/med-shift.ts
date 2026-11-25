import type { Encounter } from "./care-flow";
import type { Admin, Patient } from "./hospital-data";

export type Shift = "Madrugada" | "Manhã" | "Tarde" | "Noite";
export const SHIFTS: { id: Shift; from: number; to: number }[] = [
  { id: "Madrugada", from: 0, to: 6 },
  { id: "Manhã", from: 6, to: 12 },
  { id: "Tarde", from: 12, to: 18 },
  { id: "Noite", from: 18, to: 24 },
];

export function currentShift(d = new Date()): Shift {
  return SHIFTS.find((s) => d.getHours() >= s.from && d.getHours() < s.to)?.id ?? "Madrugada";
}

export interface DoseRow {
  key: string; patientId: string; patientName: string; bed: string; item: string; time: string; dueAt: number;
  status: "checado" | "justificado" | "cancelado" | "aguardando" | "atrasado" | "pendente";
}

const ACTIVE = ["AGUARDANDO_FARMACIA", "AGUARDANDO_MEDICACAO", "EM_OBSERVACAO_REAVALIACAO"];

export function doseRows(encounters: Encounter[], patients: Patient[], admins: Record<string, Admin>, now = Date.now()): DoseRow[] {
  const rows: DoseRow[] = [];
  for (const e of encounters) {
    if (!e.signedAt || !ACTIVE.includes(e.status_fluxo)) continue;
    const p = patients.find((x) => x.id === e.patientId);
    if (!p) continue;
    const signed = Date.parse(e.signedAt);
    for (const rx of p.prescriptions.filter((r) => r.batchId === e.prescriptionBatchId)) {
      for (const time of rx.times ?? []) {
        const key = `${p.id}|${rx.id}|${time}`;
        const admin = admins[key];
        const due = new Date(e.signedAt);
        const [h, m] = time.split(":").map(Number);
        due.setHours(h ?? 0, m ?? 0, 0, 0);
        if (due.getTime() < signed - 60000) due.setDate(due.getDate() + 1);
        const dueAt = due.getTime();
        const status: DoseRow["status"] = admin?.status === "checado" ? "checado"
          : admin?.status === "cancelado" ? "cancelado"
          : admin?.status === "nao" || admin?.status === "adiado" ? "justificado"
          : rx.pharmacy && rx.pharmacy !== "Dispensada" ? "aguardando"
          : now > dueAt ? "atrasado" : "pendente";
        rows.push({ key, patientId: p.id, patientName: p.name, bed: p.bed || p.ward, item: rx.item, time, dueAt, status });
      }
    }
  }
  return rows.sort((a, b) => a.dueAt - b.dueAt);
}

export function shiftProgress(doses: DoseRow[]) {
  const count = (s: DoseRow["status"]) => doses.filter((d) => d.status === s).length;
  const total = doses.length, checado = count("checado");
  return { total, checado, pendente: count("pendente"), atrasado: count("atrasado"), justificado: count("justificado"), aguardando: count("aguardando"), pct: total ? Math.round(checado / total * 100) : 0 };
}
