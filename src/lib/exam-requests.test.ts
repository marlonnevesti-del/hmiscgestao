import { describe, it, expect } from 'vitest';
import { controlledRxIssues, examRequestIssues, moveExam, type ExamRequest } from './exam-requests';
const base: ExamRequest = { id: '1', kind: 'imagem', exams: 'USG', justification: 'dor', cid: '', requestedAt: '', requestedBy: 'Dr', council: '', status: 'Solicitado' };
describe('pedidos de exame', () => {
  it('patológico exige material e local', () => {
    expect(examRequestIssues({ ...base, kind: 'patologico' })).toEqual(['Informe o material enviado.', 'Informe o local da coleta.']);
    expect(examRequestIssues(base)).toEqual([]);
  });
  it('só lauda após realizado e com texto', () => {
    expect(() => moveExam(base, 'Laudado', 'x', 't', { report: 'ok' })).toThrow();
    const done = moveExam(base, 'Realizado', 'Tec', '2026-11-19');
    expect(done.doneBy).toBe('Tec');
    expect(() => moveExam(done, 'Laudado', 'x', 't')).toThrow('Informe o laudo.');
    expect(moveExam(done, 'Laudado', 'x', 't', { report: 'normal' }).status).toBe('Laudado');
  });
  it('receita controlada exige quantidade e posologia', () => {
    expect(controlledRxIssues({ items: [{ drug: 'Clonazepam', qty: '', dose: '' }], buyer: '', buyerDoc: '', buyerAddress: '' })).toHaveLength(1);
    expect(controlledRxIssues({ items: [{ drug: '', qty: '', dose: '' }], buyer: '', buyerDoc: '', buyerAddress: '' })).toEqual(['Inclua ao menos um medicamento.']);
  });
});
