import { beforeEach, describe, expect, it } from 'vitest';
import type { Patient } from './hospital-data';
import { callPatient, finishEncounter, getState, openEncounter, requestAdmission, saveMedical, setMedicalSigtapCode, setState } from './hospital-store';
import { medicalSigtapCode } from './medical-sigtap';
import { loadSigtap } from './sigtap';

const patient: Patient = { id: 'sigtap-test', prontuario: '1', name: 'Teste SIGTAP', cpf: '', type: 'pediatria', age: '5 anos', weight: 20, allergies: [], risks: [], ward: 'PSP', bed: '', insurance: 'SUS', authorized: true, diagnosis: '', admission: '', days: 1, evolutions: [], vitals: [], prescriptions: [] };
const medical = { anamnesis: 'Dor', exam: 'Exame físico', cid: 'R52', diagnosis: 'Dor' };
const details = { summary: 'Estável', recipe: '', exam: 'Laboratório' };
const admission = { ward: '', character: 'Urgência' as const, cid: 'R52', justification: 'Avaliação', isolation: false, oxygen: false };
let id = '';
beforeEach(() => {
  setState(() => ({ profile: 'Administrador', employeeName: 'Profissional de teste', accessAreas: null, patients: [], encounters: [], queue: [], surgeries: [], beSequence: 0 }));
  id = openEncounter(patient, 'Ambulatório', 'Pediatria', 'Dor').id;
  callPatient(id);
});
describe('SIGTAP obrigatório no atendimento médico — opção A', () => {
  it('persiste a sugestão 0301010072 ao iniciar a consulta', () => {
    expect(getState().encounters[0]?.sigtapCode).toBe('0301010072');
    expect(medicalSigtapCode(undefined)).toBe('0301010072');
  });
  it('confere a consulta sugerida no catálogo integrado', async () => {
    expect((await loadSigtap()).find((p) => p.c === '0301010072')?.n).toBe('CONSULTA MEDICA EM ATENÇÃO ESPECIALIZADA');
  });
  it('mantém o campo apagado mesmo após retomar a consulta', () => {
    setMedicalSigtapCode(id, '');
    setState((s) => ({ encounters: s.encounters.map((e) => e.id === id ? { ...e, status_fluxo: 'EM_OBSERVACAO_REAVALIACAO' } : e) }));
    callPatient(id);
    expect(getState().encounters[0]?.sigtapCode).toBe('');
    expect(medicalSigtapCode('')).toBe('');
  });
  it('bloqueia avaliação sem SIGTAP e não cria evolução', () => {
    setMedicalSigtapCode(id, '');
    expect(() => saveMedical(id, medical)).toThrow('Informe o procedimento SIGTAP');
    expect(getState().patients[0]?.evolutions).toHaveLength(0);
  });
  it.each(['alta', 'co', 'exames', 'internacao'] as const)('bloqueia o desfecho %s sem SIGTAP', (outcome) => {
    saveMedical(id, medical);
    setMedicalSigtapCode(id, '');
    expect(() => finishEncounter(id, outcome, details)).toThrow('Informe o procedimento SIGTAP');
    expect(getState().encounters[0]?.status_fluxo).toBe('EM_ATENDIMENTO_MEDICO');
    expect(getState().encounters[0]?.discharge).toBeUndefined();
  });
  it('bloqueia solicitação ao NIR sem SIGTAP', () => {
    setMedicalSigtapCode(id, '');
    expect(() => requestAdmission(id, admission)).toThrow('Informe o procedimento SIGTAP');
    expect(getState().encounters[0]?.admission).toBeUndefined();
  });
  it('recusa código com nove dígitos', () => {
    expect(() => setMedicalSigtapCode(id, '030106118')).toThrow('Informe o procedimento SIGTAP');
    expect(getState().encounters[0]?.sigtapCode).toBe('0301010072');
  });
  it('preserva a seleção alterada ao salvar e finalizar', () => {
    setMedicalSigtapCode(id, '0301010048');
    saveMedical(id, medical);
    finishEncounter(id, 'alta', details);
    expect(getState().encounters[0]?.sigtapCode).toBe('0301010048');
    expect(getState().encounters[0]?.status_fluxo).toBe('ALTA_HOSPITALAR');
  });
});