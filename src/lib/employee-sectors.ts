import { ACCESS_AREAS, UNIT_AREAS } from "./hospital-data";
import { WAREHOUSE_CATEGORIES, requestAreaId } from "./warehouse-categories";

export const DEFAULT_EMPLOYEE_SECTORS = [
  "Administrativo", "Almoxarifado", "Ambulatório", "Banco de Leite", "CC", "CCIH", "Clínica CC", "CME", "CO", "Cozinha",
  "Direção", "Engenharia Clínica", "Farmácia", "Faturamento", "Hotelaria", "Lactário", "Manutenção", "Marketing", "Maternidade", "NIR",
  "Nutrição", "Pediatria", "PS", "Psicologia", "Qualidade", "Raio-X", "RDS", "Recep Ambu", "Recep Inf", "Recep Mat",
  "RH", "Sala de Reuniões", "SCIH", "Serviço Social", "SESMT", "T.I.", "UCI", "Ultrassom", "UNESC", "UTI Neo", "UTI Ped",
] as const;

const unitAreas = (unit: string) => UNIT_AREAS.find((item) => item.id === unit)?.tabs.map((tab) => `${unit}:${tab.id}`) ?? [];

/** Automatic screen grants for the sectors supplied by the hospital. Never grants administration. */
export const DEFAULT_SECTOR_ACCESS: Record<string, string[]> = {
  Administrativo: ["faturamento", "almoxarifado"],
  Almoxarifado: ["almoxarifado"],
  Ambulatório: unitAreas("ambulatorio"),
  "Banco de Leite": ["banco-de-leite"],
  CC: ["centro-cirurgico"],
  CCIH: ["sciras"],
  "Clínica CC": ["centro-cirurgico"],
  CME: ["cme"],
  CO: ["centro-cirurgico"],
  Farmácia: ["farmacia"],
  Faturamento: ["faturamento"],
  Lactário: ["banco-de-leite"],
  Maternidade: unitAreas("maternidade"),
  NIR: ["nir"],
  Pediatria: ["pacientes", "enfermagem"],
  PS: unitAreas("pronto-socorro"),
  Psicologia: ["pacientes"],
  "Raio-X": ["raio-x"],
  "Recep Ambu": ["recepcao", "ambulatorio:agenda", "ambulatorio:recepcao"],
  "Recep Inf": ["recepcao", "pronto-socorro:recepcao"],
  "Recep Mat": ["recepcao", "maternidade:recepcao"],
  SCIH: ["sciras"],
  "Serviço Social": ["pacientes"],
  UCI: ["uti-uci", "pacientes", "enfermagem"],
  Ultrassom: ["ambulatorio:sadt"],
  "UTI Neo": ["uti-uci", "pacientes", "enfermagem"],
  "UTI Ped": ["uti-uci", "pacientes", "enfermagem"],
};

export type EmployeeSectorDefinition = { name: string; access_areas: string[] };
export const normalizeSectorName = (name: string) => name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export const isKnownSector = (sector: string, customNames: readonly string[]) => [...DEFAULT_EMPLOYEE_SECTORS, ...customNames].some((name) => normalizeSectorName(name) === normalizeSectorName(sector));
export const mergeEmployeeSectors = (customNames: readonly string[]) => {
  const names = new Map<string, string>();
  for (const name of [...DEFAULT_EMPLOYEE_SECTORS, ...customNames]) if (!names.has(normalizeSectorName(name))) names.set(normalizeSectorName(name), name.trim());
  return [...names.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
};
export function areasForSector(sector: string, custom: readonly EmployeeSectorDefinition[] = []) {
  const normalized = normalizeSectorName(sector);
  const defaults = Object.entries(DEFAULT_SECTOR_ACCESS).find(([name]) => normalizeSectorName(name) === normalized)?.[1] ?? [];
  const customAreas = custom.filter((item) => normalizeSectorName(item.name) === normalized).flatMap((item) => item.access_areas);
  return [...new Set([...defaults, ...customAreas])];
}
export function withSectorAreas(base: readonly string[], sector: string, custom: readonly EmployeeSectorDefinition[] = []) {
  return [...new Set([...base, ...areasForSector(sector, custom)])];
}

export const ALL_ACCESS_AREA_IDS = new Set([
  ...ACCESS_AREAS.map((area) => area.id as string),
  ...UNIT_AREAS.flatMap((unit) => unit.tabs.map((tab) => `${unit.id}:${tab.id}`)),
  ...WAREHOUSE_CATEGORIES.map((category) => requestAreaId(category.id)),
]);
export const hasOnlyKnownAreas = (areas: readonly string[]) => areas.length <= 80 && areas.every((area) => ALL_ACCESS_AREA_IDS.has(area));
