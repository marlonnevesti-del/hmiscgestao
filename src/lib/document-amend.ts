import type { Encounter } from './care-flow';
import type { Patient } from './hospital-data';

/** Campos de documento que o administrador pode retificar depois de finalizado. */
export type AmendField = 'cns' | 'cpf' | 'identityDocument' | 'birthCertificate' | 'cityCode' | 'birthplaceCode' | 'cid' | 'sigtapCode' | 'aihNumber';
export const AMEND_FIELDS: { id: AmendField; label: string; digits?: number; inpatientOnly?: boolean }[] = [
  { id: 'cns', label: 'CNS do paciente', digits: 15 },
  { id: 'cpf', label: 'CPF', digits: 11 },
  { id: 'identityDocument', label: 'RG' },
  { id: 'birthCertificate', label: 'Certidão de nascimento' },
  { id: 'cityCode', label: 'Cód. IBGE município (residência)' },
  { id: 'birthplaceCode', label: 'Cód. IBGE naturalidade' },
  { id: 'cid', label: 'CID-10 principal' },
  { id: 'sigtapCode', label: 'Código SIGTAP', digits: 10 },
  { id: 'aihNumber', label: 'Nº da AIH autorizada', digits: 13, inpatientOnly: true },
];

export function readField(p: Patient, e: Encounter, f: AmendField): string {
  const r = p.registration;
  switch (f) {
    case 'cpf': return r?.cpf || (p.cpf && p.cpf !== '—' ? p.cpf : '');
    case 'cityCode': return r?.addresses?.find((a) => a.primary)?.cityCode || r?.addresses?.[0]?.cityCode || '';
    case 'cid': return e.medical?.cid || e.fia?.cid || '';
    case 'sigtapCode': return e.aihLaudo?.['codigo'] || e.sigtapCode || '';
    case 'aihNumber': return e.aihLaudo?.['aihNumber'] || '';
    default: return (r?.[f] as string | undefined) || '';
  }
}

/** Valida o valor digitado; retorna mensagem de erro ou null. */
export function amendIssue(f: AmendField, value: string): string | null {
  const def = AMEND_FIELDS.find((x) => x.id === f)!;
  const v = value.trim();
  if (!v) return null;
  if (def.digits && v.replace(/\D/g, '').length !== def.digits) return `${def.label} deve ter ${def.digits} dígitos.`;
  if ((f === 'cityCode' || f === 'birthplaceCode') && !/^\d{6,7}$/.test(v)) return 'Código IBGE deve ter 6 ou 7 dígitos.';
  return null;
}

/** Documentos que faltam no atendimento (usado no painel de pendências). */
export function documentGaps(p: Patient, e: Encounter): AmendField[] {
  const req: AmendField[] = ['cns', 'cityCode', 'cid', 'sigtapCode'];
  if (e.fia) req.push('aihNumber');
  if (p.type === 'neonato') req.push('birthCertificate'); else req.push('cpf');
  return req.filter((f) => !readField(p, e, f));
}
