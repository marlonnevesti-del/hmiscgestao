// Relatórios mensais do Ambulatório e SADT: produção, absenteísmo e perfil demográfico.
import type { Appointment, AmbSpecialty } from './ambulatorio';
import type { Encounter } from './care-flow';
import type { Patient } from './hospital-data';

export interface AmbReport {
  total: number; byProfessional: [string, number][]; bySpecialty: [string, number][];
  scheduled: number; absent: number; absenteeism: number;
  byGender: [string, number][]; byAge: [string, number][]; byCity: [string, number][];
}

export function ageBand(birthDate: string | undefined, ref: Date): string {
  if (!birthDate) return 'Não informado';
  const b = new Date(`${birthDate}T12:00:00`); if (Number.isNaN(b.getTime())) return 'Não informado';
  const days = (ref.getTime() - b.getTime()) / 86400000; const years = days / 365.25;
  if (days <= 28) return 'RN (0–28 dias)';
  if (years < 12) return 'Criança (29 dias–11 anos)';
  if (years < 18) return 'Adolescente (12–17)';
  if (years < 60) return 'Adulto (18–59)';
  return 'Idoso (60+)';
}

const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

/** month = "AAAA-MM"; group "sadt" counts exams, "consultas" counts medical + non-medical visits. */
export function buildAmbReport(month: string, group: 'consultas' | 'sadt', encounters: Encounter[], appointments: Appointment[], patients: Patient[], specs: AmbSpecialty[]): AmbReport {
  const sadt = new Set(specs.filter((s) => s.group === 'sadt').map((s) => s.name));
  const sadtIds = new Set(specs.filter((s) => s.group === 'sadt').map((s) => s.id));
  const inGroup = (name: string) => (group === 'sadt') === sadt.has(name);
  const enc = encounters.filter((e) => e.type === 'Ambulatório' && e.openedAt.slice(0, 7) === month && inGroup(e.specialty));
  const appts = appointments.filter((a) => a.date.slice(0, 7) === month && (group === 'sadt') === sadtIds.has(a.specialtyId) && a.status !== 'cancelado');
  const absent = appts.filter((a) => a.status === 'faltou').length;
  const ref = new Date(`${month}-15T12:00:00`);
  const pats = enc.map((e) => patients.find((p) => p.id === e.patientId));
  const prof = enc.map((e) => e.sadtReport?.professional || e.signedBy || e.history.find((h) => h.status === 'EM_ATENDIMENTO_MEDICO')?.by || 'Não informado');
  return {
    total: enc.length, byProfessional: count(prof), bySpecialty: count(enc.map((e) => e.specialty)),
    scheduled: appts.length, absent, absenteeism: appts.length ? Math.round((absent / appts.length) * 1000) / 10 : 0,
    byGender: count(pats.map((p) => p?.registration?.sex || 'Não informado')),
    byAge: count(pats.map((p) => ageBand(p?.registration?.birthDate, ref))),
    byCity: count(pats.map((p) => { const a = p?.registration?.addresses?.find((x) => x.primary) ?? p?.registration?.addresses?.[0]; return a?.city ? `${a.city}${a.state ? `/${a.state}` : ''}` : 'Não informado'; })),
  };
}
