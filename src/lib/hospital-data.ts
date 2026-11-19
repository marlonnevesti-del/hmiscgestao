import type { Presentation, Regimen } from "./dose-calc";
import type { PatientRegistration } from "./patient-registration";
import type { AtbInfo, ScirasRecord } from "./sciras";
export type Ward = "PSO" | "PSP" | "CO" | "AC" | "UTIN" | "ENFP" | "UTIP" | "UCI";
export const WARDS: { id: Ward; name: string }[] = [
  { id: "PSO", name: "PS Obstétrico" },
  { id: "PSP", name: "PS Pediátrico" },
  { id: "CO", name: "Centro Obstétrico" },
  { id: "AC", name: "Alojamento Conjunto" },
  { id: "UTIN", name: "UTI Neonatal" },
  { id: "ENFP", name: "Enfermaria Pediátrica" },
  { id: "UTIP", name: "UTI Pediátrica" },
  { id: "UCI", name: "UCI – Cuidados Intermediários" },
];

export type Profile = "Médico" | "Enfermeiro" | "Técnico de enfermagem" | "Fisioterapeuta" | "Administrativo" | "Farmacêutico" | "Recepção" | "Administrador" | "Outro";
export const PROFILES: Profile[] = ["Médico", "Enfermeiro", "Farmacêutico", "Recepção"];
export type Action = "recepcao" | "prescrever" | "evoluir" | "parto" | "checar" | "triagem" | "farmacia" | "faturar" | "cirurgia" | "almoxarifado" | "nir" | "sciras";
const PERMS: Record<Profile, Action[]> = {
  Administrador: ["recepcao", "prescrever", "evoluir", "parto", "checar", "triagem", "farmacia", "faturar", "cirurgia", "almoxarifado", "nir", "sciras"],
  Outro: [],
  Médico: ["prescrever", "evoluir", "parto", "triagem", "cirurgia", "nir"],
  Enfermeiro: ["evoluir", "checar", "triagem", "cirurgia", "nir"],
  "Técnico de enfermagem": ["checar"],
  Fisioterapeuta: ["evoluir"],
  Administrativo: ["faturar", "almoxarifado"],
  Farmacêutico: ["farmacia", "almoxarifado"],
  Recepção: ["recepcao"],
};
export const can = (p: Profile, a: Action) => PERMS[p].includes(a);
/** Areas granted by the admin that also unlock the matching action, regardless of job function. */
const ACTION_AREAS: Partial<Record<Action, string>> = { recepcao: "recepcao", triagem: "acolhimento", prescrever: "atendimento", farmacia: "farmacia", almoxarifado: "almoxarifado", checar: "enfermagem", faturar: "faturamento", cirurgia: "centro-cirurgico", nir: "nir", sciras: "sciras" };
export function canAct(p: Profile, a: Action, areas?: readonly string[] | null) {
  if (can(p, a)) return true;
  const id = ACTION_AREAS[a]; if (!id || !areas) return false;
  return areas.some((x) => x === id || x.endsWith(`:${id}`));
}
export const ACCESS_AREAS = [
  { id: "recepcao", label: "Recepção & Cadastro" }, { id: "acolhimento", label: "Triagem / Enfermagem" },
  { id: "atendimento", label: "Consultório Médico" }, { id: "pacientes", label: "Pacientes / PEP" },
  { id: "enfermagem", label: "Posto de Enfermagem" }, { id: "centro-cirurgico", label: "Centro Cirúrgico" }, { id: "cme", label: "CME – Esterilização" },
  { id: "farmacia", label: "Farmácia" }, { id: "almoxarifado", label: "Almoxarifado" }, { id: "faturamento", label: "Faturamento (TISS e SUS)" }, { id: "nir", label: "NIR – Regulação de Leitos" }, { id: "sciras", label: "SCIRAS / CCIH" },
] as const;
export type UnitArea = "ambulatorio" | "pronto-socorro" | "maternidade";
export type UnitTab = "agenda" | "recepcao" | "acolhimento" | "atendimento" | "sadt" | "especialidades" | "internados" | "relatorios" | "aguardando" | "observacao" | "assistencia" | "coordenacao";
/** Care-unit entries with their selectable sub-levels (stored as "unit:tab"). */
export const UNIT_AREAS: { id: UnitArea; label: string; tabs: { id: UnitTab; label: string }[] }[] = [
  { id: "ambulatorio", label: "Ambulatório", tabs: [{ id: "agenda", label: "Agenda" }, { id: "recepcao", label: "Recepção / Chegada" }, { id: "acolhimento", label: "Pré-consulta de enfermagem" }, { id: "atendimento", label: "Atendimento Médico" }, { id: "sadt", label: "SADT · Laudos" }, { id: "especialidades", label: "Especialidades" }, { id: "relatorios", label: "Relatórios" }] },
  { id: "pronto-socorro", label: "Pronto Socorro", tabs: [{ id: "recepcao", label: "Recepção / Cadastro" }, { id: "acolhimento", label: "Triagem" }, { id: "aguardando", label: "Aguardando consulta" }, { id: "atendimento", label: "Atendimento Médico" }, { id: "observacao", label: "Observação e leitos" }, { id: "assistencia", label: "Escalas e sepse" }, { id: "internados", label: "Pacientes internados" }, { id: "coordenacao", label: "Coordenação / Indicadores" }] },
  { id: "maternidade", label: "Maternidade", tabs: [{ id: "recepcao", label: "Recepção / Cadastro" }, { id: "acolhimento", label: "Triagem" }, { id: "atendimento", label: "Atendimento Médico" }, { id: "internados", label: "Pacientes internados" }] },
];
/** Pharmacy sections shown as sidebar sub-items (/farmacia?aba=id). */
export const PHARMACY_TABS = [
  { id: "fila", label: "Fila de prescrições" }, { id: "controlados", label: "Armário de controlados" },
  { id: "validades", label: "Validades / Estorno" }, { id: "consumo", label: "Consumo mensal" },
  { id: "estoque", label: "Estoque geral" }, { id: "pedidos", label: "Pedidos da enfermagem" },
  { id: "entrada", label: "Entrada NF" }, { id: "emprestimo", label: "Empréstimos" },
  { id: "transferencia", label: "Transferência" }, { id: "devolucao", label: "Devolução" },
  { id: "quebra", label: "Quebra / Extravio" }, { id: "dispensados", label: "Medicamentos prescritos" },
  { id: "kits", label: "Kits do centro cirúrgico" },
  { id: "etiquetas", label: "Etiquetas" },
  { id: "requisicao", label: "Saída via requisição" }, { id: "mapa", label: "Mapa de movimentação" },
] as const;
/** Warehouse sections shown as sidebar sub-items (/almoxarifado?aba=id). */
export const WAREHOUSE_TABS = [
  { id: "pedidos", label: "Pedidos dos setores" }, { id: "validades", label: "Validades / Estorno" },
  { id: "consumo", label: "Consumo mensal" }, { id: "estoque", label: "Estoque geral" },
  { id: "entrada", label: "Entrada NF" }, { id: "emprestimo", label: "Empréstimos" },
  { id: "transferencia", label: "Transferência" }, { id: "devolucao", label: "Devolução" },
  { id: "quebra", label: "Quebra / Extravio" }, { id: "etiquetas", label: "Etiquetas" },
  { id: "requisicao", label: "Saída via requisição" }, { id: "mapa", label: "Mapa de movimentação" },
] as const;
const UNIT_IDS: string[] = UNIT_AREAS.map((u) => u.id);
/** Default (function-derived) permission for one tab of a care unit. */
function tabByFunction(profile: Profile, tab: UnitTab) {
  if (tab === "atendimento") return can(profile, "prescrever");
  if (tab === "acolhimento") return can(profile, "triagem");
  if (tab === "sadt") return can(profile, "prescrever");
  if (tab === "relatorios" || tab === "coordenacao") return profile === "Administrador";
  if (tab === "aguardando" || tab === "observacao" || tab === "assistencia") return can(profile, "triagem") || can(profile, "checar") || can(profile, "prescrever");
  if (tab === "internados") return can(profile, "prescrever") || can(profile, "evoluir") || can(profile, "checar") || can(profile, "recepcao");
  return can(profile, "recepcao");
}
export function canAccessUnitTab(profile: Profile, unit: UnitArea, tab: UnitTab, areas?: readonly string[] | null) {
  if (profile === "Administrador") return true;
  if (!areas) return tabByFunction(profile, tab);
  return areas.includes(unit) || areas.includes(`${unit}:${tab}`);
}
export const defaultAreas = (profile: Profile): string[] => [
  ...ACCESS_AREAS.map((a) => a.id as string).filter((id) => canAccessPage(profile, `/${id}`)),
  ...UNIT_AREAS.flatMap((u) => u.tabs.filter((t) => tabByFunction(profile, t.id)).map((t) => `${u.id}:${t.id}`)),
];
/** Areas chosen by the admin override the function defaults; null means "use the function". */
export function canAccessPage(profile: Profile, path: string, areas?: readonly string[] | null) {
  if (profile === "Administrador") return true;
  if (path.startsWith("/gestao-atendimentos")) return false;
  if (path === "/" || path === "/painel-tv" || path === "/solicitacao-almoxarifado") return true;
  const seg = path.split("/")[1] ?? "";
  if (UNIT_IDS.includes(seg)) { const u = UNIT_AREAS.find((x) => x.id === seg)!; return u.tabs.some((t) => canAccessUnitTab(profile, u.id, t.id, areas)); }
  if (areas) return areas.includes(seg === "faturamento-sus" || seg === "prestacao-contas" ? "faturamento" : seg === "internacoes" ? "nir" : seg === "uti-uci" ? "enfermagem" : seg);
  if (path === "/recepcao") return can(profile, "recepcao");
  if (path === "/acolhimento") return can(profile, "triagem");
  if (path === "/atendimento") return can(profile, "prescrever");
  if (path.startsWith("/pacientes")) return can(profile, "evoluir") || can(profile, "prescrever") || can(profile, "checar");
  if (path === "/centro-cirurgico" || path === "/cme" || path === "/gestao-cirurgica") return can(profile, "cirurgia");
  if (path === "/farmacia") return can(profile, "farmacia");
  if (path === "/almoxarifado") return can(profile, "almoxarifado");
  if (path === "/nir" || path === "/internacoes") return can(profile, "nir");
  if (path === "/sciras") return can(profile, "sciras");
  if (path === "/uti-uci") return can(profile, "evoluir") || can(profile, "checar");
  if (path === "/enfermagem") return can(profile, "checar");
  if (path === "/faturamento" || path === "/faturamento-sus" || path === "/prestacao-contas") return can(profile, "faturar");
  return false;
}

export type PatientType = "gestante" | "puerpera" | "pediatria" | "neonato";
export type EvoCat = "Médica" | "Enfermagem" | "Fisioterapia" | "Serviço Social" | "SCIRAS";
export type Risk = "Queda" | "Alergia" | "Flebite" | "Risco Hemorrágico";

export interface Evolution { time: string; cat: EvoCat; author: string; text: string }
export interface Vital { time: string; pas: number; pad: number; fc: number; fr: number; tax: number; sat: number; dor: number; ingesta: number; diurese: number; vomitos: number }
export interface PartoPoint { hour: number; dilat: number; altura: number; bcf: number; contr: number }
export type PrescCat = "Dieta" | "Hidratação" | "Medicamento" | "Cuidados" | "Exames";
export interface Prescription { id: string; cat: PrescCat; item: string; posologia: string; times?: string[]; pharmacy?: "Pendente" | "Validada" | "Dispensada" | undefined; lot?: string | undefined; atb?: AtbInfo | undefined }
export interface Newborn { apgar1: number; apgar5: number; pesoNascer: number; comprimento: number; pc: number; tipagem: string; coracaozinho: string; olhinho: string; vacinas: string[]; motherId?: string | undefined }

export interface Patient {
  registration?: PatientRegistration;
  id: string; prontuario: string; name: string; cpf: string; motherName?: string; guardian?: string;
  type: PatientType; age: string; ig?: string; dum?: string; weight: number; height?: number;
  allergies: string[]; risks: Risk[]; specialConditions?: string[]; otherSpecialCondition?: string;
  ward: Ward; bed: string; insurance: string; guia?: string; authorized: boolean;
  diagnosis: string; admission: string; days: number; dischargeForecast?: string;
  evolutions: Evolution[]; vitals: Vital[]; prescriptions: Prescription[]; previousPrescriptions?: Prescription[];
  sciras?: ScirasRecord; partograma?: PartoPoint[]; newborn?: Newborn; babyIds?: string[];
  intensive?: import("./uti-uci").IntensiveRecord;
}

export const PATIENTS: Patient[] = [];

export type BedStatus = "livre" | "ocupado" | "higienizacao" | "isolamento" | "alta";
export interface BaseBed { id: string; ward: Ward; status: BedStatus }
const mk = (ward: Ward, n: number, special: Record<number, BedStatus> = {}): BaseBed[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${ward}-${String(i + 1).padStart(2, "0")}`, ward, status: special[i + 1] ?? "livre" }));
export const BASE_BEDS: BaseBed[] = WARDS.flatMap((w) => mk(w.id, w.id === "AC" || w.id === "UTIN" || w.id === "UCI" ? 8 : 6));
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
export const ROOMS = ["Sala Cirúrgica 1", "Sala Cirúrgica 2", "Sala Cirúrgica 3", "Sala Cirúrgica 4", "Sala de Parto 1", "Sala de Parto 2"];
export const CHECKLIST = {
  signIn: ["Identidade e sítio confirmados", "Consentimento assinado", "Oxímetro funcionando", "Alergias verificadas", "Risco de sangramento avaliado"],
  timeOut: ["Equipe apresentada", "Procedimento confirmado", "Antibiótico profilático em 60 min", "Imagens disponíveis"],
  signOut: ["Contagem de compressas/instrumentos", "Peças identificadas", "Problemas com equipamentos registrados", "Plano de recuperação revisado"],
};
export interface Surgery {
  id: string; room: string; start: number; duration: number; patient: string; patientId?: string | undefined;
  type: string; tuss: string; surgeon: string; status: SurgStatus;
  checks: Record<string, boolean>; gastos: { item: string; qty: number; price: number }[];
  kits?: { kitId: string; name: string; cycle: string; autoclave: string; at: string; by: string }[];
  date?: string; urgency?: "Eletiva" | "Urgência"; team?: SurgTeam; report?: SurgReport;
  procedures?: string[]; suspension?: import("./surgical-center").Suspension; saep?: import("./surgical-center").Saep; srpa?: import("./surgical-center").SrpaStay; obstetric?: import("./surgical-center").Obstetric; coBed?: string;
}
export const PROCEDURES = ["Cesárea", "Parto Normal", "Parto Instrumentado", "Curetagem", "Laqueadura", "Cirurgia Pediátrica", "Apendicectomia", "Herniorrafia", "Postectomia", "Orquidopexia", "Outro"];
export const ANESTHESIA = ["Geral", "Raquianestesia", "Peridural", "Combinada", "Sedação", "Local", "Bloqueio"];
export const DESTINATIONS = ["RPA", "Alojamento Conjunto", "Enfermaria", "UTI Neonatal", "UTI Pediátrica", "Alta"];
export interface SurgTeam { surgeon: string; surgeonCrm: string; assistant: string; anesthetist: string; anesthetistCrm: string; pediatrician: string; scrub: string; circulating: string }
export interface SurgReport { roomIn: string; induction: string; incision: string; end: string; roomOut: string; anesthesia: string; preDx: string; postDx: string; technique: string; findings: string; bloodLoss: string; drains: string; specimen: string; complications: string; destination: string; anesthesiaNotes: string; by: string; at: string }
export const EMPTY_TEAM: SurgTeam = { surgeon: "", surgeonCrm: "", assistant: "", anesthetist: "", anesthetistCrm: "", pediatrician: "", scrub: "", circulating: "" };
export const EMPTY_REPORT: SurgReport = { roomIn: "", induction: "", incision: "", end: "", roomOut: "", anesthesia: "", preDx: "", postDx: "", technique: "", findings: "", bloodLoss: "", drains: "", specimen: "", complications: "Sem intercorrências", destination: "RPA", anesthesiaNotes: "", by: "", at: "" }
export const SURGERIES: Surgery[] = [];

// ---------- Medicamentos / regras clínicas ----------
export interface Drug { name: string; cls: string; mgKgDay: number; doses: number; maxDay: number; unit: string; regimens?: Regimen[]; presentations?: Presentation[] }
const P = (label: string, mgPerMl: number, dropsPerMl?: number): Presentation => ({ label, mgPerMl, ...(dropsPerMl ? { dropsPerMl } : {}) });
export const DRUGS: Drug[] = [
  { name: "Paracetamol", cls: "analgésico", mgKgDay: 60, doses: 4, maxDay: 4000, unit: "mg", presentations: [P("gotas 200 mg/mL", 200, 20), P("solução 32 mg/mL", 32)] },
  { name: "Dipirona", cls: "dipirona", mgKgDay: 100, doses: 4, maxDay: 4000, unit: "mg", presentations: [P("gotas 500 mg/mL", 500, 20), P("ampola 500 mg/mL EV/IM", 500)] },
  { name: "Ibuprofeno", cls: "aine", mgKgDay: 30, doses: 3, maxDay: 1200, unit: "mg", presentations: [P("gotas 100 mg/mL", 100, 10), P("suspensão 50 mg/mL", 50)] },
  { name: "Amoxicilina", cls: "penicilina", mgKgDay: 50, doses: 3, maxDay: 3000, unit: "mg", regimens: [{ label: "Padrão", mgKgDay: 50, doses: 3, maxDay: 3000 }, { label: "Dose alta (OMA / pneumonia)", mgKgDay: 90, doses: 2, maxDay: 4000 }], presentations: [P("suspensão 250 mg/5 mL", 50), P("suspensão 400 mg/5 mL", 80)] },
  { name: "Ampicilina", cls: "penicilina", mgKgDay: 200, doses: 4, maxDay: 12000, unit: "mg", regimens: [{ label: "Padrão", mgKgDay: 100, doses: 4, maxDay: 8000 }, { label: "Grave / meningite", mgKgDay: 200, doses: 4, maxDay: 12000 }], presentations: [P("FA 1 g reconstituído em 10 mL", 100)] },
  { name: "Gentamicina", cls: "aminoglicosídeo", mgKgDay: 5, doses: 1, maxDay: 400, unit: "mg", presentations: [P("ampola 40 mg/mL", 40)] },
  { name: "Prednisolona", cls: "corticoide", mgKgDay: 2, doses: 1, maxDay: 60, unit: "mg", presentations: [P("solução oral 3 mg/mL", 3)] },
  { name: "Ondansetrona", cls: "antiemético", mgKgDay: 0.45, doses: 3, maxDay: 24, unit: "mg", presentations: [P("ampola/solução 2 mg/mL", 2)] },
  { name: "Azitromicina", cls: "macrolídeo", mgKgDay: 10, doses: 1, maxDay: 500, unit: "mg", presentations: [P("suspensão 200 mg/5 mL", 40)] },
  { name: "Furosemida", cls: "diurético", mgKgDay: 2, doses: 2, maxDay: 80, unit: "mg", presentations: [P("ampola 10 mg/mL", 10)] },
  { name: "Ceftriaxona", cls: "cefalosporina", mgKgDay: 50, doses: 1, maxDay: 2000, unit: "mg", regimens: [{ label: "Padrão", mgKgDay: 50, doses: 1, maxDay: 2000 }, { label: "Meningite / SNC", mgKgDay: 100, doses: 2, maxDay: 4000 }], presentations: [P("FA 1 g reconstituído em 10 mL", 100)] },
  { name: "Cefazolina", cls: "cefalosporina", mgKgDay: 75, doses: 3, maxDay: 6000, unit: "mg", regimens: [{ label: "Padrão", mgKgDay: 75, doses: 3, maxDay: 6000 }, { label: "Grave", mgKgDay: 100, doses: 3, maxDay: 6000 }], presentations: [P("FA 1 g reconstituído em 10 mL", 100)] },
  { name: "Oxacilina", cls: "penicilina", mgKgDay: 150, doses: 4, maxDay: 12000, unit: "mg", regimens: [{ label: "Padrão", mgKgDay: 100, doses: 4, maxDay: 12000 }, { label: "Grave", mgKgDay: 200, doses: 4, maxDay: 12000 }], presentations: [P("FA 500 mg reconstituído em 5 mL", 100)] },
  { name: "Dexametasona", cls: "corticoide", mgKgDay: 0.15, doses: 1, maxDay: 10, unit: "mg", regimens: [{ label: "Anti-inflamatória", mgKgDay: 0.15, doses: 1, maxDay: 10 }, { label: "Laringite / ataque", mgKgDay: 0.6, doses: 1, maxDay: 16 }], presentations: [P("ampola 4 mg/mL", 4)] },
  { name: "Hidrocortisona", cls: "corticoide", mgKgDay: 20, doses: 4, maxDay: 1000, unit: "mg", regimens: [{ label: "Manutenção (5 mg/kg/dose 6/6h)", mgKgDay: 20, doses: 4, maxDay: 1000 }, { label: "Ataque (10 mg/kg dose única)", mgKgDay: 10, doses: 1, maxDay: 500 }], presentations: [P("FA 100 mg reconstituído em 2 mL", 50), P("FA 500 mg reconstituído em 4 mL", 125)] },
  { name: "Sulfametoxazol + Trimetoprima", cls: "sulfonamida", mgKgDay: 40, doses: 2, maxDay: 1600, unit: "mg (SMX)", presentations: [P("suspensão 200+40 mg/5 mL (SMX)", 40)] },
  { name: "Salbutamol", cls: "broncodilatador", mgKgDay: 0.45, doses: 3, maxDay: 15, unit: "mg", presentations: [P("solução inalação 5 mg/mL", 5, 20)] },
  { name: "Ipratrópio", cls: "broncodilatador", mgKgDay: 0.75, doses: 3, maxDay: 1.5, unit: "mg", presentations: [P("gotas inalação 0,25 mg/mL", 0.25, 20)] },
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
export const DAILY_RATE: Record<Ward, number> = { PSO: 380, PSP: 350, CO: 690, AC: 420, UTIN: 2100, ENFP: 460, UTIP: 2100, UCI: 1200 };
export const MED_PRICE = 18.5;
export interface Admin { status: "checado" | "nao" | "adiado" | "cancelado"; by: string; at: string; reason?: string | undefined }
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
  if (p.evolutions.some((e) => e.text.length > 0 && e.author === "")) pend.push("Evolução sem profissional identificado");
  if (p.days >= 3 && !p.evolutions.some((e) => e.time.startsWith("14/11") && e.cat === "Médica")) pend.push("Falta evolução médica do dia");
  if (surgeries.some((s) => s.patientId === p.id && s.type === "Cesárea" && s.gastos.length > 3)) pend.push("Justificativa de OPME pendente");
  return { lines, total, pend };
}
