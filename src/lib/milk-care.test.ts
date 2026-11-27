import { beforeEach, describe, expect, it } from 'vitest';
import { getState, saveMilkCare, setState } from './hospital-store';
import type { Encounter } from './care-flow';
import type { Patient } from './hospital-data';
import { buildSusRows } from './sus-billing';

const patient: Patient = { id: 'blh-test', prontuario: 'test', name: 'Teste isolado BLH', cpf: '', type: 'puerpera', age: '25 anos', weight: 60, allergies: [], risks: [], ward: 'AC', bed: '', insurance: 'SUS', authorized: true, diagnosis: '', admission: '', days: 0, evolutions: [], vitals: [], prescriptions: [] };
const encounter: Encounter = { id: 'blh-e', patientId: patient.id, number: 'BAA-2026-000001', type: 'Ambulatório', specialty: 'Banco de Leite', complaint: '', status_fluxo: 'AGUARDANDO_MEDICO', openedAt: '2026-11-27T12:00:00Z', history: [] };
const input = { reason: 'Cadastro de Doadora', assessment: 'Avaliação clínica', conduct: 'Orientação', plan: 'Retorno', cid: 'Z391', council: 'COREN 123', consultationCode: '0301010048', procedures: [] };
beforeEach(() => setState(() => ({ profile: 'Administrador', accessAreas: null, employeeName: 'Profissional teste', patients: [patient], encounters: [encounter] })));
describe('assistência BLH', () => {
  it('salva evolução no PEP e encerra apenas o BAA do BLH', () => {
    saveMilkCare(encounter.id, input, true);
    expect(getState().encounters[0]?.status_fluxo).toBe('ALTA_HOSPITALAR');
    expect(getState().patients[0]?.evolutions).toHaveLength(1);
    expect(getState().encounters[0]?.milkCare?.[0]?.council).toBe('COREN 123');
  });
  it('enfermagem registra consulta não médica e não inventa os sete exames', () => {
    setState(() => ({ profile: 'Enfermeiro' }));
    saveMilkCare(encounter.id, input, true);
    const rows = buildSusRows(getState().encounters, getState().patients, '202611', { name: 'Enfermeiro', cns: '', cbo: '' });
    expect(rows.map((r) => r.procedure)).toEqual(['0301010048']);
  });
  it('exames confirmados como realizados entram no BPA', () => {
    saveMilkCare(encounter.id, { ...input, procedures: [{ id: 'ex', code: '0202020380', name: 'Exame confirmado', at: '', by: '' }] }, true);
    const rows = buildSusRows(getState().encounters, getState().patients, '202611', { name: '', cns: '', cbo: '' });
    expect(rows.map((r) => r.procedure)).toEqual(['0301010048', '0202020380']);
  });
  it('não encerra internação nem altera seu CID ou procedimento principal', () => {
    setState(() => ({ encounters: [{ ...encounter, type: 'Maternidade', specialty: 'Obstetrícia', status_fluxo: 'ENCAMINHADO_INTERNACAO', sigtapCode: '0303010037', medical: { cid: 'O80', anamnesis: '', exam: '', diagnosis: '' } }] }));
    expect(() => saveMilkCare(encounter.id, input, true)).toThrow();
    saveMilkCare(encounter.id, input);
    expect(getState().encounters[0]?.status_fluxo).toBe('ENCAMINHADO_INTERNACAO');
    expect(getState().encounters[0]?.medical?.cid).toBe('O80');
    expect(getState().encounters[0]?.sigtapCode).toBe('0303010037');
  });
  it('recepção não pode salvar evolução clínica', () => {
    setState(() => ({ profile: 'Recepção' }));
    expect(() => saveMilkCare(encounter.id, input)).toThrow();
  });
});