import { describe, expect, it } from 'vitest';
import { ICU_EXAMPLES, exampleBillingChecks, exampleChartId, exampleForChart, trainingSearch } from './icu-examples';

describe('casos didáticos de internação', () => {
  it('resolve os três prontuários virtuais sem aceitar IDs de pacientes reais', () => {
    expect(ICU_EXAMPLES).toHaveLength(3);
    for (const example of ICU_EXAMPLES) {
      expect(exampleForChart(exampleChartId(example.unit))).toBe(example);
    }
    expect(exampleForChart('paciente-real-123')).toBeUndefined();
    expect(exampleForChart('treinamento-uti-invalido')).toBeUndefined();
  });
  it('mantém a navegação real como padrão e valida a unidade de treinamento', () => {
    expect(trainingSearch({})).toEqual({ treinamento: false, caso: 'UTIN' });
    expect(trainingSearch({ treinamento: 'true', caso: 'UTIP' })).toEqual({ treinamento: true, caso: 'UTIP' });
    expect(trainingSearch({ treinamento: true, caso: 'UCI' })).toEqual({ treinamento: true, caso: 'UCI' });
    expect(trainingSearch({ treinamento: 'false', caso: 'invalido' })).toEqual({ treinamento: false, caso: 'UTIN' });
  });
  it('prepara um caso de cada unidade sem identidade de paciente ou leito real', () => {
    expect(ICU_EXAMPLES.map((e) => e.unit).sort()).toEqual(['UCI', 'UTIN', 'UTIP']);
    for (const example of ICU_EXAMPLES) {
      expect(example).not.toHaveProperty('patientId');
      expect(example).not.toHaveProperty('bedId');
      expect(example).not.toHaveProperty('aihNumero');
      expect(example).not.toHaveProperty('sigtapCode');
    }
  });
  it('mantém transferência interna neonatal distinta da alta hospitalar', () => {
    const neo = ICU_EXAMPLES.find((e) => e.unit === 'UTIN');
    if (!neo) throw new Error('Caso UTIN ausente');
    expect(exampleBillingChecks(neo).find((c) => c.item === 'Alta hospitalar e fechamento da FIA')?.status).toBe('Pendente: transferência interna não é alta');
    for (const example of ICU_EXAMPLES.filter((e) => e.unit !== 'UTIN')) {
      expect(exampleBillingChecks(example).find((c) => c.item === 'Alta hospitalar e fechamento da FIA')?.status).toBe('Ilustrado');
    }
  });
});