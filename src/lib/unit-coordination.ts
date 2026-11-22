// Indicadores de coordenação por porta (Ambulatório / Maternidade), derivados dos atendimentos existentes.
import type { Encounter } from './care-flow';

export interface UnitPatientInfo { id: string; city: string; sex: string; ageBand: string }
const count = (xs: string[]): [string, number][] => [...xs.reduce((m, x) => m.set(x || 'Não informado', (m.get(x || 'Não informado') ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const mins = (a?: string, b?: string) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : null);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
const at = (e: Encounter, st: string) => e.history.find((h) => h.status === st)?.at;

/** period = "AAAA", "AAAA-MM" ou "AAAA-MM-DD"; type = encounter.type da porta. */
export function unitReport(all: Encounter[], patients: UnitPatientInfo[], type: string, period: string) {
  const list = all.filter((e) => e.type === type && e.openedAt.startsWith(period));
  const info = (e: Encounter) => patients.find((p) => p.id === e.patientId);
  const triaged = list.filter((e) => e.triage);
  const toTriage = list.map((e) => mins(e.openedAt, at(e, 'AGUARDANDO_MEDICO'))).filter((x): x is number => x != null && x >= 0);
  const toDoctor = list.map((e) => mins(e.openedAt, at(e, 'EM_ATENDIMENTO_MEDICO'))).filter((x): x is number => x != null && x >= 0);
  const closed = list.filter((e) => e.status_fluxo === 'ALTA_HOSPITALAR');
  const stay = closed.map((e) => mins(e.openedAt, at(e, 'ALTA_HOSPITALAR'))).filter((x): x is number => x != null && x >= 0);
  const evasions = closed.filter((e) => /evas/i.test(e.history.find((h) => h.status === 'ALTA_HOSPITALAR')?.note ?? '')).length;
  const admitted = list.filter((e) => e.admission || e.fia || e.history.some((h) => h.status === 'ENCAMINHADO_INTERNACAO')).length;
  const toCo = list.filter((e) => e.history.some((h) => h.status === 'ENCAMINHADO_CO')).length;
  return {
    total: list.length, classified: triaged.length, open: list.length - closed.length, admitted, admissionRate: pct(admitted, list.length), toCo,
    evasions, evasionRate: pct(evasions, list.length), avgTriageWaitMin: avg(toTriage), avgDoctorWaitMin: avg(toDoctor), avgStayMin: avg(stay),
    byRisk: count(triaged.map((e) => e.triage!.risk)), bySpecialty: count(list.map((e) => e.specialty)),
    byCid: count(list.filter((e) => e.medical?.cid).map((e) => e.medical!.cid)).slice(0, 10),
    byCity: count(list.map((e) => info(e)?.city ?? '')).slice(0, 10), byAge: count(list.map((e) => info(e)?.ageBand ?? '')), bySex: count(list.map((e) => info(e)?.sex ?? '')),
  };
}

export interface ApptLite { date: string; status: string; specialtyId: string; professional: string; encounterId?: string }
/** Ambulatório: absenteísmo por especialidade e profissional + laudos SADT. */
export function ambCoordination(appts: ApptLite[], specName: (id: string) => string, encounters: Encounter[], sadtNames: Set<string>, period: string) {
  const list = appts.filter((a) => a.date.startsWith(period) && a.status !== 'cancelado');
  const rows = (key: (a: ApptLite) => string) => [...new Set(list.map(key))].map((k) => { const g = list.filter((a) => key(a) === k); const f = g.filter((a) => a.status === 'faltou').length; return [k || 'Não informado', g.length, f, `${pct(f, g.length)}%`] as [string, number, number, string]; }).sort((a, b) => b[1] - a[1]);
  const absent = list.filter((a) => a.status === 'faltou').length;
  const sadt = encounters.filter((e) => e.type === 'Ambulatório' && sadtNames.has(e.specialty) && e.openedAt.startsWith(period));
  const reported = sadt.filter((e) => e.sadtReport);
  const reqs = encounters.flatMap((e) => e.examRequests ?? []).filter((r) => r.requestedAt.startsWith(period));
  return {
    scheduled: list.length, attended: list.filter((a) => a.status === 'chegou').length, absent, absenteeism: pct(absent, list.length),
    cancelled: appts.filter((a) => a.date.startsWith(period) && a.status === 'cancelado').length,
    bySpecialty: rows((a) => specName(a.specialtyId)), byProfessional: rows((a) => a.professional.trim()),
    sadtTotal: sadt.length, sadtReported: reported.length, sadtPending: sadt.length - reported.length,
    sadtAvgReportMin: avg(reported.map((e) => mins(e.openedAt, e.sadtReport!.at)).filter((x): x is number => x != null && x >= 0)),
    examRequests: reqs.length, examPending: reqs.filter((r) => ['Solicitado', 'Agendado', 'Realizado'].includes(r.status)).length,
  };
}
