/** SCIRAS / CCIH rules: antimicrobial stewardship, multidrug-resistant alerts, bundles. */
import type { Patient, Prescription } from "./hospital-data";

export const ANTIMICROBIALS = ["amicacina","amoxicilina","ampicilina","azitromicina","aztreonam","cefalexina","cefalotina","cefazolina","cefepima","cefoxitina","ceftazidima","ceftriaxona","cefuroxima","ciprofloxacino","claritromicina","clindamicina","daptomicina","ertapenem","fluconazol","gentamicina","imipenem","levofloxacino","linezolida","meropenem","metronidazol","micafungina","anidulafungina","oxacilina","penicilina","piperacilina","polimixina","sulfametoxazol","teicoplanina","tigeciclina","vancomicina","voriconazol","anfotericina","ceftazidima-avibactam","colistina","moxifloxacino"] as const;
/** Broad-spectrum drugs that need infectologist authorization (institutional protocol). */
export const RESTRICTED = ["cefepima","ceftazidima","ceftazidima-avibactam","colistina","daptomicina","ertapenem","imipenem","linezolida","meropenem","micafungina","anidulafungina","piperacilina","polimixina","teicoplanina","tigeciclina","vancomicina","voriconazol","anfotericina"] as const;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const isAntimicrobial = (item: string) => ANTIMICROBIALS.some((d) => norm(item).includes(d));
export const isRestricted = (item: string) => RESTRICTED.some((d) => norm(item).includes(d));

export type AtbStatus = "Livre" | "Aguardando SCIRAS" | "Autorizado" | "Negado";
export interface AtbInfo {
  weight: number; vitals: string; dose: string; interval: string; focus: string; days: number; justification: string;
  restricted: boolean; status: AtbStatus; requestedAt: string; requestedBy: string;
  decidedAt?: string; decidedBy?: string; decisionNote?: string; authorizedDays?: number;
}
export type AtbForm = Pick<AtbInfo, "weight" | "vitals" | "dose" | "interval" | "focus" | "days" | "justification">;

/** Returns the list of missing mandatory fields (empty = valid). */
export function atbMissing(f: AtbForm): string[] {
  const miss: string[] = [];
  if (!(f.weight > 0)) miss.push("Peso atualizado");
  if (!f.vitals.trim()) miss.push("Sinais vitais");
  if (!f.dose.trim()) miss.push("Dose");
  if (!f.interval.trim()) miss.push("Intervalo");
  if (!f.focus.trim()) miss.push("Foco infeccioso");
  if (!(f.days > 0)) miss.push("Tempo previsto (dias)");
  if (f.justification.trim().length < 10) miss.push("Justificativa (mín. 10 caracteres)");
  return miss;
}
export function newAtb(item: string, f: AtbForm, by: string, at = new Date().toLocaleString("pt-BR")): AtbInfo {
  const restricted = isRestricted(item);
  return { ...f, restricted, status: restricted ? "Aguardando SCIRAS" : "Livre", requestedAt: at, requestedBy: by };
}
/** Pharmacy may only validate/dispense antimicrobials not waiting for or denied by SCIRAS. */
export const atbBlocksPharmacy = (r: Prescription) => r.atb?.status === "Aguardando SCIRAS" || r.atb?.status === "Negado";

export const MDR_ORGANISMS = ["KPC – Klebsiella produtora de carbapenemase", "MRSA – S. aureus resistente à meticilina", "VRE – Enterococo resistente à vancomicina", "Acinetobacter baumannii MDR", "Pseudomonas aeruginosa MDR", "Enterobactéria ESBL", "Enterobactéria NDM", "Candida auris", "Clostridioides difficile", "Outro microrganismo de importância epidemiológica"] as const;
export const PRECAUTIONS = ["Padrão", "Contato", "Gotículas", "Aerossóis"] as const;
export interface Isolate { id: string; organism: string; material: string; resistance: string; precaution: string; at: string; by: string }
export interface InfectionCase { id: string; site: string; notes: string; openedAt: string; openedBy: string; status: "Aberto" | "Encerrado"; classification?: string; closedAt?: string; closedBy?: string }
export interface BundleCheck { id: string; type: BundleType; at: string; by: string; items: Record<string, boolean> }
export interface ScirasRecord { isolates: Isolate[]; cases: InfectionCase[]; bundles: BundleCheck[] }
export const emptySciras = (): ScirasRecord => ({ isolates: [], cases: [], bundles: [] });

export type BundleType = "PAV" | "IPCS / CVC" | "ITU / SVD" | "ISC";
export const BUNDLES: Record<BundleType, string[]> = {
  PAV: ["Cabeceira elevada 30–45°", "Higiene oral com clorexidina", "Pressão do cuff 20–30 cmH2O", "Despertar diário / avaliação de extubação", "Circuito sem condensado"],
  "IPCS / CVC": ["Higiene das mãos antes do manuseio", "Curativo íntegro e datado", "Desinfecção dos conectores", "Avaliação diária da necessidade do cateter"],
  "ITU / SVD": ["Bolsa abaixo do nível da bexiga", "Sistema fechado mantido", "Fixação adequada", "Avaliação diária da necessidade da sonda"],
  ISC: ["Antibioticoprofilaxia até 60 min antes da incisão", "Tricotomia apenas se necessária", "Normotermia mantida", "Controle glicêmico"],
};
export const bundleAdherence = (b: BundleCheck) => { const v = Object.values(b.items); return v.length ? Math.round((v.filter(Boolean).length / v.length) * 100) : 0; };

const DAY = 86_400_000;
/** True when the patient had another encounter that started up to 180 days before the latest one. */
export function readmittedWithin6Months(openedAts: string[]): boolean {
  const t = openedAts.map((x) => Date.parse(x)).filter((n) => !Number.isNaN(n)).sort((a, b) => b - a);
  return t.length > 1 && t[0]! - t[1]! <= 180 * DAY;
}
/** SCIRAS alert: multidrug-resistant/epidemiological organism on record and readmission under 6 months. */
export function scirasAlert(p: Patient, openedAts: string[]): { mdr: boolean; readmitted: boolean; alert: boolean } {
  const mdr = (p.sciras?.isolates.length ?? 0) > 0; const readmitted = readmittedWithin6Months(openedAts);
  return { mdr, readmitted, alert: mdr && readmitted };
}
