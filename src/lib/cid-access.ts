// CID-10 groups and per-professional-area access, configured by administrators and stored in the clinical snapshot.
import { CID10, type Cid, type CidSpecialty } from "./cid10";

export type CidGroup = { id: string; label: string; ranges: string[]; specialty?: CidSpecialty };
export type CidArea = { name: string; enabled: boolean; groups: string[] };

export const CID_CHAPTERS = [
  ["A00-B99", "Doenças infecciosas e parasitárias"], ["C00-D48", "Neoplasias"], ["D50-D89", "Sangue e imunidade"],
  ["E00-E90", "Endócrinas, nutricionais e metabólicas"], ["F00-F99", "Transtornos mentais e comportamentais"],
  ["G00-G99", "Sistema nervoso"], ["H00-H59", "Olho e anexos"], ["H60-H95", "Ouvido"], ["I00-I99", "Aparelho circulatório"],
  ["J00-J99", "Aparelho respiratório"], ["K00-K93", "Aparelho digestivo"], ["L00-L99", "Pele e tecido subcutâneo"],
  ["M00-M99", "Sistema osteomuscular"], ["N00-N99", "Aparelho geniturinário"], ["O00-O99", "Gravidez, parto e puerpério"],
  ["P00-P96", "Afecções do período perinatal"], ["Q00-Q99", "Malformações congênitas"], ["R00-R99", "Sintomas e sinais"],
  ["S00-T98", "Lesões, traumatismos e envenenamentos"], ["V01-Y98", "Causas externas"], ["Z00-Z99", "Fatores que influenciam o estado de saúde"],
] as const;

export const DEFAULT_CID_GROUPS: CidGroup[] = [
  { id: "obstetricia", label: "Obstetrícia", ranges: [], specialty: "obstetricia" },
  { id: "pediatria", label: "Pediatria", ranges: [], specialty: "pediatria" },
  { id: "neonatologia", label: "Neonatologia", ranges: [], specialty: "neonatologia" },
  { id: "geral", label: "Geral / Urgência", ranges: [], specialty: "geral" },
];
const ALL = DEFAULT_CID_GROUPS.map((g) => g.id);
export const DEFAULT_CID_AREAS: CidArea[] = [
  { name: "Médico", enabled: true, groups: ALL },
  { name: "Enfermagem", enabled: false, groups: [] },
  { name: "Fisioterapia", enabled: false, groups: [] },
  { name: "Serviço social", enabled: false, groups: [] },
];

const inRange = (code: string, range: string) => { const [a = "", b = a] = range.split("-"); const c = code.slice(0, 3); return c >= a && c <= b; };
export const groupCodes = (g: CidGroup): Cid[] => CID10.filter((c) => (g.specialty && c.specialty === g.specialty) || g.ranges.some((r) => inRange(c.code, r)));

const norm = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
export function areaFor(jobFunction: string): string {
  const job = jobFunction.replace(/^Outro:\s*/, "");
  if (job === "Médico") return "Médico";
  if (job === "Enfermeiro" || job === "Técnico de enfermagem") return "Enfermagem";
  if (job === "Fisioterapeuta") return "Fisioterapia";
  return job;
}
/** Groups the area may use; administrators see everything. Null = area blocked. */
export function allowedGroups(areas: CidArea[], groups: CidGroup[], area: string, isAdmin: boolean): CidGroup[] | null {
  if (isAdmin) return groups;
  const a = areas.find((x) => norm(x.name) === norm(area));
  if (!a?.enabled) return null;
  return groups.filter((g) => a.groups.includes(g.id));
}
export function addGroup(groups: CidGroup[], label: string, ranges: string[]): CidGroup[] {
  const l = label.trim(); if (!l) throw new Error("Informe o nome do grupo.");
  if (!ranges.length) throw new Error("Escolha ao menos um capítulo do CID.");
  if (groups.some((g) => norm(g.label) === norm(l))) throw new Error("Esse grupo já existe.");
  return [...groups, { id: crypto.randomUUID(), label: l, ranges }];
}
export function addArea(areas: CidArea[], name: string): CidArea[] {
  const n = name.trim(); if (!n) throw new Error("Informe o nome da área.");
  if (areas.some((a) => norm(a.name) === norm(n))) throw new Error("Essa área já existe.");
  return [...areas, { name: n, enabled: false, groups: [] }];
}
