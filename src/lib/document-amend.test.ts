import { describe, expect, it } from 'vitest';
import { amendIssue, documentGaps } from './document-amend';
import type { Patient } from './hospital-data';
import type { Encounter } from './care-flow';

const p = { id: 'p', name: 'X', cpf: '—', type: 'adulto' } as unknown as Patient;
const e = { id: 'e', number: 'BAA-1', history: [] } as unknown as Encounter;
describe('retificação de documentos', () => {
  it('lista números faltando; AIH só em internação', () => {
    expect(documentGaps(p, e)).toEqual(['cns', 'cityCode', 'cid', 'sigtapCode', 'cpf']);
    expect(documentGaps(p, { ...e, fia: { number: 'FIA-1' } } as Encounter)).toContain('aihNumber');
  });
  it('valida quantidade de dígitos', () => {
    expect(amendIssue('cns', '123')).toMatch(/15 dígitos/);
    expect(amendIssue('cns', '123456789012345')).toBeNull();
    expect(amendIssue('aihNumber', '4226100000001')).toBeNull();
  });
});
