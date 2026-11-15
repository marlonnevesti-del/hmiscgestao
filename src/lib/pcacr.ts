import type { Manchester } from "./hospital-data";
export type CorRisco = Manchester;

export type Publico = "adulto" | "pediatria" | "obstetricia";
export type Descritor = { id: string; texto: string; cor: CorRisco };
export type Fluxograma = { id: string; nome: string; publico: Publico; descritores: Descritor[] };

export const PUBLICO_LABEL: Record<Publico, string> = { adulto: "Clínica geral / adulto", pediatria: "Pediatria", obstetricia: "Obstetrícia / maternidade" };

/** Tempo máximo de espera (min) por cor e público, conforme tabela adotada para o PCACR. */
export const TEMPO_PCACR: Record<Publico, Record<CorRisco, number>> = {
  adulto: { vermelho: 0, laranja: 10, amarelo: 60, verde: 120, azul: 240 },
  pediatria: { vermelho: 0, laranja: 10, amarelo: 60, verde: 120, azul: 240 },
  obstetricia: { vermelho: 0, laranja: 15, amarelo: 30, verde: 120, azul: 240 },
};

const d = (cor: CorRisco, ...textos: string[]): Descritor[] => textos.map((texto) => ({ id: `${cor}:${texto}`, texto, cor }));

export const FLUXOGRAMAS: Fluxograma[] = [
  // Adulto
  { id: "ad-dor-toracica", nome: "Dor torácica", publico: "adulto", descritores: [
    ...d("vermelho", "Choque / instabilidade hemodinâmica", "PCR ou arritmia grave"),
    ...d("laranja", "Dor precordial típica (aperto, irradiação)", "Dor intensa (8–10)", "Dispneia aguda associada"),
    ...d("amarelo", "Dor moderada (4–7)", "História de cardiopatia"),
    ...d("verde", "Dor leve (1–3) recente", "Dor ventilatório-dependente sem dispneia"),
    ...d("azul", "Dor crônica sem alteração") ] },
  { id: "ad-dispneia", nome: "Dispneia / problemas respiratórios", publico: "adulto", descritores: [
    ...d("vermelho", "Obstrução de vias aéreas", "Respiração inadequada / SpO₂ < 85%"),
    ...d("laranja", "SpO₂ 85–90%", "Incapaz de falar frases completas", "Estridor"),
    ...d("amarelo", "SpO₂ 91–94%", "Sibilância", "Febre ≥ 38,5 °C"),
    ...d("verde", "Tosse produtiva sem desconforto", "Sintomas gripais"),
    ...d("azul", "Sintomas leves > 7 dias") ] },
  { id: "ad-dor-abdominal", nome: "Dor abdominal", publico: "adulto", descritores: [
    ...d("vermelho", "Choque"),
    ...d("laranja", "Dor intensa (8–10)", "Hematêmese / melena volumosa", "Abdome em tábua"),
    ...d("amarelo", "Dor moderada (4–7)", "Vômitos persistentes", "Febre ≥ 38,5 °C"),
    ...d("verde", "Dor leve (1–3)", "Diarreia sem desidratação"),
    ...d("azul", "Queixa crônica sem alteração") ] },
  { id: "ad-neuro", nome: "Alteração neurológica / cefaleia", publico: "adulto", descritores: [
    ...d("vermelho", "Inconsciente / Glasgow ≤ 8", "Convulsão ativa"),
    ...d("laranja", "Déficit neurológico agudo (suspeita de AVC < 4,5 h)", "Cefaleia súbita e intensa", "Glicemia < 60 mg/dL"),
    ...d("amarelo", "Confusão mental nova", "Cefaleia moderada"),
    ...d("verde", "Cefaleia leve", "Tontura sem outros sinais"),
    ...d("azul", "Cefaleia crônica habitual") ] },
  { id: "ad-trauma", nome: "Trauma", publico: "adulto", descritores: [
    ...d("vermelho", "Hemorragia exsanguinante", "Trauma grave com choque"),
    ...d("laranja", "Mecanismo de trauma significativo", "Dor intensa", "Fratura exposta"),
    ...d("amarelo", "Deformidade", "Dor moderada", "Sangramento controlado"),
    ...d("verde", "Contusão / entorse", "Ferimento superficial"),
    ...d("azul", "Trauma antigo sem alteração") ] },
  { id: "ad-mal-estar", nome: "Mal-estar / febre", publico: "adulto", descritores: [
    ...d("vermelho", "Sinais de choque"),
    ...d("laranja", "Suspeita de sepse", "Imunossuprimido com febre"),
    ...d("amarelo", "Febre ≥ 38,5 °C", "Desidratação"),
    ...d("verde", "Febre baixa", "Sintomas leves recentes"),
    ...d("azul", "Troca de receita / atestado", "Queixa crônica") ] },
  // Pediatria
  { id: "ped-febre", nome: "Febre na criança", publico: "pediatria", descritores: [
    ...d("vermelho", "Choque / má perfusão", "Convulsão ativa"),
    ...d("laranja", "Menor de 3 meses com febre", "Petéquias / púrpura", "Letargia / irritabilidade extrema"),
    ...d("amarelo", "Febre ≥ 39 °C", "Recusa alimentar", "Desidratação moderada"),
    ...d("verde", "Febre < 39 °C com bom estado geral"),
    ...d("azul", "Febre referida, afebril no momento") ] },
  { id: "ped-resp", nome: "Desconforto respiratório na criança", publico: "pediatria", descritores: [
    ...d("vermelho", "Apneia / cianose central", "SpO₂ < 90%"),
    ...d("laranja", "Tiragem / batimento de asa nasal", "Estridor em repouso", "SpO₂ 90–94%"),
    ...d("amarelo", "Sibilância", "Taquipneia para a idade"),
    ...d("verde", "Coriza e tosse sem desconforto"),
    ...d("azul", "Sintomas leves > 7 dias") ] },
  { id: "ped-vomito", nome: "Vômitos / diarreia na criança", publico: "pediatria", descritores: [
    ...d("vermelho", "Choque"),
    ...d("laranja", "Desidratação grave", "Vômitos com sangue / biliosos"),
    ...d("amarelo", "Desidratação moderada", "Vômitos persistentes"),
    ...d("verde", "Sem desidratação"),
    ...d("azul", "Queixa leve > 7 dias") ] },
  // Obstetrícia
  { id: "ob-trabalho-parto", nome: "Dinâmica uterina / trabalho de parto", publico: "obstetricia", descritores: [
    ...d("vermelho", "Período expulsivo (puxos / parto iminente)", "Prolapso de cordão"),
    ...d("laranja", "Trabalho de parto prematuro (< 37 sem) com contrações", "Contrações ≥ 3 em 10 min", "Cesárea anterior com contrações"),
    ...d("amarelo", "Contrações regulares 1–2 em 10 min", "Dor abdominal moderada"),
    ...d("verde", "Contrações irregulares (pródromos)"),
    ...d("azul", "Sem contrações, gestação a termo") ] },
  { id: "ob-sangramento", nome: "Sangramento na gestação", publico: "obstetricia", descritores: [
    ...d("vermelho", "Hemorragia volumosa / sinais de choque"),
    ...d("laranja", "Sangramento ativo moderado", "Suspeita de descolamento de placenta (dor + hipertonia)", "Placenta prévia conhecida com sangramento"),
    ...d("amarelo", "Sangramento leve no 2º/3º trimestre"),
    ...d("verde", "Sangramento leve / borra no 1º trimestre sem dor"),
    ...d("azul", "Sangramento referido, ausente no momento") ] },
  { id: "ob-liquido", nome: "Perda de líquido amniótico", publico: "obstetricia", descritores: [
    ...d("vermelho", "Cordão visível na vagina"),
    ...d("laranja", "Líquido meconial / fétido", "Rotura com febre materna", "Rotura < 37 semanas"),
    ...d("amarelo", "Rotura de membranas a termo com líquido claro"),
    ...d("verde", "Perda de líquido duvidosa"),
    ...d("azul", "Leucorreia sem perda de líquido") ] },
  { id: "ob-hipertensao", nome: "Síndromes hipertensivas", publico: "obstetricia", descritores: [
    ...d("vermelho", "Convulsão (eclâmpsia)", "PA ≥ 160/110 com sintomas"),
    ...d("laranja", "PA ≥ 160/110", "Cefaleia, escotomas ou epigastralgia", "Suspeita de síndrome HELLP"),
    ...d("amarelo", "PA 140–159 / 90–109 sem sintomas"),
    ...d("verde", "Hipertensão controlada, retorno"),
    ...d("azul", "PA normal, sem queixas") ] },
  { id: "ob-vitalidade", nome: "Vitalidade fetal / BCF", publico: "obstetricia", descritores: [
    ...d("vermelho", "BCF ausente", "Bradicardia fetal sustentada (< 100 bpm)"),
    ...d("laranja", "BCF < 110 ou > 160 bpm", "Ausência de movimentos fetais > 12 h"),
    ...d("amarelo", "Diminuição de movimentos fetais"),
    ...d("verde", "BCF normal, queixa leve"),
    ...d("azul", "BCF e movimentos normais, sem queixas") ] },
];

export const fluxogramaPorId = (id: string | null | undefined) => FLUXOGRAMAS.find((f) => f.id === id) ?? null;
export const descritorPorId = (f: Fluxograma | null, id: string) => f?.descritores.find((x) => x.id === id) ?? null;

const ORDEM: CorRisco[] = ["vermelho", "laranja", "amarelo", "verde", "azul"];

/** Cor sugerida = descritor mais grave assinalado; nenhum assinalado → sem sugestão. */
export function sugerirCorPCACR(fluxogramaId: string, descritorIds: string[]): { cor: CorRisco; tempoMax: number } | null {
  const f = fluxogramaPorId(fluxogramaId);
  if (!f) return null;
  const cores = descritorIds.map((id) => descritorPorId(f, id)?.cor).filter(Boolean) as CorRisco[];
  if (!cores.length) return null;
  const cor = ORDEM.find((c) => cores.includes(c))!;
  return { cor, tempoMax: TEMPO_PCACR[f.publico][cor] ?? 0 };
}

export const publicoPadrao = (modalidade: string, idadeAnos: number | null): Publico =>
  modalidade === "maternidade" ? "obstetricia" : idadeAnos != null && idadeAnos < 14 ? "pediatria" : "adulto";
