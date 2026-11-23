// Pedidos médicos de Raio-X e Gesso: o médico solicita, o setor atende com um registro de texto.
export type ServiceKind = 'raio-x' | 'gesso';
export type ServicePriority = 'Rotina' | 'Urgente' | 'Imediato';
export type ServiceStatus = 'Aguardando' | 'Concluído' | 'Cancelado';
export interface ServiceRequest {
  id: string; kind: ServiceKind; region: string; detail: string; priority: ServicePriority; justification: string;
  requestedAt: string; requestedBy: string; status: ServiceStatus;
  report?: string; doneAt?: string; doneBy?: string; closedNote?: string;
}
export const SERVICE_CONFIG: Record<ServiceKind, { label: string; path: '/raio-x' | '/gesso'; detailLabel: string; details: string[]; reportLabel: string }> = {
  'raio-x': { label: 'Raio-X', path: '/raio-x', detailLabel: 'Incidência', details: ['AP', 'PA', 'Perfil', 'AP + Perfil', 'Oblíqua', 'Outra'], reportLabel: 'Registro do exame (técnica, observações, laudo)' },
  gesso: { label: 'Gesso', path: '/gesso', detailLabel: 'Tipo de imobilização', details: ['Tala gessada', 'Gesso circular', 'Tala metálica', 'Tipoia', 'Retirada de gesso', 'Outra'], reportLabel: 'Registro do procedimento (imobilização, orientações)' },
};
export function serviceRequestIssues(r: Pick<ServiceRequest, 'region' | 'justification'>): string[] {
  const i: string[] = [];
  if (!r.region.trim()) i.push('Informe a região.');
  if (!r.justification.trim()) i.push('Informe a indicação / justificativa.');
  return i;
}
const rank: Record<ServicePriority, number> = { Imediato: 0, Urgente: 1, Rotina: 2 };
export const sortServices = <T extends { req: ServiceRequest }>(list: T[]) =>
  [...list].sort((a, b) => rank[a.req.priority] - rank[b.req.priority] || a.req.requestedAt.localeCompare(b.req.requestedAt));
