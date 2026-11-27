import { describe, expect, it } from 'vitest';
import { PS_BEDS, SCALES, outcomeGoalMin, outcomeStatus, psReport, scaleTotal, type PsEncounter } from './ps-infantil';

const enc = (over: Partial<PsEncounter>): PsEncounter => ({ id: 'e', number: 'BAA-1', patientId: 'p', status_fluxo: 'ALTA_HOSPITALAR', openedAt: '2026-10-05T08:00:00', type: 'Pronto socorro', specialty: '', complaint: '', history: [], ...over });
describe('PS Infantil', () => {
  it('15 leitos incluindo isolamentos', () => { expect(PS_BEDS).toHaveLength(15); expect(PS_BEDS).toContain('Isolamento 2'); });
  it('meta diurna 6h e noturna 12h', () => { expect(outcomeGoalMin('2026-10-05T08:00:00')).toBe(360); expect(outcomeGoalMin('2026-10-05T20:00:00')).toBe(720); expect(outcomeGoalMin('2026-10-05T03:00:00')).toBe(720); });
  it('sinaliza desfecho estourado', () => expect(outcomeStatus(enc({ status_fluxo: 'AGUARDANDO_MEDICO' }), '2026-10-05T15:00:00')).toBe('estourado'));
  it('PEWS soma itens', () => { const pews = SCALES.find((s) => s.id === 'pews')!; expect(scaleTotal(pews, [1, 1, 1])).toBe(3); expect(pews.interpret(3)).toMatch(/Atenção/); });
  it('Humpty Dumpty ≥12 é alto risco', () => expect(SCALES.find((s) => s.id === 'humpty')!.interpret(12)).toMatch(/Alto/));
  it('Braden Q soma 28 para baixo risco e ≤16 para alto risco', () => {
    const b = SCALES.find((s) => s.id === 'bradenq')!;
    expect(b.items).toHaveLength(7);
    expect(scaleTotal(b, [0, 0, 0, 0, 0, 0, 0])).toBe(28);
    expect(b.interpret(28)).toBe('Baixo risco');
    expect(b.interpret(20)).toBe('Risco moderado');
    expect(b.interpret(16)).toMatch(/Alto risco/);
  });
  it('laranja chamado em 20 min fica fora do prazo de 15 min e só conta o PS', () => {
    const triage = { risk: 'laranja' } as NonNullable<PsEncounter['triage']>;
    const e = enc({ triage, history: [{ status: 'AGUARDANDO_MEDICO', at: '2026-10-05T08:10:00', by: '', note: '' }, { status: 'EM_ATENDIMENTO_MEDICO', at: '2026-10-05T08:30:00', by: '', note: '' }, { status: 'ALTA_HOSPITALAR', at: '2026-10-05T10:00:00', by: '', note: '' }] });
    const r = psReport([e, enc({ id: 'x', type: 'Maternidade' })], [], [], '2026-10');
    expect(r.total).toBe(1); expect(r.doctorOutside).toBe(1); expect(r.diurno.inside).toBe(1);
  });
  it('evasão conta no percentual', () => { const r = psReport([enc({ ps: { evasion: { at: '', by: '', note: '' } } }), enc({ id: 'b' })], [], [], '2026-10'); expect(r.evasionRate).toBe(50); });
});
