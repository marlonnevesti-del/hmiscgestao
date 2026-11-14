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
export type Action = "prescrever" | "evoluir" | "parto" | "checar" | "triagem" | "farmacia" | "faturar" | "cirurgia";
const PERMS: Record<Profile, Action[]> = {
  Administrador: ["prescrever", "evoluir", "parto", "checar", "triagem", "farmacia", "faturar", "cirurgia"],
  Outro: [],
  Médico: ["prescrever", "evoluir", "parto", "triagem", "cirurgia"],
  Enfermeiro: ["evoluir", "checar", "triagem", "cirurgia"],
  Farmacêutico: ["farmacia"],
  Recepção: ["faturar", "triagem"],
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
  allergies: string[]; risks: Risk[]; ward: Ward; bed: string; insurance: string; guia?: string; authorized: boolean;
  diagnosis: string; admission: string; days: number; dischargeForecast?: string;
  evolutions: Evolution[]; vitals: Vital[]; prescriptions: Prescription[]; previousPrescriptions?: Prescription[];
  partograma?: PartoPoint[]; newborn?: Newborn; babyIds?: string[];
}

const v = (time: string, pas: number, pad: number, fc: number, fr: number, tax: number, sat: number, dor: number, ingesta = 300, diurese = 250, vomitos = 0): Vital => ({ time, pas, pad, fc, fr, tax, sat, dor, ingesta, diurese, vomitos });
let seq = 0;
const rx = (cat: PrescCat, item: string, posologia: string, times?: string[], pharmacy?: Prescription["pharmacy"]): Prescription => ({ id: `rx${++seq}`, cat, item, posologia, ...(times ? { times } : {}), ...(cat === "Medicamento" ? { pharmacy: pharmacy ?? "Dispensada" } : {}) });

export const PATIENTS: Patient[] = [
  {
    id: "p1", prontuario: "2026-004812", name: "Mariana Alves Rocha", cpf: "123.456.789-00", type: "gestante", age: "28 anos", ig: "39s 2d", dum: "12/02/2026", weight: 78.4, height: 164,
    allergies: ["Dipirona"], risks: ["Alergia", "Queda"], ward: "CO", bed: "CO-02", insurance: "Unimed", guia: "UN-883412", authorized: true, diagnosis: "Trabalho de parto ativo – G2P1", admission: "14/11 05:40", days: 1,
    evolutions: [
      { time: "14/11 09:30", cat: "Médica", author: "Dra. Helena Prado", text: "Dilatação 7 cm, apresentação cefálica -1 (De Lee), BCF 142 bpm, 4 contrações/10min. Bolsa rota às 08h, líquido claro. Conduta expectante." },
      { time: "14/11 08:00", cat: "Enfermagem", author: "Enf. Carla Souza", text: "Paciente deambulando, aceitando dieta líquida. Orientada sobre métodos não farmacológicos de alívio da dor." },
      { time: "14/11 07:15", cat: "Fisioterapia", author: "Ft. Rafael Lima", text: "Exercícios com bola suíça e técnicas respiratórias. Boa adesão." },
      { time: "14/11 05:50", cat: "Médica", author: "Dr. Paulo Mendes", text: "Admissão: gestante 39s2d, contrações regulares, dilatação 4 cm. Sorologias negativas. Internada para assistência ao parto." },
    ],
    vitals: [v("00:00", 116, 74, 86, 18, 36.4, 98, 3), v("06:00", 118, 76, 88, 18, 36.5, 98, 5), v("12:00", 124, 82, 94, 19, 37.0, 98, 7)],
    prescriptions: [
      rx("Dieta", "Dieta líquida restrita", "VO, livre demanda"),
      rx("Hidratação", "Ringer Lactato 500 mL", "EV, 125 mL/h"),
      rx("Medicamento", "Paracetamol 750 mg", "VO 6/6h se dor", ["06:00", "12:00", "18:00", "00:00"]),
      rx("Cuidados", "Ausculta BCF a cada 30 min", "Contínuo"),
      rx("Exames", "Hemograma + Tipagem ABO/Rh", "Admissão"),
    ],
    partograma: [
      { hour: 0, dilat: 4, altura: -3, bcf: 140, contr: 2 }, { hour: 1, dilat: 5, altura: -2, bcf: 138, contr: 3 },
      { hour: 2, dilat: 5, altura: -2, bcf: 144, contr: 3 }, { hour: 3, dilat: 6, altura: -1, bcf: 142, contr: 4 },
      { hour: 4, dilat: 7, altura: -1, bcf: 142, contr: 4 },
    ],
  },
  {
    id: "p2", prontuario: "2026-004790", name: "Juliana Ferreira Costa", cpf: "234.567.890-11", type: "puerpera", age: "33 anos", weight: 71.2, height: 160,
    allergies: [], risks: ["Flebite"], ward: "AC", bed: "AC-01", insurance: "SUS", guia: "AIH 3526100012345", authorized: true, diagnosis: "Puerpério pós-cesárea (D1) – Pré-eclâmpsia", admission: "13/11 14:10", days: 2, dischargeForecast: "15/11",
    evolutions: [
      { time: "14/11 08:40", cat: "Médica", author: "Dra. Helena Prado", text: "1º DPO de cesárea por pré-eclâmpsia. PA controlada com metildopa. Ferida operatória limpa, útero contraído, lóquios fisiológicos." },
      { time: "14/11 07:00", cat: "Enfermagem", author: "Enf. Carla Souza", text: "Sinais de flebite grau 1 em MSE; acesso trocado. Amamentação em livre demanda com boa pega." },
      { time: "13/11 16:00", cat: "Serviço Social", author: "AS Mônica Teles", text: "Orientada sobre registro civil do RN e licença-maternidade." },
    ],
    vitals: [v("00:00", 140, 90, 82, 17, 36.5, 98, 3), v("06:00", 142, 92, 84, 17, 36.4, 98, 3), v("12:00", 136, 88, 80, 16, 36.6, 99, 3)],
    prescriptions: [
      rx("Dieta", "Dieta branda hipossódica", "VO"),
      rx("Medicamento", "Metildopa 500 mg", "VO 8/8h", ["06:00", "14:00", "22:00"]),
      rx("Medicamento", "Paracetamol 750 mg", "VO 6/6h se dor", ["06:00", "12:00", "18:00", "00:00"]),
      rx("Cuidados", "Aferir PA 4/4h", "Contínuo"),
    ],
    babyIds: ["p6"],
  },
  {
    id: "p3", prontuario: "2026-004801", name: "Lucas Oliveira Santos", cpf: "345.678.901-22", motherName: "Fernanda Oliveira Santos", guardian: "Fernanda Oliveira Santos (mãe)", type: "pediatria", age: "8 meses", weight: 8.2, height: 70,
    allergies: ["Amoxicilina"], risks: ["Alergia", "Queda"], ward: "ENFP", bed: "ENFP-01", insurance: "Bradesco Saúde", guia: "BR-551200", authorized: false, diagnosis: "Bronquiolite viral aguda (VSR+)", admission: "12/11 22:30", days: 3, dischargeForecast: "16/11",
    evolutions: [
      { time: "14/11 09:00", cat: "Médica", author: "Dr. André Nunes", text: "Melhora do desconforto respiratório. Sibilos esparsos, tiragem subcostal leve. SatO2 95% com O2 0,5 L/min. Manter suporte." },
      { time: "14/11 08:10", cat: "Fisioterapia", author: "Ft. Rafael Lima", text: "Desobstrução rinofaríngea retrógrada com SF 0,9%. Boa resposta." },
      { time: "14/11 06:00", cat: "Enfermagem", author: "Enf. Bruna Dias", text: "Aceitou 120 mL de fórmula. Diurese presente. Cabeceira elevada 30°." },
    ],
    vitals: [v("00:00", 90, 55, 150, 54, 38.0, 92, 2, 120, 90, 20), v("06:00", 90, 55, 148, 52, 37.8, 93, 2, 120, 90), v("12:00", 92, 56, 140, 46, 37.4, 95, 1, 130, 100)],
    prescriptions: [
      rx("Hidratação", "Soro de manutenção (Holliday-Segar)", "EV 34 mL/h"),
      rx("Medicamento", "Paracetamol 123 mg (15 mg/kg)", "VO 6/6h se febre", ["06:00", "12:00", "18:00", "00:00"]),
      rx("Cuidados", "O2 por cateter nasal 0,5 L/min", "Manter SatO2 ≥ 92%"),
      rx("Exames", "Painel viral respiratório", "Coletado"),
    ],
  },
  {
    id: "p4", prontuario: "2026-004777", name: "RN de Patrícia Gomes Lima", cpf: "—", motherName: "Patrícia Gomes Lima", type: "neonato", age: "5 dias", ig: "32s 4d (ao nascer)", weight: 1.72, height: 42,
    allergies: [], risks: ["Flebite"], ward: "UTIN", bed: "UTIN-03", insurance: "SUS", guia: "AIH 3526100019876", authorized: true, diagnosis: "Prematuridade – Desconforto respiratório precoce", admission: "09/11 03:15", days: 6,
    evolutions: [
      { time: "14/11 09:20", cat: "Médica", author: "Dra. Lívia Castro", text: "Em CPAP nasal, FiO2 25%. Tolerando dieta enteral por SOG 12 mL 3/3h. Icterícia em fototerapia. Balanço hídrico rigoroso: meta 150 mL/kg/dia." },
      { time: "14/11 07:30", cat: "Enfermagem", author: "Enf. Bruna Dias", text: "Incubadora 34°C. Mudança de decúbito realizada. Mãe presente para método canguru." },
    ],
    vitals: [v("00:00", 50, 30, 158, 56, 36.5, 93, 1, 62, 48, 2), v("06:00", 52, 30, 156, 54, 36.6, 94, 1, 64, 50, 0), v("12:00", 55, 32, 150, 48, 36.7, 96, 0, 64, 54, 0)],
    prescriptions: [
      rx("Dieta", "Leite materno ordenhado", "SOG 12 mL 3/3h"),
      rx("Hidratação", "NPT neonatal", "EV 4,5 mL/h"),
      rx("Medicamento", "Cafeína citrato 8,6 mg (5 mg/kg)", "EV 1x/dia", ["08:00"]),
      rx("Cuidados", "Fototerapia contínua", "Proteção ocular"),
      rx("Cuidados", "Balanço hídrico rigoroso 6/6h", "Pesar fraldas"),
    ],
    newborn: { apgar1: 6, apgar5: 8, pesoNascer: 1680, comprimento: 41, pc: 29, tipagem: "A+", coracaozinho: "Normal", olhinho: "Pendente", vacinas: ["Hepatite B"] },
  },
  {
    id: "p5", prontuario: "2026-004820", name: "Beatriz Martins Sousa", cpf: "456.789.012-33", type: "gestante", age: "19 anos", ig: "34s 1d", dum: "20/03/2026", weight: 66.0, height: 158,
    allergies: ["Látex"], risks: ["Alergia"], ward: "PSO", bed: "PSO-01", insurance: "SUS", authorized: true, diagnosis: "Ameaça de parto prematuro", admission: "14/11 09:55", days: 1,
    evolutions: [{ time: "14/11 10:10", cat: "Médica", author: "Dr. Paulo Mendes", text: "Contrações irregulares, colo 2 cm. Iniciada tocólise e corticoterapia para maturação pulmonar fetal." }],
    vitals: [v("06:00", 112, 70, 98, 18, 36.6, 99, 4), v("12:00", 110, 68, 94, 18, 36.5, 99, 3)],
    prescriptions: [
      rx("Medicamento", "Nifedipino 10 mg", "VO 20/20min (até 3 doses)", ["12:00"], "Validada"),
      rx("Medicamento", "Betametasona 12 mg", "IM 24/24h (2 doses)", ["12:00"], "Pendente"),
      rx("Exames", "Cardiotocografia", "Agora"),
    ],
    partograma: [],
  },
  {
    id: "p6", prontuario: "2026-004791", name: "RN de Juliana Ferreira Costa", cpf: "—", motherName: "Juliana Ferreira Costa", type: "neonato", age: "1 dia", ig: "37s 5d (ao nascer)", weight: 3.08, height: 48,
    allergies: [], risks: [], ward: "AC", bed: "AC-01B", insurance: "SUS", authorized: true, diagnosis: "RN a termo – Alojamento conjunto", admission: "13/11 14:32", days: 2, dischargeForecast: "15/11",
    evolutions: [{ time: "14/11 08:00", cat: "Enfermagem", author: "Enf. Carla Souza", text: "Sucção vigorosa, eliminações presentes. Coto umbilical limpo." }],
    vitals: [v("00:00", 64, 38, 140, 46, 36.7, 98, 0, 40, 30), v("06:00", 64, 38, 138, 44, 36.8, 98, 0, 45, 35), v("12:00", 66, 40, 136, 42, 36.9, 99, 0, 50, 38)],
    prescriptions: [rx("Dieta", "Aleitamento materno exclusivo", "Livre demanda"), rx("Medicamento", "Vitamina K 1 mg", "IM dose única", ["14:00"])],
    newborn: { apgar1: 8, apgar5: 9, pesoNascer: 3120, comprimento: 48, pc: 34, tipagem: "O+", coracaozinho: "Normal", olhinho: "Normal", vacinas: ["Hepatite B", "BCG"], motherId: "p2" },
  },
  {
    id: "p7", prontuario: "2026-004805", name: "Sofia Ribeiro Almeida", cpf: "567.890.123-44", motherName: "Camila Ribeiro Almeida", guardian: "Camila Ribeiro Almeida (mãe)", type: "pediatria", age: "4 anos", weight: 16.5, height: 103,
    allergies: [], risks: ["Queda"], ward: "PSP", bed: "PSP-05", insurance: "Amil", guia: "AM-220981", authorized: true, diagnosis: "Gastroenterite aguda com desidratação moderada", admission: "14/11 07:20", days: 1,
    evolutions: [{ time: "14/11 08:00", cat: "Médica", author: "Dr. André Nunes", text: "Desidratação moderada. Iniciada TRO; aceitação parcial. Vômitos 3x. Ondansetrona prescrita." }],
    vitals: [v("06:00", 96, 60, 128, 26, 37.6, 98, 4, 150, 80, 120), v("12:00", 98, 62, 116, 24, 37.2, 99, 2, 300, 120, 40)],
    prescriptions: [
      rx("Hidratação", "SRO 50–100 mL/kg em 4h", "VO fracionado"),
      rx("Medicamento", "Ondansetrona 2,5 mg (0,15 mg/kg)", "VO 8/8h se vômito", ["08:00", "16:00", "00:00"]),
    ],
  },
  {
    id: "p8", prontuario: "2026-004760", name: "Aline Cardoso Pereira", cpf: "678.901.234-55", type: "puerpera", age: "36 anos", weight: 82.0, height: 168,
    allergies: ["Penicilina", "Iodo"], risks: ["Alergia", "Queda", "Risco Hemorrágico"], ward: "AC", bed: "AC-04", insurance: "SulAmérica", authorized: false, diagnosis: "Puerpério pós-parto vaginal – Hemorragia controlada", admission: "12/11 18:00", days: 3, dischargeForecast: "14/11",
    evolutions: [{ time: "14/11 07:50", cat: "Médica", author: "Dra. Helena Prado", text: "Hb 9,8 após reposição. Estável, sem sangramento ativo. Alta prevista hoje com sulfato ferroso." }],
    vitals: [v("06:00", 114, 72, 86, 16, 36.4, 99, 2), v("12:00", 116, 74, 82, 16, 36.5, 99, 1)],
    prescriptions: [rx("Medicamento", "Sulfato ferroso 40 mg Fe", "VO 1x/dia", ["08:00"])],
  },
  {
    id: "p9", prontuario: "2026-004830", name: "Enzo Gabriel Moura", cpf: "789.012.345-66", motherName: "Larissa Moura Pinto", guardian: "Larissa Moura Pinto (mãe)", type: "pediatria", age: "2 anos", weight: 12.4, height: 87,
    allergies: ["Ibuprofeno"], risks: ["Alergia", "Queda"], ward: "PSP", bed: "PSP-02", insurance: "Unimed", guia: "UN-883590", authorized: true, diagnosis: "Crise asmática moderada – aguardando medicação", admission: "14/11 10:05", days: 1,
    evolutions: [{ time: "14/11 10:20", cat: "Médica", author: "Dr. André Nunes", text: "Sibilância difusa, tiragem intercostal, SatO2 91% em ar ambiente. Prescritos salbutamol inalatório e prednisolona. Reavaliar em 1h." }],
    vitals: [v("12:00", 98, 60, 146, 44, 37.1, 91, 3, 100, 60)],
    prescriptions: [
      rx("Medicamento", "Salbutamol spray 100 mcg – 4 jatos", "Inalatório 20/20min (3x)", ["12:00", "12:20", "12:40"], "Pendente"),
      rx("Medicamento", "Prednisolona 24,8 mg (2 mg/kg/dia)", "VO 1x/dia", ["12:00"], "Pendente"),
      rx("Cuidados", "O2 se SatO2 < 92%", "Contínuo"),
    ],
  },
  {
    id: "p10", prontuario: "2026-004835", name: "Camila Duarte Freitas", cpf: "890.123.456-77", type: "gestante", age: "31 anos", ig: "39s 0d", dum: "14/02/2026", weight: 74.0, height: 166,
    allergies: [], risks: [], ward: "CO", bed: "CO-04", insurance: "Bradesco Saúde", guia: "BR-551388", authorized: false, diagnosis: "Cesárea eletiva – 2 cesáreas anteriores", admission: "14/11 10:00", days: 1,
    evolutions: [{ time: "14/11 10:15", cat: "Médica", author: "Dr. Paulo Mendes", text: "Admitida para cesárea eletiva às 14h. Jejum desde 06h. Termo de consentimento assinado." }],
    vitals: [v("12:00", 120, 78, 84, 16, 36.6, 99, 0)],
    prescriptions: [rx("Medicamento", "Cefazolina 2 g", "EV 30 min antes da incisão", ["13:30"], "Pendente"), rx("Dieta", "Jejum", "Desde 06h")],
    partograma: [],
  },
];
PATIENTS.forEach((p) => { p.previousPrescriptions = p.prescriptions.map((x) => ({ ...x, id: x.id + "-prev" })); });

export type BedStatus = "livre" | "ocupado" | "higienizacao" | "isolamento" | "alta";
export interface BaseBed { id: string; ward: Ward; status: BedStatus }
const mk = (ward: Ward, n: number, special: Record<number, BedStatus> = {}): BaseBed[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${ward}-${String(i + 1).padStart(2, "0")}`, ward, status: special[i + 1] ?? "livre" }));
export const BASE_BEDS: BaseBed[] = [
  ...mk("PSO", 6, { 3: "ocupado", 4: "higienizacao" }),
  ...mk("PSP", 6, { 1: "ocupado", 3: "isolamento" }),
  ...mk("CO", 5, { 5: "higienizacao" }),
  ...mk("AC", 8, { 2: "ocupado", 3: "ocupado", 6: "higienizacao" }),
  ...mk("UTIN", 8, { 1: "ocupado", 2: "ocupado", 5: "ocupado", 6: "isolamento" }),
  ...mk("ENFP", 6, { 2: "ocupado", 4: "alta" }),
];
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
export const QUEUE: QueueItem[] = [
  { id: "q1", name: "Renata Souza Lima", group: "obstetrica", complaint: "Sangramento vaginal, 30 semanas", risk: "laranja", arrivedMinAgo: 6, detail: "IG 30s" },
  { id: "q2", name: "Tatiane Moreira", group: "obstetrica", complaint: "Perda de líquido", risk: "amarelo", arrivedMinAgo: 24, detail: "IG 38s" },
  { id: "q3", name: "Gabriela Nunes", group: "obstetrica", complaint: "Cefaleia e escotomas", risk: "vermelho", arrivedMinAgo: 2, detail: "IG 35s" },
  { id: "q4", name: "Priscila Andrade", group: "obstetrica", complaint: "Dor lombar leve", arrivedMinAgo: 3, detail: "IG 22s" },
  { id: "q5", name: "Pedro Henrique Araújo", group: "pediatria", complaint: "Febre há 2 dias", risk: "verde", arrivedMinAgo: 48, detail: "3 anos", weight: 14 },
  { id: "q6", name: "Valentina Rocha", group: "pediatria", complaint: "Desconforto respiratório", risk: "laranja", arrivedMinAgo: 9, detail: "1 ano", weight: 9.8 },
  { id: "q7", name: "Miguel Costa", group: "pediatria", complaint: "Otalgia", risk: "azul", arrivedMinAgo: 75, detail: "6 anos", weight: 21 },
  { id: "q8", name: "Helena Barros", group: "pediatria", complaint: "Vômitos", arrivedMinAgo: 1, detail: "2 anos" },
];

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
export const SURGERIES: Surgery[] = [
  { id: "s1", room: "Sala de Parto 1", start: 8, duration: 2, patient: "Rosana Teixeira", type: "Parto Normal", tuss: "31309127", surgeon: "Dra. Helena Prado", status: "Finalizado", checks: {}, gastos: [{ item: "Kit parto normal", qty: 1, price: 320 }, { item: "Ocitocina 5 UI", qty: 2, price: 4.5 }] },
  { id: "s2", room: "Sala Cirúrgica 1", start: 9, duration: 1.5, patient: "Daniela Rezende", type: "Curetagem", tuss: "31303293", surgeon: "Dr. Paulo Mendes", status: "RPA", checks: {}, gastos: [{ item: "Kit curetagem", qty: 1, price: 210 }] },
  { id: "s3", room: "Sala de Parto 2", start: 11, duration: 3, patient: "Mariana Alves Rocha", patientId: "p1", type: "Parto Normal", tuss: "31309127", surgeon: "Dra. Helena Prado", status: "Em Preparo", checks: {}, gastos: [] },
  { id: "s4", room: "Sala Cirúrgica 1", start: 14, duration: 1.5, patient: "Camila Duarte Freitas", patientId: "p10", type: "Cesárea", tuss: "31309054", surgeon: "Dr. Paulo Mendes", status: "Agendado", checks: {}, gastos: [{ item: "Kit cesárea", qty: 1, price: 540 }, { item: "Fio Vicryl 0", qty: 3, price: 28 }] },
  { id: "s5", room: "Sala Cirúrgica 2", start: 10, duration: 1, patient: "Arthur Lima (6a)", type: "Cirurgia Pediátrica", tuss: "30914051", surgeon: "Dr. Ricardo Faria", status: "Em Sala", checks: {}, gastos: [{ item: "Kit herniorrafia", qty: 1, price: 380 }] },
  { id: "s6", room: "Sala Cirúrgica 2", start: 15, duration: 2, patient: "Isabela Cunha (3a)", type: "Cirurgia Pediátrica", tuss: "30602017", surgeon: "Dr. Ricardo Faria", status: "Agendado", checks: {}, gastos: [] },
  { id: "s7", room: "Sala de Parto 1", start: 16, duration: 1.5, patient: "Beatriz Martins Sousa", patientId: "p5", type: "Cesárea", tuss: "31309054", surgeon: "Dra. Helena Prado", status: "Agendado", checks: {}, gastos: [] },
];

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
  checked.forEach(([k]) => { const item = k.split("|")[1]!; byItem[item] = (byItem[item] ?? 0) + 1; });
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
