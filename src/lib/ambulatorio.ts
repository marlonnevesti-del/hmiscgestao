// Ambulatório: catálogo de especialidades, agenda e regras de acolhimento.
export type SpecialtyGroup = 'medica' | 'nao_medica' | 'sadt';
export interface AmbSpecialty { id: string; name: string; group: SpecialtyGroup; active: boolean }
export interface Appointment {
  id: string; date: string; time: string; specialtyId: string; professional: string; patientId: string;
  note: string; nursingPreConsult?: boolean; status: 'agendado' | 'chegou' | 'faltou' | 'cancelado'; encounterId?: string; createdBy: string;
}
export interface SadtReport { exam: string; technique: string; findings: string; conclusion: string; professional: string; council: string; at: string }

export const UNITS = ['Ambulatório', 'Pronto socorro', 'Maternidade'] as const;
export type CareUnit = typeof UNITS[number];

export const GROUP_LABELS: Record<SpecialtyGroup, string> = { medica: 'Especialidades médicas', nao_medica: 'Especialidades não médicas', sadt: 'SADT' };

const MEDICAS = ['Alergia e Imunologia', 'Cardiologia Pediátrica', 'Cirurgia Geral Pediátrica', 'Dermatologia Pediátrica', 'Endocrinologia Pediátrica', 'Gastroenterologia Pediátrica', 'Genética', 'Gestação de Alto Risco', 'Ginecologia', 'Infectologia Pediátrica', 'Infertilidade', 'Mastologia', 'Neonatologia/Pediatria Geral', 'Neurologia Pediátrica', 'Oftalmologia Pediátrica', 'Ortopedia Pediátrica', 'Otorrinolaringologia Pediátrica', 'Pneumologia Pediátrica', 'Urologia Pediátrica'];
const NAO_MEDICAS = ['Bucomaxilofacial', 'Fisioterapia', 'Fonoaudiologia', 'Nutrição', 'Psicologia', 'Serviço Social'];
const SADT = ['Biópsia de Colo Uterino', 'Cardiotocografia', 'Colposcopia', 'Ecocardiografia Fetal', 'Mamografia Bilateral', 'Histeroscopia Diagnóstica', 'Triagem Punção de Mama', 'USG (Geral, transvaginal, mamas, pélvico, etc)', 'USG Doppler Obstétrico', 'USG Morfológico'];

export const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const DEFAULT_SPECIALTIES: AmbSpecialty[] = [
  ...MEDICAS.map((name) => ({ id: slug(name), name, group: 'medica' as const, active: true })),
  ...NAO_MEDICAS.map((name) => ({ id: slug(name), name, group: 'nao_medica' as const, active: true })),
  ...SADT.map((name) => ({ id: slug(name), name, group: 'sadt' as const, active: true })),
];

/** Only high-risk pregnancy goes through acolhimento in the ambulatory; everything else goes straight to care. */
export const ambulatoryNeedsTriage = (specialty: string) => slug(specialty) === 'gestacao-de-alto-risco';

const OBSTETRIC = ['gestacao-de-alto-risco', 'cardiotocografia', 'usg-doppler-obstetrico', 'usg-morfologico', 'ecocardiografia-fetal'];
/** Ambulatory nursing pre-consult: obstetric specialties always, others only when flagged at registration/agenda. */
export const isObstetricSpecialty = (specialty: string) => OBSTETRIC.includes(slug(specialty)) || /obstetr/i.test(specialty);
export const needsNursingPreConsult = (e: { type: string; specialty: string; nursingPreConsult?: boolean }) => e.type === 'Ambulatório' && (!!e.nursingPreConsult || isObstetricSpecialty(e.specialty));

export function addSpecialty(list: AmbSpecialty[], name: string, group: SpecialtyGroup): AmbSpecialty[] {
  const n = name.trim();
  if (!n) throw new Error('Informe o nome da especialidade.');
  if (list.some((s) => slug(s.name) === slug(n))) throw new Error('Especialidade já cadastrada.');
  return [...list, { id: slug(n), name: n, group, active: true }];
}
