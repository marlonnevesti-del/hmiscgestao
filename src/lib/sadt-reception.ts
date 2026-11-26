// Regras e catálogos do fluxo SADT / Recepção (Solicitação de Exames, Teste da Orelhinha e Punção de Mama).
import type { AmbulatoryMotive } from './ambulatorio';
import type { ExtraProcedure } from './care-flow';
import type { Patient } from './hospital-data';

export interface ReceptionSadtExam {
  code: string;
  shortCode: string;
  name: string;
  specialty: string;
}

export const RECEPTION_SADT_EXAMS: readonly ReceptionSadtExam[] = [
  { code: '0205020186', shortCode: '205020186', name: 'Ultrassom transvaginal', specialty: 'USG (Geral, transvaginal, mamas, pélvico, etc)' },
  { code: '0205020143', shortCode: '205020143', name: 'Ultrassom obstétrico', specialty: 'USG (Geral, transvaginal, mamas, pélvico, etc)' },
  { code: '0205020151', shortCode: '205020151', name: 'Ultrassom obstétrico com Doppler', specialty: 'USG Doppler Obstétrico' },
  { code: '0205010032', shortCode: '205010032', name: 'Ecocardiografia transtorácica (ecocardiograma fetal)', specialty: 'Ecocardiografia Fetal' },
];

export interface InfoSusOption {
  code: string;
  shortCode: string;
  name: string;
}

export interface AmbulatoryPreset {
  id: 'orelhinha' | 'puncao_mama';
  label: string;
  sector: string;
  room: string;
  professional: string;
  motive: AmbulatoryMotive;
  specialty: string;
  patientType: Patient['type'];
  mainSigtap: InfoSusOption;
  infoSus: readonly InfoSusOption[];
}

export const AMBULATORY_PRESETS: readonly AmbulatoryPreset[] = [
  {
    id: 'orelhinha',
    label: 'Teste da Orelhinha',
    sector: 'Consultório Fono',
    room: 'Sala Fonoaudióloga',
    professional: 'DANIELA BURTET MACHADO',
    motive: 'CONSULTA',
    specialty: 'Fonoaudiologia',
    patientType: 'neonato',
    mainSigtap: { code: '0211070149', shortCode: '211070149', name: 'Emissões otoacústicas evocadas para triagem auditiva (Teste da Orelhinha)' },
    infoSus: [
      { code: '0211070084', shortCode: '211070084', name: 'Avaliação miofuncional do sistema estomatognático' },
      { code: '0211070050', shortCode: '211070050', name: 'Avaliação auditiva comportamental' },
      { code: '0301010048', shortCode: '301010048', name: 'Consulta de profissional de nível superior na atenção especializada (exceto médico)' },
      { code: '0211070270', shortCode: '211070270', name: 'Potencial evocado auditivo para triagem auditiva (Teste da Orelhinha)' },
    ],
  },
  {
    id: 'puncao_mama',
    label: 'Punção de Mama',
    sector: 'Consultório Ambulatório',
    room: 'Sala de Procedimentos',
    professional: 'MELISSA GAMA DE MESQUITA',
    motive: 'EXAME DE MAMA',
    specialty: 'Triagem Punção de Mama',
    patientType: 'gestante',
    mainSigtap: { code: '0301010072', shortCode: '301010072', name: 'Consulta médica em atenção especializada' },
    infoSus: [
      { code: '0201010607', shortCode: '201010607', name: 'Punção de mama por agulha grossa' },
      { code: '0201010585', shortCode: '201010585', name: 'Punção aspirativa de mama por agulha fina' },
    ],
  },
];

export function matchPatientsForSadt(patients: Patient[], query: string, birthFilter = ''): Patient[] {
  const q = query.trim().toLowerCase();
  const b = birthFilter.trim();
  if (!q && !b) return [];
  return patients.filter((p) => {
    const birth = p.registration?.birthDate ?? '';
    if (b && !birth.includes(b) && !(p.age ?? '').includes(b)) return false;
    if (!q) return true;
    const fields = [p.name, p.motherName ?? '', p.registration?.parent1 ?? '', p.cpf, p.prontuario, p.registration?.cns ?? ''];
    return fields.some((v) => v.toLowerCase().includes(q));
  }).slice(0, 8);
}

export function buildInfoSusProcedures(preset: AmbulatoryPreset, selectedCodes: string[], by: string, at: string): ExtraProcedure[] {
  const set = new Set(selectedCodes);
  return preset.infoSus
    .filter((item) => set.has(item.code))
    .map((item) => ({ id: crypto.randomUUID(), code: item.code, name: item.name, at, by }));
}