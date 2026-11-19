import { describe, expect, it } from 'vitest';
import { admissionsReport, missingFields } from './inpatient-docs';
const enc = (id: string, pid: string, at: string, out?: string) => ({ id, patientId: pid, fia: { openedAt: at }, discharge: out ? { at: out } : undefined }) as never;
describe('internações', () => {
  it('conta reinternação em até 30 dias após a alta', () => {
    const r = admissionsReport([enc('1', 'a', '2026-10-01T10:00:00Z', '2026-10-05T10:00:00Z'), enc('2', 'a', '2026-11-01T10:00:00Z')], [], '2026-11');
    expect(r.total).toBe(1); expect(r.r30).toBe(1); expect(r.r6m).toBe(1);
  });
  it('reinternação após 60 dias conta só em 6 meses', () => {
    const r = admissionsReport([enc('1', 'a', '2026-08-01T10:00:00Z', '2026-09-01T10:00:00Z'), enc('2', 'a', '2026-11-05T10:00:00Z')], [], '2026-11');
    expect(r.r30).toBe(0); expect(r.r6m).toBe(1);
  });
  it('exige campos obrigatórios na busca de UTI', () => { expect(missingFields('uti', {})).toContain('Tipo de UTI'); });
});
