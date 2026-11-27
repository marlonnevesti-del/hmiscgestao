// Pedidos de exames (imagem, laboratoriais e anatomopatológico) gerados em qualquer setor e consumidos pelo SADT.
export type ExamKind = 'imagem' | 'laboratorial' | 'patologico';
export type ExamStatus = 'Solicitado' | 'Agendado' | 'Coletado' | 'Realizado' | 'Laudado' | 'Cancelado';
export type ExamProvider = 'proprio' | 'terceirizada';
export type ExamAuditStatus = 'Pendente' | 'Aprovado' | 'Glosado';
export interface ExamRequestItem {
  sigtapCode?: string;
  name: string;
  valueSus?: number;
}
export interface ExamRequest {
  id: string; orderNumber?: string; kind: ExamKind; exams: string; items?: ExamRequestItem[];
  provider?: ExamProvider; providerName?: string; justification: string; cid: string;
  material?: string; site?: string; clinical?: string; // patológico
  requestedAt: string; requestedBy: string; council: string; status: ExamStatus;
  scheduledFor?: string; collectedAt?: string; collectedBy?: string;
  doneAt?: string; doneBy?: string; report?: string; note?: string;
  auditStatus?: ExamAuditStatus; auditNote?: string; auditedAt?: string; auditedBy?: string;
}
export const KIND_LABELS: Record<ExamKind, string> = { imagem: 'Imagem / SADT', laboratorial: 'Laboratorial', patologico: 'Anatomopatológico' };
export const PROVIDER_LABELS: Record<ExamProvider, string> = { proprio: 'Próprio (HMISC)', terceirizada: 'Terceirizada' };
export const NEXT_STATUS: Record<ExamStatus, ExamStatus[]> = {
  Solicitado: ['Agendado', 'Coletado', 'Realizado', 'Cancelado'],
  Agendado: ['Coletado', 'Realizado', 'Cancelado'],
  Coletado: ['Realizado', 'Laudado', 'Cancelado'],
  Realizado: ['Laudado'],
  Laudado: [],
  Cancelado: [],
};

/** Gera o próximo número sequencial de pedido de exame (PED-AAAA-NNNNNN). */
export function nextExamOrderNumber(existing: readonly (string | undefined)[], year = new Date().getFullYear()): string {
  const prefix = `PED-${year}-`;
  let max = 0;
  for (const num of existing) {
    if (!num || !num.startsWith(prefix)) continue;
    const n = Number.parseInt(num.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

export function defaultProviderForKind(kind: ExamKind): ExamProvider {
  return kind === 'imagem' ? 'proprio' : 'terceirizada';
}

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
  return {
    ...r,
    ...extra,
    status: to,
    ...(to === 'Coletado' ? { collectedAt: at, collectedBy: by } : {}),
    ...(to === 'Realizado' || (to === 'Laudado' && !r.doneAt) ? { doneAt: at, doneBy: by } : {}),
  };
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
