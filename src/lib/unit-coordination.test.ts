import { describe, expect, it } from 'vitest';
import { ambCoordination, unitReport } from './unit-coordination';
import type { Encounter } from './care-flow';

const enc = (o: Partial<Encounter>): Encounter => ({ id: 'e', number: '1', patientId: 'p', status_fluxo: 'AGUARDANDO_TRIAGEM', openedAt: '2026-11-10T10:00:00Z', type: 'Maternidade', specialty: 'Obstetrícia', complaint: '', history: [], ...o });

describe('unitReport', () => {
  it('conta só a porta e o período pedidos', () => {
    const r = unitReport([enc({}), enc({ id: 'b', type: 'Pronto socorro' }), enc({ id: 'c', openedAt: '2026-10-01T10:00:00Z' })], [], 'Maternidade', '2026-11');
    expect(r.total).toBe(1);
  });
  it('calcula espera até triagem em minutos', () => {
    const r = unitReport([enc({ history: [{ status: 'AGUARDANDO_MEDICO', at: '2026-11-10T10:30:00Z', by: '', note: '' }] })], [], 'Maternidade', '2026-11');
    expect(r.avgTriageWaitMin).toBe(30);
  });
});

describe('ambCoordination', () => {
  it('absenteísmo = faltas / agendados sem cancelados', () => {
    const a = [{ date: '2026-11-01', status: 'faltou', specialtyId: 'g', professional: 'A' }, { date: '2026-11-02', status: 'chegou', specialtyId: 'g', professional: 'A' }, { date: '2026-11-03', status: 'cancelado', specialtyId: 'g', professional: 'A' }];
    const r = ambCoordination(a, () => 'Ginecologia', [], new Set(), '2026-11');
    expect(r.absenteeism).toBe(50);
    expect(r.cancelled).toBe(1);
  });
});
