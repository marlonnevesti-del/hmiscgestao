import { describe, it, expect } from 'vitest';
import { controlledRxIssues, examRequestIssues, moveExam, nextExamOrderNumber, type ExamRequest } from './exam-requests';
import { reconcileExternalList, type ExamAuditRow } from './exam-audit';
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
  it('gera numeração sequencial única PED-AAAA-NNNNNN e aceita etapa Coletado', () => {
    expect(nextExamOrderNumber([], 2026)).toBe('PED-2026-000001');
    expect(nextExamOrderNumber(['PED-2026-000004', 'PED-2026-000012', undefined], 2026)).toBe('PED-2026-000013');
    const coletado = moveExam(base, 'Coletado', 'Enf Ana', '2026-11-27T10:00:00Z');
    expect(coletado.status).toBe('Coletado');
    expect(coletado.collectedBy).toBe('Enf Ana');
  });
  it('concilia fatura da terceirizada apontando cobranças sem pedido e exames sem laudo', () => {
    const rows: ExamAuditRow[] = [{
      encounterId: 'e1', encounterNumber: 'BAA-2026-000010', patientId: 'p1', patientName: 'MARIA SILVA', prontuario: '10',
      sector: 'Pronto Socorro', requestId: 'r1', orderNumber: 'PED-2026-000001', requestedAt: '2026-11-27T10:00:00Z',
      month: '2026-11', kind: 'laboratorial', provider: 'terceirizada', providerName: 'Lab', exams: 'Hemograma',
      sigtapCodes: ['0202020380'], susValue: 4.11, requestedBy: 'Dr João', council: '1234', status: 'Coletado',
      hasReport: false, auditStatus: 'Pendente', auditNote: '', auditedBy: '', auditedAt: '',
    }];
    const res = reconcileExternalList(rows, 'PED-2026-000001\nPED-2026-000999');
    expect(res.matched).toHaveLength(1);
    expect(res.notFoundInHospital).toEqual(['PED-2026-000999']);
    expect(res.missingReport).toHaveLength(1);
  });
});
