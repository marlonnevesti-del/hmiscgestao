import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";
import type { Movement } from "./supply-flow";

export interface TraceabilityRow {
  id: string;
  at: string;
  dateKey: string;
  item: string;
  code: string;
  qty: number;
  lot: string;
  reason: string;
  dispensedBy: string;
  prescriber: string;
  patient: string;
  patientId: string;
  prontuario: string;
  ward: string;
  bed: string;
  baa: string;
  fia: string;
}

export interface TraceabilityFilter {
  medicine?: string;
  dateFrom?: string;
  dateTo?: string;
  prescriber?: string;
  patient?: string;
  lot?: string;
}

export interface TraceabilitySummary {
  totalQty: number;
  dispenses: number;
  uniquePatients: number;
  uniquePrescribers: number;
  uniqueLots: number;
}

const norm = (v: string | undefined) => (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Extrai AAAA-MM-DD a partir de uma data ISO no fuso local (ou prefixo ISO se inválido). */
export function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monta linhas rastreáveis de todas as dispensações ('consumo'), cruzando médico prescritor e paciente. */
export function buildTraceabilityRows(
  movements: Movement[],
  encounters: Encounter[],
  patients: Patient[],
): TraceabilityRow[] {
  const byBaa = new Map<string, Encounter>();
  const byFia = new Map<string, Encounter>();
  const byPatientEnc = new Map<string, Encounter>();
  for (const e of encounters) {
    if (e.number) byBaa.set(e.number, e);
    if (e.fia?.number) byFia.set(e.fia.number, e);
    if (e.patientId && (e.signedBy || e.fia?.doctor)) byPatientEnc.set(e.patientId, e);
  }
  const byPatient = new Map(patients.map((p) => [p.id, p]));

  return movements
    .filter((m) => m.kind === "consumo")
    .map((m) => {
      const enc = (m.fia ? byFia.get(m.fia) : undefined)
        ?? (m.baa ? byBaa.get(m.baa) : undefined)
        ?? (m.patientId ? byPatientEnc.get(m.patientId) : undefined);
      const pat = m.patientId ? byPatient.get(m.patientId) : undefined;
      const prescriber = m.prescriber?.trim() || enc?.signedBy?.trim() || enc?.fia?.doctor?.trim() || "Não informado";
      return {
        id: m.id,
        at: m.at,
        dateKey: toLocalDateKey(m.at),
        item: m.item,
        code: m.code ?? "",
        qty: m.qty,
        lot: m.lot || "",
        reason: m.reason || "",
        dispensedBy: m.by || "—",
        prescriber,
        patient: m.patient || pat?.name || m.to || "—",
        patientId: m.patientId || pat?.id || "",
        prontuario: pat?.prontuario || "",
        ward: pat?.ward || "",
        bed: pat?.bed || "",
        baa: m.baa || enc?.number || "",
        fia: m.fia || enc?.fia?.number || "",
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function filterTraceabilityRows(rows: TraceabilityRow[], filter: TraceabilityFilter): TraceabilityRow[] {
  const med = norm(filter.medicine);
  const presc = norm(filter.prescriber);
  const pat = norm(filter.patient);
  const lot = norm(filter.lot);
  const from = filter.dateFrom?.trim() || "";
  const to = filter.dateTo?.trim() || "";

  return rows.filter((r) => {
    if (med && !norm(r.item).includes(med) && !norm(r.code).includes(med)) return false;
    if (from && r.dateKey < from) return false;
    if (to && r.dateKey > to) return false;
    if (presc && !norm(r.prescriber).includes(presc)) return false;
    if (lot && !norm(r.lot).includes(lot)) return false;
    if (pat && ![r.patient, r.prontuario, r.baa, r.fia].some((f) => norm(f).includes(pat))) return false;
    return true;
  });
}

export function summarizeTraceability(rows: TraceabilityRow[]): TraceabilitySummary {
  const patients = new Set<string>();
  const prescribers = new Set<string>();
  const lots = new Set<string>();
  let totalQty = 0;
  for (const r of rows) {
    totalQty += r.qty;
    if (r.patientId || r.patient) patients.add(r.patientId || r.patient);
    if (r.prescriber && r.prescriber !== "Não informado") prescribers.add(r.prescriber);
    if (r.lot) lots.add(r.lot);
  }
  return {
    totalQty,
    dispenses: rows.length,
    uniquePatients: patients.size,
    uniquePrescribers: prescribers.size,
    uniqueLots: lots.size,
  };
}