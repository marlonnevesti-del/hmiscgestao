/** Tabela SIGTAP oficial (DATASUS, competência 2026-11). Carregada sob demanda para não pesar o app. */
export interface SigtapProc { c: string; n: string; s: string; i: number; x: number; v: number; r: string[] }

let cache: SigtapProc[] | null = null;
export async function loadSigtap(): Promise<SigtapProc[]> {
  if (!cache) cache = (await import('./sigtap-catalog.json')).default as SigtapProc[];
  return cache;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
/** AIH = registro 03 (principal) ou 04 (secundário); BPA = 01/02. */
export const isAih = (p: SigtapProc) => p.r.includes('03');
export const formatCode = (c: string) => c.replace(/^(\d{2})(\d{2})(\d{2})(\d{3})(\d)$/, '$1.$2.$3.$4-$5');

/** Busca por código (com ou sem pontos) ou palavras do nome; todas as palavras precisam aparecer. */
export function searchSigtap(list: SigtapProc[], q: string, opts: { aihOnly?: boolean; limit?: number } = {}): SigtapProc[] {
  const digits = q.replace(/\D/g, '');
  const words = norm(q).split(/\s+/).filter((w) => /[A-Z]/.test(w));
  if (!digits && !words.length) return [];
  const out: SigtapProc[] = [];
  for (const p of list) {
    if (opts.aihOnly && !isAih(p)) continue;
    if (digits && !p.c.startsWith(digits)) continue;
    if (words.length && !words.every((w) => norm(p.n).includes(w))) continue;
    out.push(p);
  }
  // Nomes que começam pela busca vêm primeiro, depois os mais curtos (mais genéricos).
  const head = words.join(' ');
  const rank = (p: SigtapProc) => (head && norm(p.n).startsWith(head) ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || a.n.length - b.n.length).slice(0, opts.limit ?? 30);
}
