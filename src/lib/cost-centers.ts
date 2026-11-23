import type { Patient, Surgery, Ward } from "./hospital-data";
import { DAILY_RATE, WARDS } from "./hospital-data";
import type { StockMedication } from "./pharmacy-stock";
import type { Movement } from "./supply-flow";
import { COST_KINDS, unitCostOf } from "./os-report";
import { competenceOf } from "./sus-billing";
import { REQUEST_SECTORS } from "./sector-request";

export type CostGroup = "Assistencial" | "SADT" | "Apoio operacional" | "Administrativo" | "Perdas";
export const COST_GROUPS: CostGroup[] = ["Assistencial", "SADT", "Apoio operacional", "Administrativo", "Perdas"];
const ASSIST = ["Ambulatório", "CC", "Clínica CC", "CO", "Maternidade", "Pediatria", "PS", "UCI", "UTI Neo", "UTI Ped"];
const SADT = ["Banco de Leite", "CME", "Raio-x", "Ultrassom", "Psicologia", "Serviço social", "Nutriçao", "Fisioterapia"];
const OPER = ["Almoxarifado", "Cozinha", "Engenharia Clinica", "Farmácia", "Hotelaria", "Lactário", "Manutenção", "Recep Ambu", "Recep Inf", "Recep Mat", "Sala De Reunioes"];
export const PERDAS = "Perdas (validade/quebra)";
export const UNALLOCATED = "Não apropriado";

export function groupOf(center: string): CostGroup {
  if (center === PERDAS) return "Perdas";
  if (ASSIST.includes(center)) return "Assistencial";
  if (SADT.includes(center)) return "SADT";
  if (OPER.includes(center)) return "Apoio operacional";
  return "Administrativo";
}
/** Unidade de internação → centro de custo. */
export const WARD_CENTER: Record<Ward, string> = { PSO: "PS", PSP: "PS", CO: "CO", AC: "Maternidade", UTIN: "UTI Neo", ENFP: "Pediatria", UTIP: "UTI Ped", UCI: "UCI" } as Record<Ward, string>;
export const COST_CENTERS = [...new Set([...REQUEST_SECTORS, "Fisioterapia"])].sort((a, b) => a.localeCompare(b, "pt-BR"));

export interface CostEntry { center: string; group: CostGroup; type: "Material/medicamento" | "Diárias" | "Sala cirúrgica"; item: string; qty: number; unit: number; total: number }
const round = (n: number) => Math.round(n * 100) / 100;

/** Apropria cada gasto da competência a um centro de custo. */
export function allocateCosts(comp: string, d: { movements: Movement[]; items: StockMedication[]; patients: Patient[]; surgeries: Surgery[] }): CostEntry[] {
  const out: CostEntry[] = [];
  const push = (center: string, type: CostEntry["type"], item: string, qty: number, unit: number) => out.push({ center, group: groupOf(center), type, item, qty, unit, total: round(qty * unit) });
  for (const m of d.movements) {
    if (!COST_KINDS.includes(m.kind) || competenceOf(m.at) !== comp) continue;
    const ward = m.patientId ? d.patients.find((p) => p.id === m.patientId)?.ward : undefined;
    const center = m.kind === "vencimento" || m.kind === "quebra" ? PERDAS : m.costCenter || (ward ? WARD_CENTER[ward] ?? UNALLOCATED : UNALLOCATED);
    push(center, "Material/medicamento", m.item, m.qty, unitCostOf(m, d.items));
  }
  for (const w of WARDS) {
    const days = d.patients.filter((p) => p.ward === w.id).reduce((s, p) => s + p.days, 0);
    if (days > 0) push(WARD_CENTER[w.id] ?? UNALLOCATED, "Diárias", `Diárias · ${w.name}`, days, DAILY_RATE[w.id]);
  }
  for (const s of d.surgeries) {
    if (!s.date || competenceOf(s.date) !== comp || s.suspension) continue;
    const center = s.type === "Parto Normal" || s.type === "Cesárea" ? "CO" : "CC";
    for (const g of s.gastos) push(center, "Sala cirúrgica", g.item || "Material de sala", g.qty, g.price);
  }
  return out;
}

export interface CenterSummary { center: string; group: CostGroup; total: number; share: number; materials: number; dailies: number; surgery: number; patientDays: number; perPatientDay: number }
export function summarizeCenters(entries: CostEntry[]): CenterSummary[] {
  const all = entries.reduce((s, e) => s + e.total, 0);
  const m = new Map<string, CostEntry[]>();
  entries.forEach((e) => m.set(e.center, [...(m.get(e.center) ?? []), e]));
  return [...m].map(([center, es]) => {
    const by = (t: CostEntry["type"]) => round(es.filter((e) => e.type === t).reduce((s, e) => s + e.total, 0));
    const total = round(es.reduce((s, e) => s + e.total, 0));
    const patientDays = es.filter((e) => e.type === "Diárias").reduce((s, e) => s + e.qty, 0);
    const materials = by("Material/medicamento");
    return { center, group: groupOf(center), total, share: all ? round((total / all) * 100) : 0, materials, dailies: by("Diárias"), surgery: by("Sala cirúrgica"), patientDays, perPatientDay: patientDays ? round(materials / patientDays) : 0 };
  }).sort((a, b) => b.total - a.total);
}

export interface AbcRow { item: string; qty: number; total: number; share: number; cumulative: number; cls: "A" | "B" | "C" }
/** Curva ABC: A até 80% acumulado, B até 95%, C restante. */
export function abcCurve(entries: CostEntry[]): AbcRow[] {
  const m = new Map<string, { qty: number; total: number }>();
  entries.forEach((e) => { const c = m.get(e.item) ?? { qty: 0, total: 0 }; m.set(e.item, { qty: c.qty + e.qty, total: c.total + e.total }); });
  const all = [...m.values()].reduce((s, x) => s + x.total, 0);
  let acc = 0;
  return [...m].sort((a, b) => b[1].total - a[1].total).map(([item, x]) => {
    const share = all ? (x.total / all) * 100 : 0; const prev = acc; acc += share;
    return { item, qty: x.qty, total: round(x.total), share: round(share), cumulative: round(acc), cls: prev < 80 ? "A" : prev < 95 ? "B" : "C" };
  });
}
