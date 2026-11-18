import { describe, expect, it } from 'vitest';
import { loadSigtap, searchSigtap } from './sigtap';
describe('sigtap', () => {
  it('carrega a tabela oficial inteira', async () => { expect((await loadSigtap()).length).toBe(5068); });
  it('encontra parto normal pelo nome', async () => {
    expect(searchSigtap(await loadSigtap(), 'parto normal', { aihOnly: true }).some((p) => p.c === '0310010039')).toBe(true);
  });
  it('busca por código com pontos', async () => {
    expect(searchSigtap(await loadSigtap(), '03.03.01.003-7')[0]?.c).toBe('0303010037');
  });
});
