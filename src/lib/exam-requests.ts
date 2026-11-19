// Pedidos de exames (imagem, laboratoriais e anatomopatológico) gerados em qualquer setor e consumidos pelo SADT.
export type ExamKind = 'imagem' | 'laboratorial' | 'patologico';
export type ExamStatus = 'Solicitado' | 'Agendado' | 'Realizado' | 'Laudado' | 'Cancelado';
export interface ExamRequest {
  id: string; kind: ExamKind; exams: string; justification: string; cid: string;
  material?: string; site?: string; clinical?: string; // patológico
  requestedAt: string; requestedBy: string; council: string; status: ExamStatus;
  scheduledFor?: string; doneAt?: string; doneBy?: string; report?: string; note?: string;
}
export const KIND_LABELS: Record<ExamKind, string> = { imagem: 'Imagem / SADT', laboratorial: 'Laboratorial', patologico: 'Anatomopatológico' };
export const NEXT_STATUS: Record<ExamStatus, ExamStatus[]> = { Solicitado: ['Agendado', 'Realizado', 'Cancelado'], Agendado: ['Realizado', 'Cancelado'], Realizado: ['Laudado'], Laudado: [], Cancelado: [] };

export function examRequestIssues(r: Pick<ExamRequest, 'kind' | 'exams' | 'justification' | 'material' | 'site'>): string[] {
  const i: string[] = [];
  if (!r.exams.trim()) i.push('Informe o(s) exame(s).');
  if (!r.justification.trim()) i.push('Informe a justificativa clínica.');
  if (r.kind === 'patologico' && !r.material?.trim()) i.push('Informe o material enviado.');
  if (r.kind === 'patologico' && !r.site?.trim()) i.push('Informe o local da coleta.');
  return i;
}
export function moveExam(r: ExamRequest, to: ExamStatus, by: string, at: string, extra: Partial<ExamRequest> = {}): ExamRequest {
  if (!NEXT_STATUS[r.status].includes(to)) throw new Error(`Não é possível passar de ${r.status} para ${to}.`);
  if (to === 'Laudado' && !extra.report?.trim()) throw new Error('Informe o laudo.');
  return { ...r, ...extra, status: to, ...(to === 'Realizado' ? { doneAt: at, doneBy: by } : {}) };
}

// Receituário de controle especial (Portaria SVS/MS 344/98)
export interface ControlledRx { items: { drug: string; qty: string; dose: string }[]; buyer: string; buyerDoc: string; buyerAddress: string }
export function controlledRxIssues(rx: ControlledRx): string[] {
  const i: string[] = [];
  const items = rx.items.filter((x) => x.drug.trim());
  if (!items.length) i.push('Inclua ao menos um medicamento.');
  if (items.some((x) => !x.qty.trim() || !x.dose.trim())) i.push('Informe quantidade (por extenso) e posologia de cada medicamento.');
  return i;
}
