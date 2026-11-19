import { describe, it, expect } from 'vitest';
import { UNITS, balance, NIPS, SILVERMAN, COMFORT_B, bundleAdherencePct } from './uti-uci';
describe('UTI Pediátrica x UCI', () => {
  it('UTI Ped usa COMFORT-B e PEWS; UCI usa Silverman e NIPS', () => {
    const utip = UNITS.UTIP.scales.map((s) => s.id), uci = UNITS.UCI.scales.map((s) => s.id);
    expect(utip).toContain('comfortb'); expect(utip).toContain('pews'); expect(utip).not.toContain('nips');
    expect(uci).toContain('silverman'); expect(uci).toContain('nips'); expect(uci).not.toContain('comfortb');
  });
  it('UCI tem evolução do Lactário; UTI Ped não', () => {
    expect(Object.keys(UNITS.UCI.evolutions)).toContain('Lactário / Nutrição');
    expect(Object.keys(UNITS.UTIP.evolutions)).not.toContain('Lactário / Nutrição');
  });
  it('calcula débito urinário ml/kg/h e oligúria', () => {
    const r = balance({ inputs: { a: 300 }, outputs: { Diurese: 60 }, weightKg: 10, hours: 12 });
    expect(r.net).toBe(240); expect(r.debito).toBe(0.5); expect(r.oliguria).toBe(true);
  });
  it('interpretações das escalas', () => {
    expect(NIPS.interpret(4)).toMatch(/Dor/); expect(SILVERMAN.interpret(0)).toBe('Sem desconforto');
    expect(COMFORT_B.interpret(15)).toBe('Sedação adequada');
  });
  it('adesão ao bundle', () => { expect(bundleAdherencePct({ checks: ['a', 'b'], total: 4 })).toBe(50); });
});

import { weightBand, igBand, neoReport } from './uti-uci';
describe('UTI Neonatal', () => {
  it('classifica peso ao nascer', () => { expect(weightBand(950)).toBe('< 1.000 g'); expect(weightBand(1499)).toBe('1.000–1.499 g'); expect(weightBand(2500)).toBe('≥ 2.500 g'); });
  it('classifica idade gestacional', () => { expect(igBand(27)).toBe('< 28 sem'); expect(igBand(36)).toBe('32–36 sem'); });
  it('conta internações e extubação acidental do mês', () => {
    const r = neoReport([{ intensive: { neo: [
      { id: '1', at: '2026-11-02T10:00:00Z', by: 'x', type: 'recebimento', data: { pesoNasc: '1200', ig: '30' } },
      { id: '2', at: '2026-11-05T10:00:00Z', by: 'x', type: 'dispositivo', data: { acao: 'Extubação acidental' } },
      { id: '3', at: '2026-10-05T10:00:00Z', by: 'x', type: 'recebimento', data: {} },
    ] } }], '2026-11');
    expect(r.admissions).toBe(1); expect(r.extubacao).toBe(1); expect(r.peso['1.000–1.499 g']).toBe(1);
  });
});
