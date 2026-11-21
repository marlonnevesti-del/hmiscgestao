import { describe, it, expect } from 'vitest';
import { sigtapGlosas, type SigtapRules } from './sigtap-compat';
const rules: SigtapRules = { cid: { '0411010034': ['O820', 'O829'] }, perm: { '0411010034': 2 } };
const ces = { c: '0411010034', n: 'PARTO CESARIANO', s: 'F', i: 120, x: 780, v: 0, r: ['03'] };
const base = { cid: 'O820', sex: 'F', birthDate: '1995-01-01', date: '2026-11-01' };
describe('sigtapGlosas', () => {
  it('CID compatível sem glosa', () => expect(sigtapGlosas(rules, ces, base)).toEqual([]));
  it('CID fora da lista do procedimento', () => expect(sigtapGlosas(rules, ces, { ...base, cid: 'R10' })[0]).toContain('incompatível'));
  it('sexo masculino em procedimento feminino', () => expect(sigtapGlosas(rules, ces, { ...base, sex: 'M' })).toContain('Procedimento exclusivo do sexo feminino'));
  it('idade abaixo da mínima', () => expect(sigtapGlosas(rules, ces, { ...base, birthDate: '2020-01-01' }).some((x) => x.includes('mínima'))).toBe(true));
  it('permanência acima do dobro', () => expect(sigtapGlosas(rules, ces, { ...base, days: 5 }).some((x) => x.includes('Permanência'))).toBe(true));
});
