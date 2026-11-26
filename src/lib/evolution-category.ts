import type { EvoCat, Profile } from "./hospital-data";

/** Categoria de evolução padrão conforme a função do profissional logado. */
export function defaultEvoCat(profile: Profile, jobLabel = ""): EvoCat {
  if (profile === "Fisioterapeuta") return "Fisioterapia";
  if (profile === "Enfermeiro" || profile === "Técnico de enfermagem") return "Enfermagem";
  if (/assistente social|servi[cç]o social/i.test(jobLabel)) return "Serviço Social";
  if (/nutricionista|nutri[cç][aã]o/i.test(jobLabel)) return "Nutricionista";
  if (/psic[oó]log/i.test(jobLabel)) return "Psicólogo(a)";
  return "Médica";
}

/** Troca para categoria diferente da função exige confirmação. */
export const needsCatConfirm = (own: EvoCat, next: EvoCat) => own !== next;
