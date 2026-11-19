import raw from "./surgical-kits.json";

export interface KitItem { code: string; name: string; qty: number; unit: string; cost: number }
export interface SurgicalKit { code: string; name: string; items: KitItem[] }

export const KIT_GROUPS = [
  "Ginecologia e Obstetrícia", "Cirurgia geral / pediátrica", "Urologia", "Otorrino / cabeça e pescoço",
  "Ortopedia e odontologia", "Anestesia e medicamentos", "Cateteres, PICC e procedimentos", "Sepse e admissão UTI",
  "Maletas de transporte", "Aplicação e diluição",
] as const;
export type KitGroup = (typeof KIT_GROUPS)[number];

const RULES: [KitGroup, RegExp][] = [
  ["Maletas de transporte", /MALETA/],
  ["Sepse e admissão UTI", /SEPSE|ADMISS/],
  ["Anestesia e medicamentos", /MEDICAMENTOS/],
  ["Urologia", /HIPOSPADIA|POSTECTOMIA|ORQUIDOPEXIA|HIDROCELE/],
  ["Ginecologia e Obstetrícia", /CES[AÁ]REA|PARTO|MAGN[EÉ]SIO|HEMORRAGIA|CERCLAGEM|LAQUEADURA|HISTERECTOMIA|OOFORECTOMIA|SALPINGECTOMIA|COLPOPERINEO|CONIZA|CURETAGEM|SUBDERMICO|MAMA/],
  ["Otorrino / cabeça e pescoço", /ADENO|TURBINECTOMIA|FRENECTOMIA|TRAQUEO/],
  ["Ortopedia e odontologia", /P[EÉ] TORTO|[OÓ]SSEO|ODONTO|RETIRADA DE FIO/],
  ["Cateteres, PICC e procedimentos", /PICC|FLEBOTOMIA|SONDAGEM|SUTURA|DRENAGEM/],
  ["Aplicação e diluição", /^KIT (AMP|F\/A|EV|SUBCUT)/],
];

export function kitGroup(name: string): KitGroup {
  return RULES.find(([, re]) => re.test(name))?.[0] ?? "Cirurgia geral / pediátrica";
}
export function kitTotal(kit: SurgicalKit) {
  return Math.round(kit.items.reduce((s, i) => s + i.qty * i.cost, 0) * 100) / 100;
}
export const SURGICAL_KITS: SurgicalKit[] = raw as SurgicalKit[];
/** Find kits by barcode (exact) or by part of the name/item, optionally within a group. */
export function searchKits(query: string, group?: KitGroup | "") {
  const q = query.trim().toUpperCase();
  return SURGICAL_KITS.filter((k) => (!group || kitGroup(k.name) === group) &&
    (!q || k.code === q || k.name.toUpperCase().includes(q) || k.items.some((i) => i.name.includes(q))));
}
