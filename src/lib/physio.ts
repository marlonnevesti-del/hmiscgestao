// Solicitações de fisioterapia feitas pelo médico e sessões registradas pela equipe de fisioterapia.
export type PhysioModality = 'Respiratória' | 'Motora' | 'Respiratória + Motora';
export type PhysioPriority = 'Urgente' | 'Rotina';
export type PhysioStatus = 'Aguardando' | 'Em acompanhamento' | 'Concluída' | 'Cancelada';
export const PHYSIO_MODALITIES: PhysioModality[] = ['Respiratória', 'Motora', 'Respiratória + Motora'];
export const PHYSIO_SUPPORT = ['Ar ambiente', 'Cateter nasal', 'Máscara / Venturi', 'VNI', 'CPAP', 'Ventilação mecânica'];
export interface PhysioSession { id: string; at: string; by: string; conduct: string; pre: string; post: string }
export interface PhysioRequest {
  id: string; modality: PhysioModality; priority: PhysioPriority; support: string; justification: string;
  requestedAt: string; requestedBy: string; status: PhysioStatus; sessions: PhysioSession[]; closedNote?: string;
}
export function physioRequestIssues(r: Pick<PhysioRequest, 'modality' | 'justification'>): string[] {
  const i: string[] = [];
  if (!r.modality) i.push('Informe a modalidade.');
  if (!r.justification.trim()) i.push('Informe a indicação / justificativa.');
  return i;
}
export const isPhysioOpen = (r: PhysioRequest) => r.status === 'Aguardando' || r.status === 'Em acompanhamento';
/** Urgentes primeiro, depois as mais antigas. */
export const sortPhysio = <T extends { req: PhysioRequest }>(list: T[]) =>
  [...list].sort((a, b) => (a.req.priority === b.req.priority ? a.req.requestedAt.localeCompare(b.req.requestedAt) : a.req.priority === 'Urgente' ? -1 : 1));
