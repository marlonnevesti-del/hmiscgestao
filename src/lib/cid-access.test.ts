import { describe, it, expect } from 'vitest';
import { DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS, addGroup, allowedGroups, areaFor, groupCodes } from './cid-access';
describe('cid-access', () => {
  it('enfermagem começa sem CID liberado', () => expect(allowedGroups(DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS, areaFor('Enfermeiro'), false)).toBeNull());
  it('médico vê os grupos liberados', () => expect(allowedGroups(DEFAULT_CID_AREAS, DEFAULT_CID_GROUPS, areaFor('Médico'), false)?.length).toBe(4));
  it('admin vê tudo', () => expect(allowedGroups([], DEFAULT_CID_GROUPS, 'x', true)?.length).toBe(4));
  it('grupo novo recebe CIDs do capítulo automaticamente', () => {
    const g = addGroup(DEFAULT_CID_GROUPS, 'Ortopedia', ['M00-M99']).at(-1)!;
    expect(groupCodes(g).map((c) => c.code)).toContain('M54');
  });
  it('área nova pela função Outro', () => expect(areaFor('Outro: Nutrição')).toBe('Nutrição'));
});
