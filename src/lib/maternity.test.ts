import { describe, expect, it, beforeEach } from 'vitest';
import { BIRTH_PHASES, BISHOP_FIELDS, HPP_FACTORS, SILVERMAN_FIELDS, fieldTotal, hppRisk, maternityResult, meowsTriggers } from './maternity';
import { canAccessUnitTab, type Patient } from './hospital-data';
import { getState, saveMaternityRecord, setState } from './hospital-store';
import type { Encounter } from './care-flow';

const meows = { fr: '16', sat: '98', temp: '37', pas: '120', pad: '70', fc: '80', pain: '0', avpu: 'A' };
const hpp = Object.fromEntries(HPP_FACTORS.map((f) => [f.id, 'nao']));
describe('Escalas obstétricas versionadas', () => {
  it('Bishop completo soma 13, sem converter em ordem de indução', () => expect(fieldTotal(BISHOP_FIELDS, { dilation: '3', effacement: '3', station: '3', consistency: '2', position: '2' })).toBe(13));
  it('Bishop distingue desfavorável até 5 e favorável acima de 8', () => {
    expect(maternityResult('bishop', { dilation: '1', effacement: '1', station: '1', consistency: '1', position: '1' })).toContain('desfavorável');
    expect(maternityResult('bishop', { dilation: '3', effacement: '3', station: '3', consistency: '0', position: '0' })).toContain('favorável');
  });
  it('Silverman soma cinco itens de 0 a 2, máximo 10', () => expect(fieldTotal(SILVERMAN_FIELDS, { chest: '2', intercostal: '2', xiphoid: '2', nasal: '2', grunting: '2' })).toBe(10));
  it('dados ausentes não viram escore zero ou risco baixo', () => {
    expect(() => fieldTotal(BISHOP_FIELDS, {})).toThrow(); expect(() => hppRisk({})).toThrow(); expect(() => meowsTriggers({})).toThrow();
  });
  it('MEOWS um vermelho aciona avaliação', () => expect(meowsTriggers({ ...meows, sat: '94' })).toEqual({ red: 1, yellow: 0, alert: true }));
  it('MEOWS dois amarelos acionam avaliação e um isolado não', () => {
    expect(meowsTriggers({ ...meows, fc: '100' })).toEqual({ red: 0, yellow: 1, alert: false });
    expect(meowsTriggers({ ...meows, fc: '100', fr: '21' })).toEqual({ red: 0, yellow: 2, alert: true });
  });
  it('MEOWS mantém limites 30 irpm e 160 mmHg amarelos, acima vermelhos', () => {
    expect(meowsTriggers({ ...meows, fr: '30', pas: '160' }).red).toBe(0);
    expect(meowsTriggers({ ...meows, fr: '31', pas: '161' }).red).toBe(2);
  });
  it('HPP dois fatores médios são alto risco e um é médio', () => {
    expect(hppRisk({ ...hpp, uterine: 'sim' })).toBe('Médio');
    expect(hppRisk({ ...hpp, uterine: 'sim', multiple: 'sim' })).toBe('Alto');
  });
  it('HPP qualquer fator alto eleva o risco, avaliação negativa completa é baixo', () => {
    expect(hppRisk(hpp)).toBe('Baixo'); expect(hppRisk({ ...hpp, severePlatelets: 'sim' })).toBe('Alto');
  });
  it('checklist possui quatro momentos e aceita pendência sem considerar concluído', () => {
    expect(BIRTH_PHASES).toHaveLength(4);
    expect(maternityResult('checklist', { phase: 'alta', ...Object.fromEntries((BIRTH_PHASES.find((p) => p.id === 'alta')?.items ?? []).map((_, i) => [String(i), 'pendente'])) })).toContain('6 pendência(s)');
  });
  it('enfermagem e médico veem assistência por função, recepção não; área explícita é respeitada', () => {
    expect(canAccessUnitTab('Enfermeiro', 'maternidade', 'assistencia')).toBe(true);
    expect(canAccessUnitTab('Médico', 'maternidade', 'assistencia')).toBe(true);
    expect(canAccessUnitTab('Recepção', 'maternidade', 'assistencia')).toBe(false);
    expect(canAccessUnitTab('Enfermeiro', 'maternidade', 'assistencia', ['maternidade:recepcao'])).toBe(false);
  });
});

const mother = { id: 'maternal', name: 'Paciente de avaliação', type: 'gestante', babyIds: ['baby'] } as Patient;
const baby = { id: 'baby', name: 'RN vinculado', type: 'neonato', newborn: { motherId: 'maternal' } } as Patient;
const encounter: Encounter = { id: 'maternity', patientId: 'maternal', number: 'BAA-TEST', type: 'Maternidade', status_fluxo: 'EM_ATENDIMENTO_MEDICO', openedAt: '2026-11-24T10:00:00Z', specialty: '', complaint: '', history: [] };
describe('Registro compartilhado na Maternidade', () => {
  beforeEach(() => setState(() => ({ patients: [mother, baby], encounters: [encounter], profile: 'Enfermeiro', accessAreas: null, employeeName: 'Responsável de avaliação' })));
  it('preserva avaliações anteriores, autor e histórico no mesmo atendimento', () => {
    saveMaternityRecord('maternity', 'maternal', 'meows', meows, 'Reavaliar');
    saveMaternityRecord('maternity', 'maternal', 'hpp', hpp, '');
    const e = getState().encounters[0]; expect(e?.maternity).toHaveLength(2); expect(e?.history).toHaveLength(2); expect(e?.maternity?.[0]?.by).toBe('Responsável de avaliação');
  });
  it('Silverman usa exclusivamente o RN vinculado, não a mãe', () => {
    const values = { chest: '0', intercostal: '0', xiphoid: '0', nasal: '0', grunting: '0' };
    expect(() => saveMaternityRecord('maternity', 'maternal', 'silverman', values, '')).toThrow();
    expect(saveMaternityRecord('maternity', 'baby', 'silverman', values, '').patientId).toBe('baby');
  });
  it('não registra após alta nem em atendimento de outra unidade', () => {
    setState(() => ({ encounters: [{ ...encounter, type: 'Pronto socorro' }] })); expect(() => saveMaternityRecord('maternity', 'maternal', 'meows', meows, '')).toThrow();
    setState(() => ({ encounters: [{ ...encounter, status_fluxo: 'ALTA_HOSPITALAR' }] })); expect(() => saveMaternityRecord('maternity', 'maternal', 'meows', meows, '')).toThrow();
  });
  it('técnico de enfermagem permanece apenas visualizador', () => {
    setState(() => ({ profile: 'Técnico de enfermagem' })); expect(() => saveMaternityRecord('maternity', 'maternal', 'meows', meows, '')).toThrow();
  });
  it('registrar escala mantém paciente na fila de triagem', () => {
    setState(() => ({ encounters: [{ ...encounter, status_fluxo: 'AGUARDANDO_TRIAGEM' }], queue: [{ id: 'maternity', name: mother.name, group: 'obstetrica', complaint: '', arrivedMinAgo: 0, detail: '' }] }));
    saveMaternityRecord('maternity', 'maternal', 'meows', meows, '');
    expect(getState().queue.map((q) => q.id)).toEqual(['maternity']);
    expect(getState().encounters[0]?.status_fluxo).toBe('AGUARDANDO_TRIAGEM');
  });
});