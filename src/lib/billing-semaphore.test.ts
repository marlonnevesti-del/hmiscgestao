import { describe, expect, it } from 'vitest';
import { semaphoreOf, semaphoreSummary } from './billing-semaphore';

describe('semaphoreOf', () => {
  it('blocks patient-data issues', () => expect(semaphoreOf(['Paciente sem CNS (15 dígitos)'])).toBe('red'));
  it('warns about professional CNS', () => expect(semaphoreOf(['Profissional sem CNS'])).toBe('yellow'));
  it('warns about default SIGTAP', () => expect(semaphoreOf([], { defaultProcedure: true })).toBe('yellow'));
  it('warns about document gaps', () => expect(semaphoreOf([], { gaps: ['aih'] })).toBe('yellow'));
  it('clean rows are green', () => expect(semaphoreOf([])).toBe('green'));
  it('patient issue wins', () => expect(semaphoreOf(['Sem CID-10', 'Profissional sem CNS'])).toBe('red'));
});
describe('semaphoreSummary', () => {
  it('counts levels', () => expect(semaphoreSummary([{ level: 'red' }, { level: 'green' }, { level: 'green' }])).toEqual({ red: 1, yellow: 0, green: 2 }));
});
