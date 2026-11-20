// Banco de Leite Humano rules (RDC 171/2006 · rBLH): raw milk validity, pasteurization quality, stock autonomy, monthly report.
export interface MilkDonor { id: string; name: string; phone?: string; origin: "Interna" | "Domiciliar"; serologyOk: boolean; createdAt: string; active: boolean }
export interface RawBottle { id: string; code: string; donorId: string; collectedAt: string; volume: number; status: "Estoque" | "Em lote" | "Pasteurizado" | "Descartado"; batchId?: string; note?: string }
export interface MilkBatch {
  id: string; code: string; scheduledAt: string; bottleIds: string[]; volume: number;
  status: "Agendado" | "Aprovado" | "Reprovado";
  dornic?: number; crematocrit?: number; kcal?: number; microOk?: boolean; doneAt?: string; doneBy?: string; remaining: number; expiresAt?: string;
}
export interface MilkRecipient { patientId: string; mlPerFeed: number; feedsPerDay: number; since: string; active: boolean }
export interface MilkDispense { id: string; batchId: string; patientId: string; volume: number; at: string; by: string }
export interface MilkVisit { id: string; donorId: string; at: string; volume: number }
export interface MilkBank { donors: MilkDonor[]; raw: RawBottle[]; batches: MilkBatch[]; recipients: MilkRecipient[]; dispenses: MilkDispense[]; visits: MilkVisit[] }
export const EMPTY_MILK_BANK: MilkBank = { donors: [], raw: [], batches: [], recipients: [], dispenses: [], visits: [] };

export const RAW_VALIDITY_DAYS = 15;
export const LHP_VALIDITY_DAYS = 180;
export const DORNIC_MAX = 8;
const DAY = 86_400_000;

export const kcalFromCrematocrit = (c: number) => Math.round(66.8 * c + 290);
export const caloricClass = (kcal: number) => kcal < 500 ? "Hipocalórico" : kcal > 700 ? "Hipercalórico" : "Normocalórico";
export const rawExpiresAt = (b: Pick<RawBottle, "collectedAt">) => new Date(new Date(b.collectedAt).getTime() + RAW_VALIDITY_DAYS * DAY).toISOString();
export const daysLeft = (iso: string, now = new Date()) => Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY);

/** Quality approval: Dornic ≤ 8 °D and negative microbiology. */
export const batchApproved = (dornic: number, microOk: boolean) => dornic <= DORNIC_MAX && microOk;

export const rawStock = (m: MilkBank, now = new Date()) => m.raw.filter((b) => b.status === "Estoque" && daysLeft(rawExpiresAt(b), now) > 0);
export const lhpStock = (m: MilkBank, now = new Date()) => m.batches.filter((b) => b.status === "Aprovado" && b.remaining > 0 && (!b.expiresAt || daysLeft(b.expiresAt, now) > 0));
export const sum = (xs: { volume?: number; remaining?: number }[], k: "volume" | "remaining" = "volume") => xs.reduce((t, x) => t + (x[k] ?? 0), 0);
export const dailyNeed = (m: MilkBank) => m.recipients.filter((r) => r.active).reduce((t, r) => t + r.mlPerFeed * r.feedsPerDay, 0);
/** Days of pasteurized stock at current prescribed consumption (null when nobody uses LHP). */
export function autonomyDays(m: MilkBank, now = new Date()) { const need = dailyNeed(m); return need ? Math.floor(sum(lhpStock(m, now), "remaining") / need * 10) / 10 : null; }
export const nextPasteurization = (m: MilkBank) => m.batches.filter((b) => b.status === "Agendado").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

/** Indicators requested by SES/SC (planilha AT46) for a YYYY-MM month. */
export function milkReport(m: MilkBank, month: string) {
  const inMonth = (iso?: string) => !!iso && iso.slice(0, 7) === month;
  const done = m.batches.filter((b) => b.status !== "Agendado" && inMonth(b.doneAt));
  return {
    litrosRecebidos: sum(m.raw.filter((b) => inMonth(b.collectedAt))) / 1000,
    litrosPasteurizados: sum(done.filter((b) => b.status === "Aprovado")) / 1000,
    litrosDistribuidos: sum(m.dispenses.filter((d) => inMonth(d.at))) / 1000,
    examesMicrobiologicos: done.length, crematocritos: done.filter((b) => b.crematocrit != null).length,
    lotesReprovados: done.filter((b) => b.status === "Reprovado").length,
    visitasDomiciliares: m.visits.filter((v) => inMonth(v.at)).length,
    doadorasAtivas: m.donors.filter((d) => d.active).length,
    receptores: new Set(m.dispenses.filter((d) => inMonth(d.at)).map((d) => d.patientId)).size,
  };
}
