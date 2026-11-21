/** Regras oficiais SIGTAP (DATASUS 2026-11): CIDs permitidos e permanência por procedimento. Carregadas sob demanda. */
import type { SigtapProc } from './sigtap';

export interface SigtapRules { cid: Record<string, string[]>; perm: Record<string, number> }
let cache: SigtapRules | null = null;
export async function loadSigtapRules(): Promise<SigtapRules> {
  if (!cache) cache = (await import('./sigtap-rules.json')).default as SigtapRules;
  return cache;
}

const ageMonths = (birth: string, at: string) => {
  const b = new Date(birth), d = new Date(at);
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return null;
  return (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth() - (d.getDate() < b.getDate() ? 1 : 0);
};

/** CID aceito quando o procedimento não tem lista ou o CID (ou sua categoria de 3 caracteres) está nela. */
export function cidAllowed(rules: SigtapRules, code: string, cid: string): boolean {
  const list = rules.cid[code];
  if (!list || !cid) return true;
  const c = cid.replace(/\W/g, '').toUpperCase();
  return list.some((x) => x === c || (c.length === 3 && x.startsWith(c)));
}

/** Inconsistências que o DATASUS glosa: CID fora da lista, sexo, faixa etária (meses) e permanência acima da prevista. */
export function sigtapGlosas(rules: SigtapRules, proc: SigtapProc | undefined, r: { cid: string; sex: string; birthDate: string; date: string; days?: number }): string[] {
  if (!proc) return [];
  const out: string[] = [];
  const cid = r.cid.replace(/\W/g, '').toUpperCase();
  if (cid && !cidAllowed(rules, proc.c, cid)) out.push(`CID ${cid} incompatível com o procedimento ${proc.c}`);
  const sex = r.sex.slice(0, 1).toUpperCase();
  if ((proc.s === 'F' || proc.s === 'M') && sex && sex !== proc.s) out.push(`Procedimento exclusivo do sexo ${proc.s === 'F' ? 'feminino' : 'masculino'}`);
  const age = r.birthDate ? ageMonths(r.birthDate, r.date) : null;
  if (age !== null && proc.i < 9999 && age < proc.i) out.push(`Idade abaixo da mínima do procedimento (${proc.i} meses)`);
  if (age !== null && proc.x < 9999 && age > proc.x) out.push(`Idade acima da máxima do procedimento (${proc.x} meses)`);
  const perm = rules.perm[proc.c];
  if (perm && r.days !== undefined && r.days > perm * 2) out.push(`Permanência de ${r.days} dias acima do dobro da prevista (${perm}) — exige justificativa/mudança de procedimento`);
  return out;
}
