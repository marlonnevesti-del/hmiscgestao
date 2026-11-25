import { describe, it, expect } from 'vitest';
import type { Patient } from './hospital-data';
import type { Encounter } from './care-flow';
import { buildSbar, handoverForUnit } from './handover';

const now = Date.parse('2026-04-10T12:00:00Z');
const openedAt = '2026-04-07T12:00:00Z';
const p = { id: 'p1', name: 'Ana', type: 'pediatria', allergies: ['Penicilina'], risks: [], ward: 'ENFP', bed: '02', diagnosis: 'Pneumonia', evolutions: [], prescriptions: [],
  vitals: [{ time: openedAt, pas: 110, pad: 70, fc: 88, fr: 20, tax: 36.5, sat: 98, dor: 1 }],
  sciras: { isolates: [{ organism: 'Klebsiella MDR', precaution: 'Contato' }], cases: [], bundles: [] } } as unknown as Patient;
const e = { id: 'e1', patientId: 'p1', openedAt, examPending: 'Hemocultura', fia: { number: 'FIA-1', openedAt, ward: 'ENFP', bed: '12', cid: 'J18', justification: 'Pneumonia' } } as unknown as Encounter;

describe('SBAR', () => {
  it('situation uses FIA bed and stay days', () => { const { s } = buildSbar(p, e, now); expect(s).toContain('Leito 12'); expect(s).toContain('3 dias'); });
  it('background has allergy and MDR', () => { const { b } = buildSbar(p, e, now); expect(b).toContain('Penicilina'); expect(b).toContain('Klebsiella MDR'); });
  it('assessment has last vitals', () => expect(buildSbar(p, e, now).a).toContain('PA 110/70'));
  it('recommendation has pending exams', () => expect(buildSbar(p, e, now).r).toContain('Hemocultura'));
  it('conta somente medicamentos e doses da liberação atual', () => {
    const patient = { ...p, prescriptions: [
      { id: 'antigo', cat: 'Medicamento', item: 'Dipirona', posologia: '1 g', times: ['06:00'], batchId: 'antiga' },
      { id: 'atual', cat: 'Medicamento', item: 'Paracetamol', posologia: '500 mg', times: ['12:00', '18:00'], batchId: 'nova' },
    ] } as Patient;
    const current = { ...e, prescriptionBatchId: 'nova' } as Encounter;
    const sbar = buildSbar(patient, current, now);
    expect(sbar.a).toContain('Medicamentos ativos: 1');
    expect(sbar.r).toContain('Doses a conferir: 2');
  });
  it('filters ward and excludes discharged', () => {
    const other = { ...e, id: 'e2', fia: { ...e.fia!, ward: 'UTIP' } } as Encounter;
    const gone = { ...e, id: 'e3', discharge: { summary: '', recipe: '', at: '', by: '' } } as Encounter;
    expect(handoverForUnit([e, other, gone], [p], 'ENFP', now).map((x) => x.encounter.id)).toEqual(['e1']);
  });
});
