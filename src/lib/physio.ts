// Solicitações de fisioterapia feitas pelo médico e sessões registradas pela equipe de fisioterapia.
export type PhysioModality = 'Respiratória' | 'Motora' | 'Respiratória + Motora';
export type PhysioPriority = 'Urgente' | 'Rotina';
export type PhysioStatus = 'Aguardando' | 'Em acompanhamento' | 'Concluída' | 'Cancelada';
export const PHYSIO_MODALITIES: PhysioModality[] = ['Respiratória', 'Motora', 'Respiratória + Motora'];
export type PhysioFrequency = 'Agora' | '1X' | '2X' | '3X';
export const PHYSIO_FREQUENCIES: { id: PhysioFrequency; label: string }[] = [
  { id: 'Agora', label: 'Agora (imediato / dose única)' }, { id: '1X', label: '1X ao dia' }, { id: '2X', label: '2X ao dia' }, { id: '3X', label: '3X ao dia (a cada 8h)' }];
/** Sessões esperadas por dia; Agora = 1 única. */
export const frequencyTarget = (f?: PhysioFrequency) => (f === '2X' ? 2 : f === '3X' ? 3 : 1);
/** Sessões feitas nas últimas 24h (Agora conta todas). */
export function sessionsToday(r: PhysioRequest, now = Date.now()) {
  return r.frequency === 'Agora' ? r.sessions.length : r.sessions.filter((x) => now - Date.parse(x.at) < 86400000).length;
}
export const frequencyBadge = (r: PhysioRequest, now = Date.now()) => !r.frequency ? '' : r.frequency === 'Agora' ? 'AGORA - ÚNICA' : `${r.frequency}/dia · ${sessionsToday(r, now)} de ${frequencyTarget(r.frequency)} hoje`;
export const PHYSIO_SUPPORT = ['Ar ambiente', 'Cateter nasal', 'Máscara / Venturi', 'VNI', 'CPAP', 'Ventilação mecânica'];
export interface PhysioSession { id: string; at: string; by: string; conduct: string; pre: string; post: string }
export interface PhysioRequest {
  id: string; modality: PhysioModality; priority: PhysioPriority; frequency?: PhysioFrequency; support: string; justification: string;
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
