import { describe, it, expect } from 'vitest';
import { searchCid, defaultSpecialty } from './cid10';
describe('cid10', () => {
  it('busca sem acento por nome', () => expect(searchCid('ictericia')[0].code).toBe('P59'));
  it('busca por código', () => expect(searchCid('o80')[0].code).toBe('O80'));
  it('gestante abre obstetrícia', () => expect(defaultSpecialty('gestante')).toBe('obstetricia'));
});
