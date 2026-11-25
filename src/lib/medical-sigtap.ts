/** Default is a suggestion for the medical consultation, never proof of execution. */
export const DEFAULT_MEDICAL_SIGTAP = '0301010072';
export const DEFAULT_TRIAGE_SIGTAP = '0301060118';
export const TRIAGE_PA_SIGTAP = '0301100039';
export const TRIAGE_TEMP_SIGTAP = '0301100250';
export const TRIAGE_ANTHRO_SIGTAP = '0101040024';

export interface TriageDetectedProcedure {
  code: string;
  name: string;
}

export function detectTriageProcedures(input: {
  pas?: number | string;
  pad?: number | string;
  tax?: number | string;
  weight?: number | string;
  height?: number | string;
  head?: number | string;
}): TriageDetectedProcedure[] {
  const hasPos = (v?: number | string) => {
    if (v === undefined || v === null || v === '') return false;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n > 0;
  };
  const list: TriageDetectedProcedure[] = [];
  if (hasPos(input.pas) || hasPos(input.pad)) list.push({ code: TRIAGE_PA_SIGTAP, name: 'AFERIÇÃO DE PRESSÃO ARTERIAL' });
  if (hasPos(input.tax)) list.push({ code: TRIAGE_TEMP_SIGTAP, name: 'AFERIÇÃO DE TEMPERATURA' });
  if (hasPos(input.weight) || hasPos(input.height) || hasPos(input.head)) list.push({ code: TRIAGE_ANTHRO_SIGTAP, name: 'AVALIAÇÃO ANTROPOMÉTRICA' });
  return list;
}

export const medicalSigtapCode = (code?: string) => code ?? DEFAULT_MEDICAL_SIGTAP;
export const validMedicalSigtap = (code: string) => /^\d{10}$/.test(code);
export function requireMedicalSigtap(code: string) {
  if (!validMedicalSigtap(code)) throw new Error('Informe o procedimento SIGTAP para concluir o atendimento.');
}