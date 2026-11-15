export type Ward = "PSO" | "PSP" | "CO" | "AC" | "UTIN" | "ENFP";
export const WARDS: { id: Ward; name: string }[] = [
  { id: "PSO", name: "PS Obstétrico" },
  { id: "PSP", name: "PS Pediátrico" },
  { id: "CO", name: "Centro Obstétrico" },
  { id: "AC", name: "Alojamento Conjunto" },
  { id: "UTIN", name: "UTI Neonatal" },
  { id: "ENFP", name: "Enfermaria Pediátrica" },
];

export type Profile = "Médico" | "Enfermeiro" | "Farmacêutico" | "Recepção" | "Administrador" | "Outro";
export const PROFILES: Profile[] = ["Médico", "Enfermeiro", "Farmacêutico", "Recepção"];
export type Action = "recepcao" | "prescrever" | "evoluir" | "parto" | "checar" | "triagem" | "farmacia" | "faturar" | "cirurgia";
const PERMS: Record<Profile, Action[]> = {
  Administrador: ["recepcao", "prescrever", "evoluir", "parto", "checar", "triagem", "farmacia", "faturar", "cirurgia"],
  Outro: [],
  Médico: ["prescrever", "evoluir", "parto", "triagem", "cirurgia"],
  Enfermeiro: ["evoluir", "checar", "triagem", "cirurgia"],
  Farmacêutico: ["farmacia"],
  Recepção: ["faturar", "recepcao"],
};
export const can = (p: Profile, a: Action) => PERMS[p].includes(a);

export type PatientType = "gestante" | "puerpera" | "pediatria" | "neonato";
export type EvoCat = "Médica" | "Enfermagem" | "Fisioterapia" | "Serviço Social";
export type Risk = "Queda" | "Alergia" | "Flebite" | "Risco Hemorrágico";

export interface Evolution { time: string; cat: EvoCat; author: string; text: string }
export interface Vital { time: string; pas: number; pad: number; fc: number; fr: number; tax: number; sat: number; dor: number; ingesta: number; diurese: number; vomitos: number }
export interface PartoPoint { hour: number; dilat: number; altura: number; bcf: number; contr: number }
export type PrescCat = "Dieta" | "Hidratação" | "Medicamento" | "Cuidados" | "Exames";
export interface Prescription { id: string; cat: PrescCat; item: string; posologia: string; times?: string[]; pharmacy?: "Pendente" | "Validada" | "Dispensada" | undefined }
export interface Newborn { apgar1: number; apgar5: number; pesoNascer: number; comprimento: number; pc: number; tipagem: string; coracaozinho: string; olhinho: string; vacinas: string[]; motherId?: string | undefined }

export interface Patient {
  id: string; prontuario: string; name: string; cpf: string; motherName?: string; guardian?: string;
  type: PatientType; age: string; ig?: string; dum?: string; weight: number; height?: number;
  allergies: string[]; risks: Risk[]; specialConditions?: string[]; otherSpecialCondition?: string;
  ward: Ward; bed: string; insurance: string; guia?: string; authorized: boolean;
  diagnosis: string; admission: string; days: number; dischargeForecast?: string;
  evolutions: Evolution[]; vitals: Vital[]; prescriptions: Prescription[]; previousPrescriptions?: Prescription[];
  partograma?: PartoPoint[]; newborn?: Newborn; babyIds?: string[];
}

export const PATIENTS: Patient[] = [];

export type BedStatus = "livre" | "ocupado" | "higienizacao" | "isolamento" | "alta";
export interface BaseBed { id: string; ward: Ward; status: BedStatus }
const mk = (ward: Ward, n: number, special: Record<number, BedStatus> = {}): BaseBed[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${ward}-${String(i + 1).padStart(2, "0")}`, ward, status: special[i + 1] ?? "livre" }));
export const BASE_BEDS: BaseBed[] = WARDS.flatMap((w) => mk(w.id, w.id === "AC" || w.id === "UTIN" ? 8 : 6));
export function bedStatusFor(p: Patient): BedStatus {
  if (p.dischargeForecast === "14/11") return "alta";
  if (p.diagnosis.includes("VSR")) return "isolamento";
  return "ocupado";
}

export type Manchester = "vermelho" | "laranja" | "amarelo" | "verde" | "azul";
export const MANCHESTER: Record<Manchester, { label: string; max: number; cls: string }> = {
  vermelho: { label: "Emergência", max: 0, cls: "bg-mt-red text-primary-foreground" },
  laranja: { label: "Muito urgente", max: 10, cls: "bg-mt-orange text-primary-foreground" },
  amarelo: { label: "Urgente", max: 60, cls: "bg-mt-yellow text-foreground" },
  verde: { label: "Pouco urgente", max: 120, cls: "bg-mt-green text-primary-foreground" },
  azul: { label: "Não urgente", max: 240, cls: "bg-mt-blue text-primary-foreground" },
};
export interface QueueItem { id: string; name: string; group: "obstetrica" | "pediatria"; complaint: string; risk?: Manchester | undefined; arrivedMinAgo: number; detail: string; weight?: number | undefined }
export const QUEUE: QueueItem[] = [];

// ---------- Centro cirúrgico / obstétrico ----------
export type SurgStatus = "Agendado" | "Em Preparo" | "Em Sala" | "RPA" | "Finalizado";
export const SURG_STATUS: SurgStatus[] = ["Agendado", "Em Preparo", "Em Sala", "RPA", "Finalizado"];
export const ROOMS = ["Sala de Parto 1", "Sala de Parto 2", "Sala Cirúrgica 1", "Sala Cirúrgica 2"];
export const CHECKLIST = {
  signIn: ["Identidade e sítio confirmados", "Consentimento assinado", "Oxímetro funcionando", "Alergias verificadas", "Risco de sangramento avaliado"],
  timeOut: ["Equipe apresentada", "Procedimento confirmado", "Antibiótico profilático em 60 min", "Imagens disponíveis"],
  signOut: ["Contagem de compressas/instrumentos", "Peças identificadas", "Problemas com equipamentos registrados", "Plano de recuperação revisado"],
};
export interface Surgery {
  id: string; room: string; start: number; duration: number; patient: string; patientId?: string | undefined;
  type: "Cesárea" | "Parto Normal" | "Curetagem" | "Cirurgia Pediátrica"; tuss: string; surgeon: string; status: SurgStatus;
  checks: Record<string, boolean>; gastos: { item: string; qty: number; price: number }[];
}
export const SURGERIES: Surgery[] = [];

// ---------- Medicamentos / regras clínicas ----------
export interface Drug { name: string; cls: string; mgKgDay: number; doses: number; maxDay: number; unit: string }
export const DRUGS: Drug[] = [
  { name: "Paracetamol", cls: "analgésico", mgKgDay: 60, doses: 4, maxDay: 4000, unit: "mg" },
  { name: "Dipirona", cls: "dipirona", mgKgDay: 100, doses: 4, maxDay: 4000, unit: "mg" },
  { name: "Ibuprofeno", cls: "aine", mgKgDay: 30, doses: 3, maxDay: 1200, unit: "mg" },
  { name: "Amoxicilina", cls: "penicilina", mgKgDay: 50, doses: 3, maxDay: 3000, unit: "mg" },
  { name: "Ampicilina", cls: "penicilina", mgKgDay: 200, doses: 4, maxDay: 12000, unit: "mg" },
  { name: "Gentamicina", cls: "aminoglicosídeo", mgKgDay: 5, doses: 1, maxDay: 400, unit: "mg" },
  { name: "Prednisolona", cls: "corticoide", mgKgDay: 2, doses: 1, maxDay: 60, unit: "mg" },
  { name: "Ondansetrona", cls: "antiemético", mgKgDay: 0.45, doses: 3, maxDay: 24, unit: "mg" },
  { name: "Azitromicina", cls: "macrolídeo", mgKgDay: 10, doses: 1, maxDay: 500, unit: "mg" },
  { name: "Furosemida", cls: "diurético", mgKgDay: 2, doses: 2, maxDay: 80, unit: "mg" },
];
const INTERACTIONS: [string, string, string][] = [
  ["Ibuprofeno", "Prednisolona", "Risco aumentado de sangramento gastrointestinal"],
  ["Ondansetrona", "Azitromicina", "Prolongamento do intervalo QT"],
  ["Gentamicina", "Furosemida", "Ototoxicidade e nefrotoxicidade aumentadas"],
];

/** Dose em mg = mg/kg × peso, limitada à dose máxima quando informada. */
export function doseByWeight(mgPerKg: number, weightKg: number, maxMg?: number) {
  const d = Math.round(mgPerKg * weightKg * 100) / 100;
  return maxMg != null ? Math.min(d, maxMg) : d;
}
/** Dose diária = mg/kg/dia × peso (limitada à máxima diária); dose por tomada = diária ÷ nº de doses. */
export function pediatricDose(d: Drug, weightKg: number) {
  const day = doseByWeight(d.mgKgDay, weightKg, d.maxDay);
  return { day, perDose: Math.round((day / d.doses) * 100) / 100, capped: d.mgKgDay * weightKg > d.maxDay };
}
export function allergyConflict(drug: Drug, allergies: string[]) {
  return allergies.find((a) => { const x = a.toLowerCase(); return x.includes(drug.name.toLowerCase()) || x.includes(drug.cls) || drug.name.toLowerCase().includes(x); });
}
export function interactionsWith(drug: Drug, current: Prescription[]) {
  const names = current.filter((c) => c.cat === "Medicamento").map((c) => c.item.toLowerCase());
  return INTERACTIONS.filter(([a, b]) => (a === drug.name && names.some((n) => n.includes(b.toLowerCase()))) || (b === drug.name && names.some((n) => n.includes(a.toLowerCase())))).map(([a, b, m]) => `${a} + ${b}: ${m}`);
}

// ---------- Faturamento ----------
export const DAILY_RATE: Record<Ward, number> = { PSO: 380, PSP: 350, CO: 690, AC: 420, UTIN: 2100, ENFP: 460 };
export const MED_PRICE = 18.5;
export interface Admin { status: "checado" | "nao" | "adiado"; by: string; at: string; reason?: string | undefined }
export function buildBill(p: Patient, surgeries: Surgery[], admins: Record<string, Admin>) {
  const lines: { group: string; tuss: string; desc: string; qty: number; unit: number }[] = [];
  lines.push({ group: "Diárias", tuss: "60000775", desc: `Diária ${WARDS.find((w) => w.id === p.ward)?.name}`, qty: p.days, unit: DAILY_RATE[p.ward] });
  surgeries.filter((s) => s.patientId === p.id).forEach((s) => {
    lines.push({ group: "Procedimentos", tuss: s.tuss, desc: s.type, qty: 1, unit: s.type === "Cesárea" ? 1450 : s.type === "Parto Normal" ? 980 : 1200 });
    lines.push({ group: "Taxas de sala", tuss: "60023112", desc: `Taxa ${s.room}`, qty: 1, unit: 420 });
    s.gastos.forEach((g) => lines.push({ group: "Materiais", tuss: "—", desc: g.item, qty: g.qty, unit: g.price }));
  });
  const checked = Object.entries(admins).filter(([k, a]) => k.startsWith(p.id + "|") && a.status === "checado");
  const byItem: Record<string, number> = {};
  checked.forEach(([k]) => { const item = k.split("|")[1]; if (!item) return; byItem[item] = (byItem[item] ?? 0) + 1; });
  Object.entries(byItem).forEach(([rxId, n]) => { const r = p.prescriptions.find((x) => x.id === rxId); if (r) lines.push({ group: "Medicamentos", tuss: "90000000", desc: r.item, qty: n, unit: MED_PRICE }); });
  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.unit, 0) * 100) / 100;
  const pend: string[] = [];
  if (!p.authorized && p.insurance !== "SUS") pend.push("Guia de convênio sem autorização");
  if (!p.guia) pend.push("Número de guia/AIH não informado");
  if (p.evolutions.some((e) => e.text.length > 0 && e.author === "")) pend.push("Evolução sem assinatura médica");
  if (p.days >= 3 && !p.evolutions.some((e) => e.time.startsWith("14/11") && e.cat === "Médica")) pend.push("Falta evolução médica do dia");
  if (surgeries.some((s) => s.patientId === p.id && s.type === "Cesárea" && s.gastos.length > 3)) pend.push("Justificativa de OPME pendente");
  return { lines, total, pend };
}
