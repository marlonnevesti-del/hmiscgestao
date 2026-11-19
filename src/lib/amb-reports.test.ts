import { describe, it, expect } from 'vitest';
import { ageBand, buildAmbReport } from './amb-reports';
import { DEFAULT_SPECIALTIES } from './ambulatorio';

const enc = (id: string, specialty: string, patientId: string, openedAt = '2026-11-10T10:00:00') => ({ id, number: id, patientId, status_fluxo: 'ALTA_HOSPITALAR', openedAt, type: 'Ambulatório', specialty, complaint: '', history: [] }) as never;
const pat = (id: string, sex: string, birthDate: string, city: string) => ({ id, registration: { sex, birthDate, addresses: [{ primary: true, city, state: 'SC' }] } }) as never;
const appt = (id: string, specialtyId: string, status: string) => ({ id, date: '2026-11-05', specialtyId, status }) as never;

describe('relatórios ambulatório/SADT', () => {
  it('RN até 28 dias e idoso a partir de 60', () => {
    const ref = new Date('2026-11-15T12:00:00');
    expect(ageBand('2026-11-01', ref)).toBe('RN (0–28 dias)');
    expect(ageBand('1960-01-01', ref)).toBe('Idoso (60+)');
  });
  it('separa consultas de exames SADT e calcula absenteísmo', () => {
    const r = buildAmbReport('2026-11', 'consultas', [enc('1', 'Ginecologia', 'a'), enc('2', 'Mamografia Bilateral', 'b'), enc('3', 'Ginecologia', 'a', '2026-10-01T10:00:00')],
      [appt('x', 'ginecologia', 'faltou'), appt('y', 'ginecologia', 'chegou'), appt('z', 'ginecologia', 'cancelado'), appt('w', 'mamografia-bilateral', 'faltou')],
      [pat('a', 'Feminino', '1990-01-01', 'Criciúma'), pat('b', 'Feminino', '1950-01-01', 'Içara')], DEFAULT_SPECIALTIES);
    expect(r.total).toBe(1); expect(r.scheduled).toBe(2); expect(r.absent).toBe(1); expect(r.absenteeism).toBe(50);
    expect(r.byCity).toEqual([['Criciúma/SC', 1]]);
    const s = buildAmbReport('2026-11', 'sadt', [enc('2', 'Mamografia Bilateral', 'b')], [appt('w', 'mamografia-bilateral', 'faltou')], [pat('b', 'Feminino', '1950-01-01', 'Içara')], DEFAULT_SPECIALTIES);
    expect(s.total).toBe(1); expect(s.absenteeism).toBe(100);
  });
});
