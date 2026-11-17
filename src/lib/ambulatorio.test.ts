import { describe, expect, it } from 'vitest';
import { addSpecialty, ambulatoryNeedsTriage, DEFAULT_SPECIALTIES } from './ambulatorio';
describe('ambulatório', () => {
  it('only Gestação de Alto Risco needs acolhimento', () => {
    expect(ambulatoryNeedsTriage('Gestação de Alto Risco')).toBe(true);
    expect(ambulatoryNeedsTriage('Cardiologia Pediátrica')).toBe(false);
    expect(ambulatoryNeedsTriage('USG Morfológico')).toBe(false);
  });
  it('ships 19 medical, 6 non-medical and 10 SADT specialties', () => {
    expect(DEFAULT_SPECIALTIES.filter((s) => s.group === 'medica')).toHaveLength(19);
    expect(DEFAULT_SPECIALTIES.filter((s) => s.group === 'nao_medica')).toHaveLength(6);
    expect(DEFAULT_SPECIALTIES.filter((s) => s.group === 'sadt')).toHaveLength(10);
  });
  it('rejects duplicate specialty names', () => {
    expect(() => addSpecialty(DEFAULT_SPECIALTIES, 'genetica', 'medica')).toThrow();
  });
});
