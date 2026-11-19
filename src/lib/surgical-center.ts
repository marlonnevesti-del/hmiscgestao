/** Centro Cirúrgico, SAEP, SRPA, Centro Obstétrico e indicadores (regras puras). */
import type { Surgery } from "./hospital-data";

export const SUSPENSION_REASONS = ["Condição clínica do paciente", "Falta de leito (UTI/enfermaria)", "Recusa do paciente", "Atraso/ausência da equipe", "Jejum não conforme", "Falta de material/equipamento", "Exames pré-operatórios incompletos", "Outro"];
export interface Suspension { reason: string; justification: string; by: string; at: string }
export function suspensionIssue(reason: string, justification: string): string | null {
  if (!SUSPENSION_REASONS.includes(reason)) return "Selecione o motivo da suspensão.";
  if (justification.trim().length < 10) return "Justificativa obrigatória (mínimo 10 caracteres).";
  return null;
}

export const POSITIONS = ["Decúbito dorsal", "Decúbito ventral", "Decúbito lateral", "Litotomia", "Trendelenburg", "Proclive", "Sentado"];
export interface Saep { position: string; protections: string; devices: string; prophylaxisDrug: string; prophylaxisTime: string; counts: { phase: "Inicial" | "Pré-fechamento" | "Final"; gauze: number; compresses: number; instruments: number }[]; notes: string; by: string; at: string }
export const EMPTY_SAEP: Saep = { position: "", protections: "", devices: "", prophylaxisDrug: "", prophylaxisTime: "", counts: [], notes: "", by: "", at: "" };
/** Contagem confere quando a contagem final é igual à inicial em todos os itens. */
export function countMismatch(saep: Saep): string | null {
  const ini = saep.counts.find((c) => c.phase === "Inicial"); const fin = saep.counts.find((c) => c.phase === "Final");
  if (!ini || !fin) return "Contagens inicial e final obrigatórias.";
  const bad = (["gauze", "compresses", "instruments"] as const).filter((k) => ini[k] !== fin[k]);
  return bad.length ? `Divergência na contagem: ${bad.map((k) => ({ gauze: "gazes", compresses: "compressas", instruments: "instrumentais" })[k]).join(", ")}.` : null;
}

// ---- SRPA ----
export const SRPA_BEDS = ["SRPA 1", "SRPA 2", "SRPA 3", "SRPA 4", "SRPA 5", "SRPA 6"];
export interface Aldrete { activity: number; breathing: number; circulation: number; consciousness: number; saturation: number }
export const ALDRETE_ITEMS: { key: keyof Aldrete; label: string; options: string[] }[] = [
  { key: "activity", label: "Atividade", options: ["Não move membros", "Move 2 membros", "Move 4 membros"] },
  { key: "breathing", label: "Respiração", options: ["Apneia", "Dispneia/limitada", "Respira e tosse"] },
  { key: "circulation", label: "Circulação (PA)", options: ["±50% do pré", "±20–49% do pré", "±20% do pré"] },
  { key: "consciousness", label: "Consciência", options: ["Não responde", "Desperta ao chamado", "Lúcido"] },
  { key: "saturation", label: "SpO₂", options: ["<90% com O₂", ">90% com O₂", ">92% ar ambiente"] },
];
export const aldreteScore = (a: Aldrete) => a.activity + a.breathing + a.circulation + a.consciousness + a.saturation;
/** Alta anestésica: escore ≥ 9, ou ≥ 8 após anestesia regional, sem nenhum item zero. */
export function aldreteDischarge(a: Aldrete, regional = false) {
  const zero = Object.values(a).some((v) => v === 0);
  return !zero && aldreteScore(a) >= (regional ? 8 : 9);
}
export interface SrpaVital { at: string; pa: string; fc: string; spo2: string; pain: number; aldrete: Aldrete; by: string }
export interface SrpaStay { bed: string; inAt: string; vitals: SrpaVital[]; dischargeAt?: string; destination?: string; bedRequestedAt?: string; outAt?: string }
/** Monitorização: a cada 15 min na 1ª hora, depois a cada 30 min. */
export function nextVitalDue(stay: SrpaStay): Date {
  const inAt = new Date(stay.inAt).getTime(); const last = stay.vitals.at(-1);
  const base = last ? new Date(last.at).getTime() : inAt;
  const step = base - inAt < 60 * 60e3 ? 15 : 30;
  return new Date(base + step * 60e3);
}
export const minutesBetween = (a?: string, b?: string) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60e3) : null);

// ---- Centro Obstétrico ----
export const CO_BEDS = [
  ...["PPP 21.1", "PPP 21.2", "PPP 21.3", "PPP 22", "PPP 22.1", "PPP 22.2", "PPP 22.3", "PPP 23"],
  "Consultório 1", "Consultório 2", "CTG 1",
  ...Array.from({ length: 10 }, (_, i) => `Observação ${i + 1}`),
];
export const SAFE_BIRTH = {
  admissao: ["Necessita referência?", "Partograma iniciado", "Antibiótico se febre/RPM >18h", "Sulfato de Mg se pré-eclâmpsia grave", "Acompanhante incentivado"],
  antesExpulsivo: ["Ocitocina preparada (10 UI IM)", "Material de reanimação neonatal pronto", "Assistente identificado"],
  posParto: ["Sangramento avaliado (HPP?)", "Ocitocina administrada no 1º minuto", "RN avaliado (Apgar)", "Amamentação e pele a pele iniciados"],
  alta: ["Mãe e RN sem sinais de alerta", "Planejamento familiar orientado", "Retorno agendado"],
};
export interface Obstetric {
  parity: "Nulípara" | "Multípara"; previousCesarean: boolean; presentation: "Cefálica" | "Pélvica" | "Transversa/oblíqua";
  fetuses: number; gestationalWeeks: number; labor: "Espontâneo" | "Induzido" | "Cesárea antes do trabalho de parto";
  delivery: "Vaginal" | "Cesárea" | ""; episiotomy: boolean; pph: boolean;
  skinToSkin: boolean; breastfeeding1h: boolean; cordClampMin: string; checks: Record<string, boolean>;
}
export const EMPTY_OBST: Obstetric = { parity: "Nulípara", previousCesarean: false, presentation: "Cefálica", fetuses: 1, gestationalWeeks: 39, labor: "Espontâneo", delivery: "", episiotomy: false, pph: false, skinToSkin: false, breastfeeding1h: false, cordClampMin: "", checks: {} };
/** Classificação de Robson (10 grupos, OMS 2017). */
export function robson(o: Obstetric): number {
  if (o.fetuses > 1) return 8;
  if (o.presentation === "Transversa/oblíqua") return 9;
  if (o.presentation === "Pélvica") return o.parity === "Nulípara" ? 6 : 7;
  if (o.gestationalWeeks < 37) return 10;
  if (o.previousCesarean) return 5;
  if (o.parity === "Nulípara") return o.labor === "Espontâneo" ? 1 : 2;
  return o.labor === "Espontâneo" ? 3 : 4;
}

// ---- Relatórios ----
export type SurgX = Surgery & { procedures?: string[]; suspension?: Suspension; saep?: Saep; srpa?: SrpaStay; obstetric?: Obstetric };
const inMonth = (s: SurgX, month: string) => (s.date ?? "").startsWith(month);
const count = <T,>(xs: T[], key: (x: T) => string) => Object.entries(xs.reduce<Record<string, number>>((a, x) => { const k = key(x) || "—"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
export function ccReport(all: SurgX[], month: string) {
  const list = all.filter((s) => inMonth(s, month) && !s.obstetric);
  const suspended = list.filter((s) => s.suspension);
  const done = list.filter((s) => s.status === "Finalizado" && !s.suspension);
  const roomMins = done.map((s) => minutesBetween(s.report?.roomIn ? `${s.date}T${s.report.roomIn}` : undefined, s.report?.roomOut ? `${s.date}T${s.report.roomOut}` : undefined)).filter((x): x is number => x != null && x > 0);
  const srpaMins = list.map((s) => minutesBetween(s.srpa?.inAt, s.srpa?.outAt ?? s.srpa?.dischargeAt)).filter((x): x is number => x != null && x > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return { scheduled: list.length, done: done.length, suspended: suspended.length, suspensionRate: pct(suspended.length, list.length), bySurgeon: count(done, (s) => s.team?.surgeon || s.surgeon), byRoom: count(done, (s) => s.room), byReason: count(suspended, (s) => s.suspension!.reason), avgRoomMin: avg(roomMins), avgSrpaMin: avg(srpaMins) };
}
export function coReport(all: SurgX[], month: string) {
  const list = all.filter((s) => inMonth(s, month) && s.obstetric?.delivery);
  const ces = list.filter((s) => s.obstetric!.delivery === "Cesárea");
  const groups = Array.from({ length: 10 }, (_, i) => { const g = list.filter((s) => robson(s.obstetric!) === i + 1); const c = g.filter((s) => s.obstetric!.delivery === "Cesárea").length; return { group: i + 1, total: g.length, cesarean: c, groupSize: pct(g.length, list.length), cesareanRate: pct(c, g.length), contribution: pct(c, list.length) }; });
  const vag = list.filter((s) => s.obstetric!.delivery === "Vaginal");
  return { births: list.length, vaginal: vag.length, cesarean: ces.length, cesareanRate: pct(ces.length, list.length), episiotomyRate: pct(vag.filter((s) => s.obstetric!.episiotomy).length, vag.length), pphRate: pct(list.filter((s) => s.obstetric!.pph).length, list.length), skinToSkinRate: pct(list.filter((s) => s.obstetric!.skinToSkin).length, list.length), breastfeedingRate: pct(list.filter((s) => s.obstetric!.breastfeeding1h).length, list.length), groups };
}
export function toCsv(rows: (string | number)[][]) { return "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n"); }
