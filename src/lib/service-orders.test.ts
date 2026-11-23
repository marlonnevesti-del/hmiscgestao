import { describe, expect, it } from 'vitest';
import { serviceRequestIssues, sortServices, type ServiceRequest } from './service-orders';
const r = (priority: ServiceRequest['priority'], at: string) => ({ req: { priority, requestedAt: at } as ServiceRequest });
describe('raio-x e gesso', () => {
  it('exige região e justificativa', () => { expect(serviceRequestIssues({ region: '', justification: '' })).toHaveLength(2); });
  it('imediato antes de urgente antes de rotina', () => {
    expect(sortServices([r('Rotina', '1'), r('Urgente', '2'), r('Imediato', '3')]).map((x) => x.req.priority)).toEqual(['Imediato', 'Urgente', 'Rotina']);
  });
});
