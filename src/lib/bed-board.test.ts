import { describe, it, expect } from 'vitest';
import { bedBadges, stayTone } from './bed-board';
const now = Date.parse('2026-11-20T12:00:00Z');
const p: any = { id: 'p1', allergies: ['Dipirona'], sciras: { isolates: [{}], cases: [], bundles: [] } };
describe('bed board', () => {
  it('stay 5 days warns, 7 days danger', () => { expect(stayTone(4)).toBeNull(); expect(stayTone(5)).toBe('warn'); expect(stayTone(7)).toBe('danger'); });
  it('flags allergy, isolation, stay and milk', () => {
    const milk: any = { recipients: [{ patientId: 'p1', active: true }] };
    const keys = bedBadges(p, '2026-11-12T12:00:00Z', milk, now).map((b) => b.key);
    expect(keys).toEqual(['alergia', 'isolamento', 'permanencia', 'lhp']);
  });
  it('ignores "Nega alergias"', () => { expect(bedBadges({ id: 'x', allergies: ['Nega'] } as any, '2026-11-20T00:00:00Z', undefined, now)).toEqual([]); });
});
