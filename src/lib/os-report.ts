import type { Encounter } from "./care-flow";
import type { Patient, Surgery } from "./hospital-data";
import { DAILY_RATE, WARDS } from "./hospital-data";
import type { StockMedication } from "./pharmacy-stock";
import type { Movement } from "./supply-flow";
import { competenceOf } from "./sus-billing";

/** Saídas que representam gasto do hospital (dispensação, requisição, perdas e vencidos). */
export const COST_KINDS: Movement["kind"][] = ["consumo", "requisicao", "quebra", "vencimento"];
export interface CostLine { item: string; depot: string; sector: string; qty: number; unit: number; total: number }
export interface OsReport {
  production: { label: string; value: number }[];
  costs: CostLine[];
  byDepot: { label: string; total: number }[];
  bySector: { label: string; total: number }[];
  dailies: { label: string; days: number; unit: number; total: number }[];
  surgeryMaterials: number;
  total: number;
}
const round = (n: number) => Math.round(n * 100) / 100;
const sum = <T,>(xs: T[], f: (x: T) => number) => round(xs.reduce((s, x) => s + f(x), 0));
const group = (lines: CostLine[], key: (l: CostLine) => string) => {
  const m = new Map<string, number>(); lines.forEach((l) => m.set(key(l), (m.get(key(l)) ?? 0) + l.total));
  return [...m].map(([label, total]) => ({ label, total: round(total) })).sort((a, b) => b.total - a.total);
};

export function unitCostOf(m: Pick<Movement, "code" | "item">, items: StockMedication[]): number {
  const it = items.find((i) => (m.code && i.code === m.code) || i.name === m.item);
  return it?.unitCost ?? 0;
}

export function buildOsReport(comp: string, d: { encounters: Encounter[]; patients: Patient[]; surgeries: Surgery[]; movements: Movement[]; items: StockMedication[] }): OsReport {
  const enc = d.encounters.filter((e) => competenceOf(e.openedAt) === comp);
  const surg = d.surgeries.filter((s) => s.date && competenceOf(s.date) === comp && !s.suspension);
  const admitted = enc.filter((e) => e.history.some((h) => h.status === "ENCAMINHADO_INTERNACAO"));
  const byType = (t: string) => enc.filter((e) => e.type === t).length;
  const production = [
    { label: "Atendimentos totais", value: enc.length },
    ...[...new Set(enc.map((e) => e.type))].map((t) => ({ label: `Atendimentos · ${t}`, value: byType(t) })),
    { label: "Internações autorizadas (AIH)", value: admitted.length },
    { label: "Cirurgias realizadas", value: surg.filter((s) => s.type !== "Parto Normal" && s.type !== "Cesárea").length },
    { label: "Partos normais", value: surg.filter((s) => s.type === "Parto Normal").length },
    { label: "Cesáreas", value: surg.filter((s) => s.type === "Cesárea").length },
  ];
  const costs: CostLine[] = d.movements.filter((m) => COST_KINDS.includes(m.kind) && competenceOf(m.at) === comp).map((m) => {
    const unit = unitCostOf(m, d.items);
    const sector = m.kind === "vencimento" ? "Perda por validade" : m.kind === "quebra" ? "Perda / quebra" : m.costCenter || (m.patient ? "Assistência ao paciente" : m.to || "Não informado");
    return { item: m.item, depot: m.from, sector, qty: m.qty, unit, total: round(unit * m.qty) };
  });
  const dailies = WARDS.map((w) => { const days = d.patients.filter((p) => p.ward === w.id).reduce((s, p) => s + p.days, 0); return { label: w.name, days, unit: DAILY_RATE[w.id], total: round(days * DAILY_RATE[w.id]) }; }).filter((x) => x.days > 0);
  const surgeryMaterials = sum(surg.flatMap((s) => s.gastos), (g) => g.qty * g.price);
  const total = round(sum(costs, (c) => c.total) + sum(dailies, (x) => x.total) + surgeryMaterials);
  return { production, costs, byDepot: group(costs, (l) => l.depot), bySector: group(costs, (l) => l.sector), dailies, surgeryMaterials, total };
}
