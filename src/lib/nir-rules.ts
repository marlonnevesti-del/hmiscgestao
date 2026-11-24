import { ageYears, newbornBirthIssue } from "./patient-registration";

export type NirAgePatient = {
  birthDate?: string | undefined;
  age?: string | undefined;
  type?: string | undefined;
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

function parseYearsFromText(age?: string): number | null {
  if (!age) return null;
  const m = age.match(/(\d+)\s*ano/i);
  return m ? Number(m[1]) : null;
}

function parseDaysFromText(age?: string): number | null {
  if (!age) return null;
  if (/\d+\s*(ano|m[eê]s)/i.test(age)) return 999;
  const m = age.match(/(\d+)\s*dia/i);
  return m ? Number(m[1]) : null;
}

/**
 * Valida se o paciente tem faixa etária compatível com o leito/setor de destino no NIR.
 * - UTI Neonatal / Berçário: até 28 dias de vida.
 * - UTI Pediátrica / Enfermaria Pediátrica / Pediatria: até 14 anos completos.
 */
export function bedAgeIssue(
  patient: NirAgePatient | undefined,
  bedCode: string,
  sectorName = "",
  today = new Date(),
): string | null {
  if (!patient) return null;
  const label = norm(`${bedCode} ${sectorName}`);

  const isNeonatal = /\bUTIN\b|UTI\s*NEO|NEONAT|BERCARIO/.test(label);
  if (isNeonatal) {
    if (patient.birthDate) {
      const issue = newbornBirthIssue(patient.birthDate, today);
      if (issue) return `Leito neonatal (${bedCode}) é exclusivo para recém-nascidos de até 28 dias.`;
      return null;
    }
    const days = parseDaysFromText(patient.age);
    if (days !== null && days > 28) {
      return `Leito neonatal (${bedCode}) é exclusivo para recém-nascidos de até 28 dias.`;
    }
    return null;
  }

  const isPediatric = /\bUTIP\b|UTIPED|UTI\s*PED|\bENFP\b|PEDIAT/.test(label);
  if (isPediatric) {
    const years = patient.birthDate ? ageYears(patient.birthDate, today) : parseYearsFromText(patient.age);
    if (years !== null && years > 14) {
      return `Paciente com ${years} anos excede o limite de 14 anos para leito pediátrico (${bedCode}).`;
    }
  }

  return null;
}