export const SPECIAL_CONDITIONS = ["Autismo / TEA", "TDAH", "Deficiência intelectual", "Deficiência física", "Outra"] as const;

/** Substitui "Outra" pelo detalhe informado no cadastro para os avisos assistenciais. */
export function specialConditionsText(list: string[] | null | undefined, other?: string | null): string[] {
  return (list ?? []).map((condition) => condition === "Outra" ? (other?.trim() ? `Outra: ${other.trim()}` : "Outra") : condition);
}
