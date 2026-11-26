import { describe, expect, it } from 'vitest';
import { AMBULATORY_PRESETS, buildInfoSusProcedures, matchPatientsForSadt, RECEPTION_SADT_EXAMS } from './sadt-reception';
import type { Patient } from './hospital-data';

const pat = (overrides: Partial<Patient>): Patient => ({
  id: 'p1', prontuario: 'PR-1', name: 'Ana Silva', cpf: '111.222.333-44', age: '28 anos',
  motherName: 'Maria Souza', guardian: '', type: 'gestante', insurance: 'SUS', authorized: true,
  ward: 'PSO', bed: '', admission: '01/11/2026', weight: 65, allergies: [], risks: [],
  diagnosis: '', days: 1, evolutions: [], vitals: [], prescriptions: [],
  ...overrides,
});

describe('sadt-reception', () => {
  it('inclui os 4 exames rápidos da recepção com códigos SIGTAP oficiais', () => {
    expect(RECEPTION_SADT_EXAMS.map((e) => e.shortCode)).toEqual(['205020186', '205020143', '205020151', '205010032']);
  });

  it('localiza paciente pelo nome da mãe e data de nascimento', () => {
    const p1 = pat({ id: 'p1', name: 'RN de Maria', motherName: 'Maria das Dores', registration: { birthDate: '2026-11-10' } as NonNullable<Patient['registration']> });
    const p2 = pat({ id: 'p2', name: 'João', motherName: 'Joana Lima', registration: { birthDate: '2026-10-05' } as NonNullable<Patient['registration']> });
    expect(matchPatientsForSadt([p1, p2], 'Maria das Dores', '2026-11-10').map((x) => x.id)).toEqual(['p1']);
  });

  it('gera procedimentos INFO SUS para Teste da Orelhinha e Punção de Mama', () => {
    const orelhinha = AMBULATORY_PRESETS.find((p) => p.id === 'orelhinha')!;
    const puncao = AMBULATORY_PRESETS.find((p) => p.id === 'puncao_mama')!;
    expect(orelhinha.mainSigtap.code).toBe('0211070149');
    expect(orelhinha.professional).toBe('DANIELA BURTET MACHADO');
    expect(puncao.mainSigtap.code).toBe('0301010072');
    expect(puncao.professional).toBe('MELISSA GAMA DE MESQUITA');
    const extras = buildInfoSusProcedures(puncao, ['0201010607'], 'Recepção', '2026-11-26T15:00:00Z');
    expect(extras).toHaveLength(1);
    expect(extras[0]?.code).toBe('0201010607');
  });
});