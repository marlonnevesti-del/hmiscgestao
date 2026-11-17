import type { Manchester, Vital } from './hospital-data';

export const FLOW = ['AGUARDANDO_TRIAGEM', 'AGUARDANDO_MEDICO', 'EM_ATENDIMENTO_MEDICO', 'AGUARDANDO_FARMACIA', 'AGUARDANDO_MEDICACAO', 'EM_OBSERVACAO_REAVALIACAO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO', 'ALTA_HOSPITALAR'] as const;
export type FlowStatus = typeof FLOW[number];
export const FLOW_LABELS: Record<FlowStatus, string> = {
  AGUARDANDO_TRIAGEM: 'Aguardando triagem', AGUARDANDO_MEDICO: 'Aguardando médico', EM_ATENDIMENTO_MEDICO: 'Em atendimento médico', AGUARDANDO_FARMACIA: 'Aguardando farmácia', AGUARDANDO_MEDICACAO: 'Liberado para administração', EM_OBSERVACAO_REAVALIACAO: 'Pronto para reavaliação', ENCAMINHADO_INTERNACAO: 'Encaminhado à internação', ENCAMINHADO_CO: 'Encaminhado ao Centro Obstétrico', ALTA_HOSPITALAR: 'Alta hospitalar',
};
export const ATTENDANCE_TYPES = ['Maternidade', 'Pronto socorro', 'Ambulatório'] as const;
export interface Triage {
  risk: Manchester; weight: number; vital: Vital; complaint: string; allergies: string[]; ig: string; dum: string; bcf: string; contractions: string; fluid: string; bleeding: string; height: string; head: string; guardian: string;
  flowchart?: string; descriptors?: string[]; maxWait?: number;
}
export interface AdmissionRequest {
  status: 'pendente' | 'autorizada' | 'recusada'; ward: string; character: 'Urgência' | 'Eletiva'; cid: string; justification: string;
  isolation: boolean; oxygen: boolean; requestedAt: string; requestedBy: string; decidedAt?: string; decidedBy?: string; bed?: string; note?: string;
}
export interface FiaRecord { number: string; openedAt: string; ward: string; bed: string; doctor: string; authorizedBy: string; cid: string; justification: string; character: string }
export interface Encounter {
  id: string; number: string; patientId: string; status_fluxo: FlowStatus; openedAt: string; type: string; specialty: string; complaint: string;
  history: { status: FlowStatus; at: string; by: string; note: string }[];
  triage?: Triage; medical?: { anamnesis: string; exam: string; cid: string; diagnosis: string };
  signedAt?: string; signedBy?: string; intervention?: string; dispensedAt?: string; dispensedBy?: string; requisition?: string; examPending?: string; discharge?: { summary: string; recipe: string; at: string; by: string }; admission?: AdmissionRequest; fia?: FiaRecord; baaClosedAt?: string;
}
const NEXT: Record<FlowStatus, FlowStatus[]> = {
  AGUARDANDO_TRIAGEM: ['AGUARDANDO_MEDICO'],
  AGUARDANDO_MEDICO: ['EM_ATENDIMENTO_MEDICO'],
  EM_ATENDIMENTO_MEDICO: ['AGUARDANDO_FARMACIA', 'EM_OBSERVACAO_REAVALIACAO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO', 'ALTA_HOSPITALAR'],
  AGUARDANDO_FARMACIA: ['AGUARDANDO_MEDICACAO'],
  AGUARDANDO_MEDICACAO: ['EM_OBSERVACAO_REAVALIACAO'],
  EM_OBSERVACAO_REAVALIACAO: ['EM_ATENDIMENTO_MEDICO', 'ENCAMINHADO_INTERNACAO', 'ENCAMINHADO_CO', 'ALTA_HOSPITALAR'],
  ENCAMINHADO_INTERNACAO: ['EM_ATENDIMENTO_MEDICO', 'ALTA_HOSPITALAR'],
  ENCAMINHADO_CO: ['EM_ATENDIMENTO_MEDICO', 'ENCAMINHADO_INTERNACAO', 'ALTA_HOSPITALAR'],
  ALTA_HOSPITALAR: [],
};
export function transition(e: Encounter, status: FlowStatus, by: string, note = '', at = new Date().toISOString()): Encounter {
  if (!NEXT[e.status_fluxo].includes(status)) throw new Error('Esta ação não está disponível na etapa atual do atendimento.');
  return { ...e, status_fluxo: status, history: [...e.history, { status, at, by, note }] };
}
export function sortMedicalQueue(encounters: Encounter[]) {
  const order: Manchester[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  return [...encounters].sort((a, b) => order.indexOf(a.triage?.risk ?? 'azul') - order.indexOf(b.triage?.risk ?? 'azul') || Date.parse(a.openedAt) - Date.parse(b.openedAt));
}
export function validateTriage(pediatric: boolean, t: Triage) {
  if (pediatric && (!Number.isFinite(t.weight) || t.weight <= 0)) throw new Error('Peso atual obrigatório em pediatria.');
  if (!['vermelho', 'laranja', 'amarelo', 'verde', 'azul'].includes(t.risk)) throw new Error('Selecione a classificação Manchester.');
  const v = t.vital;
  if (![v.pas, v.pad, v.fc, v.fr, v.tax, v.sat, v.dor].every(Number.isFinite) || v.pas <= 0 || v.pad <= 0 || v.fc <= 0 || v.fr <= 0 || v.tax <= 0 || v.sat <= 0 || v.sat > 100 || v.dor < 0 || v.dor > 10) throw new Error('Preencha os sinais vitais com valores válidos.');
}