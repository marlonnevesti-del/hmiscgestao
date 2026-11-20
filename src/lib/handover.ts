import type { Patient } from './hospital-data';
import type { Encounter } from './care-flow';
import { stayDays } from './bed-board';

export interface Sbar { s: string; b: string; a: string; r: string }

export function buildSbar(p: Patient, e: Encounter, now = Date.now()): Sbar {
  const cid = e.fia?.cid || e.medical?.cid || '—';
  const diagnosis = e.medical?.diagnosis || e.fia?.justification || p.diagnosis;
  const s = [`Leito ${e.fia?.bed || p.bed} · ${e.fia?.ward || p.ward}`, e.fia ? `${stayDays(e.fia.openedAt, now)} dias de internação` : '', `${cid} · ${diagnosis}`].filter(Boolean).join(' · ');
  const b = [
    `Alergias: ${p.allergies.length ? p.allergies.join(', ') : 'Nega'}`,
    p.specialConditions?.length ? `Condições especiais: ${p.specialConditions.join(', ')}` : '',
    p.risks.length ? `Riscos: ${p.risks.join(', ')}` : '',
    ...(p.sciras?.isolates.map((i) => `Isolamento: ${i.organism} (${i.precaution})`) ?? []),
    p.type === 'neonato' && p.motherName ? `Mãe: ${p.motherName}` : '',
    `Admissão: ${new Date(e.openedAt).toLocaleDateString('pt-BR')}`,
  ].filter(Boolean).join(' · ');
  const v = p.vitals.at(-1); const ev = p.evolutions.at(-1);
  const meds = p.prescriptions.filter((x) => x.cat === 'Medicamento').length;
  const a = [
    v ? `PA ${v.pas}/${v.pad} · FC ${v.fc} · FR ${v.fr} · Tax ${v.tax} · Sat ${v.sat} · Dor ${v.dor}` : 'Sem sinais registrados',
    ev ? `${ev.cat} · ${ev.author} · ${ev.text.slice(0, 180)}` : '',
    `Medicamentos ativos: ${meds}`,
    ...(p.physio?.filter((x) => x.status === 'Aguardando' || x.status === 'Em acompanhamento').map((x) => `Fisioterapia: ${x.status}`) ?? []),
  ].filter(Boolean).join(' · ');
  const doses = p.prescriptions.reduce((n, x) => n + (x.times?.length ?? 0), 0);
  const pend = [e.examPending ? `Exames pendentes: ${e.examPending}` : '', doses ? `Doses a conferir: ${doses}` : '', p.dischargeForecast ? `Previsão de alta: ${p.dischargeForecast}` : ''].filter(Boolean);
  return { s, b, a, r: pend.length ? pend.join(' · ') : 'Sem pendências registradas' };
}

export function handoverForUnit(encounters: Encounter[], patients: Patient[], ward: string, now = Date.now()) {
  const byId = new Map(patients.map((p) => [p.id, p]));
  return encounters.flatMap((e) => {
    if (!e.fia || e.discharge || (ward !== 'TODOS' && e.fia.ward !== ward)) return [];
    const p = byId.get(e.patientId);
    return p ? [{ patient: p, encounter: e, sbar: buildSbar(p, e, now) }] : [];
  }).sort((x, y) => (x.encounter.fia?.bed || x.patient.bed).localeCompare(y.encounter.fia?.bed || y.patient.bed, 'pt-BR', { numeric: true }));
}
