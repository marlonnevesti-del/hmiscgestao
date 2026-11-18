import type { Movement, MovementKind } from "./supply-flow";

export const KIND_LABEL: Record<MovementKind, string> = { entrada: "Entrada NF", consumo: "Prescrição (dispensação)", requisicao: "Saída via requisição", transferencia: "Transferência", devolucao: "Devolução", quebra: "Quebra / Extravio", vencimento: "Baixa por validade", emprestimo_saida: "Empréstimo (saída)", emprestimo_entrada: "Empréstimo (entrada)" };
const IN: MovementKind[] = ["entrada", "devolucao", "emprestimo_entrada"];

export interface MapFilter { from?: string; to?: string; depot?: string; product?: string; patient?: string; fia?: string; lot?: string; costCenter?: string; kind?: MovementKind | "" }
const has = (v: string | undefined, q: string | undefined) => !q?.trim() || (v ?? "").toLowerCase().includes(q.trim().toLowerCase());

/** Sinal do movimento para o estoque consultado: entrada (+) ou saída (-). */
export function movementSign(m: Movement, depot?: string) {
  if (m.kind === "transferencia") return depot && m.to === depot ? 1 : -1;
  return IN.includes(m.kind) ? 1 : -1;
}

/** Filtra o histórico por período com hora (datetime-local), estoque, produto, paciente, FIA/BAA, lote, setor e tipo. */
export function filterMovements(list: Movement[], f: MapFilter) {
  const fromT = f.from ? new Date(f.from).getTime() : -Infinity;
  const toT = f.to ? new Date(f.to).getTime() : Infinity;
  return list.filter((m) => {
    const t = new Date(m.at).getTime();
    return t >= fromT && t <= toT && (!f.kind || m.kind === f.kind) && (!f.depot || m.from === f.depot || m.to === f.depot)
      && (has(m.item, f.product) || has(m.code, f.product)) && has(m.patient ?? (m.kind === "consumo" ? m.to : ""), f.patient)
      && (!f.fia?.trim() || has(m.fia, f.fia) || has(m.baa, f.fia)) && has(m.lot, f.lot) && has(m.costCenter, f.costCenter);
  }).sort((a, b) => a.at.localeCompare(b.at));
}

/** Resumo sintético por produto. */
export function summarize(list: Movement[], depot?: string) {
  const map = new Map<string, { item: string; code?: string; entradas: number; saidas: number }>();
  for (const m of list) {
    const k = m.code ?? m.item; const r = map.get(k) ?? { item: m.item, ...(m.code ? { code: m.code } : {}), entradas: 0, saidas: 0 };
    if (movementSign(m, depot) > 0) r.entradas += m.qty; else r.saidas += m.qty;
    map.set(k, r);
  }
  return [...map.values()].sort((a, b) => a.item.localeCompare(b.item));
}
