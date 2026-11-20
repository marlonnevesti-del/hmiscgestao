import type { Patient } from './hospital-data';
import type { MilkBank } from './milk-bank';

export type BedBadge = { key: 'alergia' | 'isolamento' | 'permanencia' | 'lhp' | 'fisio'; label: string; tone: 'danger' | 'warn' | 'info' };

/** Days since FIA opening (whole days). */
export const stayDays = (openedAt: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(openedAt)) / 86_400_000));

/** Stay tone: >=7 days danger, >=5 warn, otherwise none. */
export function stayTone(days: number): 'danger' | 'warn' | null { return days >= 7 ? 'danger' : days >= 5 ? 'warn' : null; }

export function bedBadges(p: Patient | undefined, openedAt: string, milk: MilkBank | undefined, now = Date.now()): BedBadge[] {
  const out: BedBadge[] = [];
  if (!p) return out;
  const allergies = (p.allergies ?? []).filter((a) => a && !/^(nega|nenhuma|nkda)/i.test(a.trim()));
  if (allergies.length) out.push({ key: 'alergia', label: `Alergia: ${allergies.join(', ')}`, tone: 'danger' });
  if ((p.sciras?.isolates.length ?? 0) > 0) out.push({ key: 'isolamento', label: 'Precaução / Isolamento (MDR)', tone: 'warn' });
  const d = stayDays(openedAt, now); const t = stayTone(d);
  if (t) out.push({ key: 'permanencia', label: `${d} dias de internação`, tone: t });
  if (milk?.recipients.some((r) => r.active && r.patientId === p.id)) out.push({ key: 'lhp', label: 'Em uso de Leite Humano', tone: 'info' });
  if (p.physio?.some((r) => r.status === 'Aguardando' || r.status === 'Em acompanhamento')) out.push({ key: 'fisio', label: 'Fisioterapia', tone: 'info' });
  return out;
}
