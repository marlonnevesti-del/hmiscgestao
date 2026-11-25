/** Default is a suggestion for the medical consultation, never proof of execution. */
export const DEFAULT_MEDICAL_SIGTAP = '0301010072';
export const DEFAULT_TRIAGE_SIGTAP = '0301060118';
export const medicalSigtapCode = (code?: string) => code ?? DEFAULT_MEDICAL_SIGTAP;
export const validMedicalSigtap = (code: string) => /^\d{10}$/.test(code);
export function requireMedicalSigtap(code: string) {
  if (!validMedicalSigtap(code)) throw new Error('Informe o procedimento SIGTAP para concluir o atendimento.');
}