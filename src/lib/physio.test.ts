import { beforeEach, describe, expect, it } from 'vitest';
import { getState, recordPhysioSession, requestPhysio, setState } from './hospital-store';
import { pendingCounts } from './dashboard';
import type { Patient } from './hospital-data';
import { identifiedPhysioEvolution } from './physio';

const pt = (): Patient => ({ id: 'p1', prontuario: '1', name: 'João', cpf: '', type: 'pediatria', age: '3m', weight: 6, allergies: [], risks: [], ward: 'UTIP', bed: 'UTIP-02', insurance: 'SUS', authorized: true, diagnosis: '', admission: '', days: 1, evolutions: [], vitals: [], prescriptions: [] });
const req = { modality: 'Respiratória' as const, priority: 'Urgente' as const, support: 'Cateter nasal', justification: 'Bronquiolite' };
beforeEach(() => setState(() => ({ profile: 'Médico', employeeName: 'Dra', patients: [pt()], encounters: [] })));

describe('fisioterapia', () => {
  it('identifica cada modelo com os dados do paciente atual, sem reutilizar outra identidade', () => {
    const original = pt();
    const other = { ...original, name: 'Ana', age: '12d', bed: 'NEO-01' };
    for (const template of ['UTINEO', 'UTIPED', 'Pediatria']) {
      const first = identifiedPhysioEvolution(original, template);
      const second = identifiedPhysioEvolution(other, template);
      expect(first).toContain('João');
      expect(first).toContain('3m');
      expect(first).toContain('UTIP-02');
      expect(second).toContain('Ana');
      expect(second).toContain('12d');
      expect(second).toContain('NEO-01');
      expect(second).not.toContain('João');
      expect(second.endsWith(template)).toBe(true);
    }
  });
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
  it('concluir sessão dá alta da fisioterapia e registra pré/pós na evolução', () => {
    const r = requestPhysio('p1', req); setState(() => ({ profile: 'Fisioterapeuta' }));
    recordPhysioSession('p1', r.id, { conduct: 'Manobra de reexpansão', pre: 'SpO2 93%', post: 'SpO2 98%' }, true);
    const p = getState().patients[0]!;
    expect(p.physio?.[0]?.status).toBe('Concluída');
    expect(p.evolutions.at(-1)?.text).toContain('Alta da fisioterapia');
    expect(p.evolutions.at(-1)?.text).toContain('Pré: SpO2 93%');
    expect(p.evolutions.at(-1)?.text).toContain('Pós: SpO2 98%');
  });
});
