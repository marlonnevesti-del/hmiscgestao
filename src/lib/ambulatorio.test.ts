import { describe, expect, it } from 'vitest';
import { addSpecialty, ambulatoryNeedsTriage, DEFAULT_SPECIALTIES } from './ambulatorio';
describe('ambulatório', () => {
  it('only Gestação de Alto Risco needs acolhimento', () => {
    expect(ambulatoryNeedsTriage('Gestação de Alto Risco')).toBe(true);
    expect(ambulatoryNeedsTriage('Cardiologia Pediátrica')).toBe(false);
    expect(ambulatoryNeedsTriage('USG Morfológico')).toBe(false);
  });
  it('ships 20 medical, 6 non-medical and 10 SADT specialties', () => {
    expect(DEFAULT_SPECIALTIES.filter((s) => s.group === 'medica')).toHaveLength(20);
    expect(DEFAULT_SPECIALTIES.filter((s) => s.group === 'nao_medica')).toHaveLength(6);
    expect(DEFAULT_SPECIALTIES.filter((s) => s.group === 'sadt')).toHaveLength(10);
  });
  it('rejects duplicate specialty names', () => {
    expect(() => addSpecialty(DEFAULT_SPECIALTIES, 'genetica', 'medica')).toThrow();
  });
});

import { needsNursingPreConsult as nn } from './ambulatorio';
import { callPatient, cancelUnattendedEncounter, completeAmbulatoryNursing, getState, openEncounter, setState, switchAmbulatorySector } from './hospital-store';
import type { Patient } from './hospital-data';

const pat = (id = 'amb-p1'): Patient => ({
  id, name: 'Ana Gestante', prontuario: 'PR-10', cpf: '11122233344', age: '28a', type: 'gestante',
  bed: '', diagnosis: '', admission: '', insurance: 'SUS', weight: 65, ward: 'PSO', authorized: true, days: 0, risks: [], allergies: [],
  vitals: [], prescriptions: [], evolutions: [],
});

describe('pré-consulta de enfermagem no ambulatório', () => {
  it('obstétrico entra sempre', () => expect(nn({ type: 'Ambulatório', specialty: 'Gestação de Alto Risco' })).toBe(true));
  it('outra especialidade só se marcada', () => {
    expect(nn({ type: 'Ambulatório', specialty: 'Cardiologia Pediátrica' })).toBe(false);
    expect(nn({ type: 'Ambulatório', specialty: 'Cardiologia Pediátrica', nursingPreConsult: true })).toBe(true);
  });
  it('fora do ambulatório não entra', () => expect(nn({ type: 'Pronto socorro', specialty: 'Obstetrícia', nursingPreConsult: true })).toBe(false));
});

describe('fluxo salux no ambulatório', () => {
  it('encaminhado para triagem fica em AGUARDANDO_TRIAGEM até enfermagem finalizar', () => {
    setState(() => ({ profile: 'Administrador', encounters: [], patients: [], queue: [] }));
    const e = openEncounter(pat('p-tri'), 'Ambulatório', 'Cardiologia Pediátrica', 'CONSULTA SISREG', true);
    expect(e.status_fluxo).toBe('AGUARDANDO_TRIAGEM');
    completeAmbulatoryNursing(e.id, { text: 'PA aferida, sem intercorrências.' });
    expect(getState().encounters.find((x) => x.id === e.id)?.status_fluxo).toBe('AGUARDANDO_MEDICO');
  });
  it('encaminhado para consultório vai direto para AGUARDANDO_MEDICO e permite trocar setor antes de atender', () => {
    setState(() => ({ profile: 'Administrador', encounters: [], patients: [], queue: [] }));
    const e = openEncounter(pat('p-dir'), 'Ambulatório', 'Cardiologia Pediátrica', 'RETORNO', false);
    expect(e.status_fluxo).toBe('AGUARDANDO_MEDICO');
    switchAmbulatorySector(e.id, true);
    expect(getState().encounters.find((x) => x.id === e.id)?.status_fluxo).toBe('AGUARDANDO_TRIAGEM');
    switchAmbulatorySector(e.id, false);
    expect(getState().encounters.find((x) => x.id === e.id)?.status_fluxo).toBe('AGUARDANDO_MEDICO');
    callPatient(e.id);
    expect(() => switchAmbulatorySector(e.id, true)).toThrow('já iniciou atendimento');
  });
  it('permite excluir com X antes do atendimento e bloqueia depois de chamar', () => {
    setState(() => ({ profile: 'Recepção', encounters: [], patients: [], queue: [] }));
    const e1 = openEncounter(pat('p-x1'), 'Ambulatório', 'Cardiologia Pediátrica', 'CONSULTA', false);
    cancelUnattendedEncounter(e1.id);
    expect(getState().encounters.some((x) => x.id === e1.id)).toBe(false);

    setState(() => ({ profile: 'Administrador', encounters: [], patients: [], queue: [] }));
    const e2 = openEncounter(pat('p-x2'), 'Ambulatório', 'Cardiologia Pediátrica', 'CONSULTA', false);
    callPatient(e2.id);
    expect(() => cancelUnattendedEncounter(e2.id)).toThrow('já iniciou atendimento');
  });
});
