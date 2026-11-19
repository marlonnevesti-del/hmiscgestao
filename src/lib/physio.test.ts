import { beforeEach, describe, expect, it } from 'vitest';
import { getState, recordPhysioSession, requestPhysio, setState } from './hospital-store';
import { pendingCounts } from './dashboard';
import type { Patient } from './hospital-data';

const pt = (): Patient => ({ id: 'p1', prontuario: '1', name: 'João', cpf: '', type: 'pediatria', age: '3m', weight: 6, allergies: [], risks: [], ward: 'UTIP', bed: 'UTIP-02', insurance: 'SUS', authorized: true, diagnosis: '', admission: '', days: 1, evolutions: [], vitals: [], prescriptions: [] });
const req = { modality: 'Respiratória' as const, priority: 'Urgente' as const, support: 'Cateter nasal', justification: 'Bronquiolite' };
beforeEach(() => setState(() => ({ profile: 'Médico', employeeName: 'Dra', patients: [pt()], encounters: [] })));

describe('fisioterapia', () => {
  it('pedido do médico aparece como aguardando na Fisioterapia', () => {
    requestPhysio('p1', req);
    expect(pendingCounts([], getState().patients)['/fisioterapia']).toBe(1);
  });
  it('exige justificativa', () => expect(() => requestPhysio('p1', { ...req, justification: ' ' })).toThrow(/justificativa/));
  it('recepção não pode solicitar', () => { setState(() => ({ profile: 'Recepção' })); expect(() => requestPhysio('p1', req)).toThrow(); });
  it('sessão vai para a evolução do prontuário', () => {
    const r = requestPhysio('p1', req); setState(() => ({ profile: 'Fisioterapeuta' }));
    recordPhysioSession('p1', r.id, { conduct: 'Higiene brônquica', pre: '', post: '' });
    const p = getState().patients[0]!;
    expect(p.physio?.[0]?.status).toBe('Em acompanhamento');
    expect(p.evolutions.at(-1)?.cat).toBe('Fisioterapia');
  });
});
