export type Ward = "PSO" | "PSP" | "CO" | "UTIN" | "ENF";
export const WARDS: { id: Ward; name: string }[] = [
  { id: "PSO", name: "Pronto-Socorro Obstétrico" },
  { id: "PSP", name: "Pronto-Socorro Pediátrico" },
  { id: "CO", name: "Centro Obstétrico" },
  { id: "UTIN", name: "UTI Neonatal" },
  { id: "ENF", name: "Enfermaria" },
];

export type PatientType = "gestante" | "puerpera" | "pediatria" | "neonato";
export type Professional = "Médico" | "Enfermagem" | "Fisioterapia";

export interface Evolution { time: string; prof: Professional; author: string; text: string }
export interface Vital { time: string; pas: number; pad: number; fc: number; fr: number; tax: number; sat: number; dor: number; ingest: number; elim: number }
export interface PartoPoint { hour: number; dilat: number; altura: number; bcf: number; contr: number }
export interface Prescription { cat: "Dieta" | "Hidratação" | "Medicamento" | "Cuidados" | "Exames"; item: string; posologia: string; status: "Ativo" | "Suspenso" | "Checado" }
export interface Newborn { apgar1: number; apgar5: number; pesoNascer: number; tipagem: string; vacinas: string[]; motherId?: string; babyIds?: string[] }

export interface Patient {
  id: string; prontuario: string; name: string; cpf: string; motherName?: string; guardian?: string;
  type: PatientType; age: string; ig?: string; dum?: string; weight: number; height?: number;
  allergies: string[]; risks: ("Queda" | "Alergia" | "Flebite")[]; ward: Ward; bed: string;
  insurance: string; diagnosis: string; admission: string; dischargeForecast?: string;
  evolutions: Evolution[]; vitals: Vital[]; prescriptions: Prescription[]; partograma?: PartoPoint[]; newborn?: Newborn;
}

const v = (time: string, pas: number, pad: number, fc: number, fr: number, tax: number, sat: number, dor: number, ingest = 200, elim = 150): Vital => ({ time, pas, pad, fc, fr, tax, sat, dor, ingest, elim });

export const PATIENTS: Patient[] = [
  {
    id: "p1", prontuario: "2026-004812", name: "Mariana Alves Rocha", cpf: "123.456.789-00", type: "gestante", age: "28 anos", ig: "39s 2d", dum: "12/02/2026", weight: 78.4, height: 164,
    allergies: ["Dipirona"], risks: ["Alergia", "Queda"], ward: "CO", bed: "CO-02", insurance: "Unimed", diagnosis: "Trabalho de parto ativo – G2P1", admission: "14/11 05:40",
    evolutions: [
      { time: "14/11 09:30", prof: "Médico", author: "Dra. Helena Prado", text: "Dilatação 7 cm, apresentação cefálica -1 (De Lee), BCF 142 bpm, 4 contrações/10min. Bolsa rota às 08h, líquido claro. Conduta expectante." },
      { time: "14/11 08:00", prof: "Enfermagem", author: "Enf. Carla Souza", text: "Paciente deambulando, aceitando dieta líquida. Orientada sobre métodos não farmacológicos de alívio da dor." },
      { time: "14/11 07:15", prof: "Fisioterapia", author: "Ft. Rafael Lima", text: "Exercícios com bola suíça e técnicas respiratórias. Boa adesão." },
      { time: "14/11 05:50", prof: "Médico", author: "Dr. Paulo Mendes", text: "Admissão: gestante 39s2d, contrações regulares, dilatação 4 cm. Sorologias negativas. Internada para assistência ao parto." },
    ],
    vitals: [v("06:00", 118, 76, 88, 18, 36.5, 98, 5), v("08:00", 122, 78, 92, 20, 36.7, 98, 6), v("10:00", 126, 80, 96, 20, 36.9, 97, 7), v("12:00", 124, 82, 94, 19, 37.0, 98, 7)],
    prescriptions: [
      { cat: "Dieta", item: "Dieta líquida restrita", posologia: "VO, livre demanda", status: "Ativo" },
      { cat: "Hidratação", item: "Ringer Lactato 500 mL", posologia: "EV, 125 mL/h", status: "Ativo" },
      { cat: "Medicamento", item: "Ocitocina 5 UI em SG 5% 500 mL", posologia: "EV, se necessário conforme protocolo", status: "Suspenso" },
      { cat: "Cuidados", item: "Ausculta BCF a cada 30 min", posologia: "Contínuo", status: "Checado" },
      { cat: "Exames", item: "Hemograma + Tipagem ABO/Rh", posologia: "Admissão", status: "Checado" },
    ],
    partograma: [
      { hour: 0, dilat: 4, altura: -3, bcf: 140, contr: 2 }, { hour: 1, dilat: 5, altura: -2, bcf: 138, contr: 3 },
      { hour: 2, dilat: 5, altura: -2, bcf: 144, contr: 3 }, { hour: 3, dilat: 6, altura: -1, bcf: 142, contr: 4 },
      { hour: 4, dilat: 7, altura: -1, bcf: 142, contr: 4 },
    ],
  },
  {
    id: "p2", prontuario: "2026-004790", name: "Juliana Ferreira Costa", cpf: "234.567.890-11", type: "puerpera", age: "33 anos", weight: 71.2, height: 160,
    allergies: [], risks: ["Flebite"], ward: "ENF", bed: "ENF-104", insurance: "SUS", diagnosis: "Puerpério pós-cesárea (D1) – DHEG", admission: "13/11 14:10", dischargeForecast: "15/11",
    evolutions: [
      { time: "14/11 08:40", prof: "Médico", author: "Dra. Helena Prado", text: "1º DPO de cesárea por pré-eclâmpsia. PA controlada com metildopa. Ferida operatória limpa, útero contraído, lóquios fisiológicos." },
      { time: "14/11 07:00", prof: "Enfermagem", author: "Enf. Carla Souza", text: "Sinais de flebite grau 1 em MSE; acesso trocado. Amamentação em livre demanda com boa pega." },
    ],
    vitals: [v("06:00", 142, 92, 84, 17, 36.4, 98, 3), v("10:00", 136, 88, 80, 16, 36.6, 99, 3), v("14:00", 132, 86, 78, 16, 36.5, 99, 2)],
    prescriptions: [
      { cat: "Dieta", item: "Dieta branda hipossódica", posologia: "VO", status: "Ativo" },
      { cat: "Medicamento", item: "Metildopa 500 mg", posologia: "VO 8/8h", status: "Ativo" },
      { cat: "Medicamento", item: "Paracetamol 750 mg", posologia: "VO 6/6h se dor", status: "Ativo" },
      { cat: "Cuidados", item: "Aferir PA 4/4h", posologia: "Contínuo", status: "Checado" },
    ],
    newborn: { apgar1: 8, apgar5: 9, pesoNascer: 3120, tipagem: "O+", vacinas: [], babyIds: ["p6"] },
  },
  {
    id: "p3", prontuario: "2026-004801", name: "Lucas Oliveira Santos", cpf: "345.678.901-22", motherName: "Fernanda Oliveira Santos", guardian: "Fernanda Oliveira Santos (mãe)", type: "pediatria", age: "8 meses", weight: 8.2, height: 70,
    allergies: ["Amoxicilina"], risks: ["Alergia", "Queda"], ward: "ENF", bed: "PED-201", insurance: "Bradesco Saúde", diagnosis: "Bronquiolite viral aguda (VSR+)", admission: "12/11 22:30", dischargeForecast: "16/11",
    evolutions: [
      { time: "14/11 09:00", prof: "Médico", author: "Dr. André Nunes", text: "Melhora do desconforto respiratório. Sibilos esparsos, tiragem subcostal leve. SatO2 95% com O2 0,5 L/min. Manter suporte." },
      { time: "14/11 08:10", prof: "Fisioterapia", author: "Ft. Rafael Lima", text: "Desobstrução rinofaríngea retrógrada com SF 0,9%. Boa resposta." },
      { time: "14/11 06:00", prof: "Enfermagem", author: "Enf. Bruna Dias", text: "Aceitou 120 mL de fórmula. Diurese presente. Cabeceira elevada 30°." },
    ],
    vitals: [v("06:00", 90, 55, 148, 52, 37.8, 93, 2, 120, 90), v("10:00", 92, 56, 140, 46, 37.4, 95, 1, 130, 100), v("14:00", 94, 58, 132, 42, 37.0, 96, 1, 140, 110)],
    prescriptions: [
      { cat: "Hidratação", item: "Soro de manutenção (Holliday-Segar)", posologia: "EV 34 mL/h", status: "Ativo" },
      { cat: "Medicamento", item: "Paracetamol gotas 15 mg/kg", posologia: "VO 6/6h se febre", status: "Ativo" },
      { cat: "Cuidados", item: "O2 por cateter nasal 0,5 L/min", posologia: "Manter SatO2 ≥ 92%", status: "Ativo" },
      { cat: "Exames", item: "Painel viral respiratório", posologia: "Coletado", status: "Checado" },
    ],
  },
  {
    id: "p4", prontuario: "2026-004777", name: "RN de Patrícia Gomes", cpf: "—", motherName: "Patrícia Gomes Lima", type: "neonato", age: "5 dias", ig: "32s 4d (ao nascer)", weight: 1.72, height: 42,
    allergies: [], risks: ["Flebite"], ward: "UTIN", bed: "UTIN-03", insurance: "SUS", diagnosis: "Prematuridade – Desconforto respiratório precoce", admission: "09/11 03:15",
    evolutions: [
      { time: "14/11 09:20", prof: "Médico", author: "Dra. Lívia Castro", text: "Em CPAP nasal, FiO2 25%. Tolerando dieta enteral por SOG 12 mL 3/3h. Icterícia em fototerapia." },
      { time: "14/11 07:30", prof: "Enfermagem", author: "Enf. Bruna Dias", text: "Incubadora 34°C. Mudança de decúbito realizada. Mãe presente para método canguru." },
    ],
    vitals: [v("06:00", 52, 30, 156, 54, 36.6, 94, 1, 24, 18), v("09:00", 54, 32, 152, 50, 36.8, 95, 0, 24, 20), v("12:00", 55, 32, 150, 48, 36.7, 96, 0, 24, 22)],
    prescriptions: [
      { cat: "Dieta", item: "Leite materno ordenhado", posologia: "SOG 12 mL 3/3h", status: "Ativo" },
      { cat: "Medicamento", item: "Cafeína citrato 5 mg/kg", posologia: "EV 1x/dia", status: "Ativo" },
      { cat: "Cuidados", item: "Fototerapia contínua", posologia: "Proteção ocular", status: "Ativo" },
    ],
    newborn: { apgar1: 6, apgar5: 8, pesoNascer: 1680, tipagem: "A+", vacinas: ["Vitamina K", "Hepatite B"], motherId: undefined },
  },
  {
    id: "p5", prontuario: "2026-004820", name: "Beatriz Martins Sousa", cpf: "456.789.012-33", type: "gestante", age: "19 anos", ig: "34s 1d", dum: "20/03/2026", weight: 66.0, height: 158,
    allergies: ["Látex"], risks: ["Alergia"], ward: "PSO", bed: "PSO-OBS1", insurance: "SUS", diagnosis: "Ameaça de parto prematuro", admission: "14/11 09:55",
    evolutions: [{ time: "14/11 10:10", prof: "Médico", author: "Dr. Paulo Mendes", text: "Contrações irregulares, colo 2 cm. Iniciada tocólise e corticoterapia para maturação pulmonar fetal." }],
    vitals: [v("10:00", 112, 70, 98, 18, 36.6, 99, 4), v("12:00", 110, 68, 94, 18, 36.5, 99, 3)],
    prescriptions: [
      { cat: "Medicamento", item: "Nifedipino 10 mg", posologia: "VO 20/20min (até 3 doses)", status: "Ativo" },
      { cat: "Medicamento", item: "Betametasona 12 mg", posologia: "IM 24/24h (2 doses)", status: "Ativo" },
      { cat: "Exames", item: "Cardiotocografia", posologia: "Agora", status: "Ativo" },
    ],
    partograma: [],
  },
  {
    id: "p6", prontuario: "2026-004791", name: "RN de Juliana Ferreira", cpf: "—", motherName: "Juliana Ferreira Costa", type: "neonato", age: "1 dia", ig: "37s 5d (ao nascer)", weight: 3.08, height: 48,
    allergies: [], risks: [], ward: "ENF", bed: "ENF-104B", insurance: "SUS", diagnosis: "RN a termo – Alojamento conjunto", admission: "13/11 14:32", dischargeForecast: "15/11",
    evolutions: [{ time: "14/11 08:00", prof: "Enfermagem", author: "Enf. Carla Souza", text: "Sucção vigorosa, eliminações presentes. Coto umbilical limpo." }],
    vitals: [v("06:00", 64, 38, 138, 44, 36.8, 98, 0, 30, 25), v("12:00", 66, 40, 136, 42, 36.9, 99, 0, 35, 28)],
    prescriptions: [{ cat: "Dieta", item: "Aleitamento materno exclusivo", posologia: "Livre demanda", status: "Ativo" }],
    newborn: { apgar1: 8, apgar5: 9, pesoNascer: 3120, tipagem: "O+", vacinas: ["Vitamina K", "Hepatite B", "BCG"], motherId: "p2" },
  },
  {
    id: "p7", prontuario: "2026-004805", name: "Sofia Ribeiro Almeida", cpf: "567.890.123-44", motherName: "Camila Ribeiro Almeida", guardian: "Camila Ribeiro Almeida (mãe)", type: "pediatria", age: "4 anos", weight: 16.5, height: 103,
    allergies: [], risks: ["Queda"], ward: "PSP", bed: "PSP-05", insurance: "Amil", diagnosis: "Gastroenterite aguda com desidratação moderada", admission: "14/11 07:20",
    evolutions: [{ time: "14/11 08:00", prof: "Médico", author: "Dr. André Nunes", text: "Desidratação moderada. Iniciada TRO; aceitação parcial. Vômitos 3x. Ondansetrona prescrita." }],
    vitals: [v("07:30", 96, 60, 128, 26, 37.6, 98, 4, 150, 80), v("10:30", 98, 62, 116, 24, 37.2, 99, 2, 300, 120)],
    prescriptions: [
      { cat: "Hidratação", item: "SRO 50–100 mL/kg em 4h", posologia: "VO fracionado", status: "Ativo" },
      { cat: "Medicamento", item: "Ondansetrona 0,15 mg/kg", posologia: "VO 8/8h se vômito", status: "Ativo" },
    ],
  },
  {
    id: "p8", prontuario: "2026-004760", name: "Aline Cardoso Pereira", cpf: "678.901.234-55", type: "puerpera", age: "36 anos", weight: 82.0, height: 168,
    allergies: ["Penicilina", "Iodo"], risks: ["Alergia", "Queda"], ward: "ENF", bed: "ENF-108", insurance: "SulAmérica", diagnosis: "Puerpério pós-parto vaginal – Hemorragia controlada", admission: "12/11 18:00", dischargeForecast: "14/11",
    evolutions: [{ time: "14/11 07:50", prof: "Médico", author: "Dra. Helena Prado", text: "Hb 9,8 após reposição. Estável, sem sangramento ativo. Alta prevista hoje com sulfato ferroso." }],
    vitals: [v("06:00", 114, 72, 86, 16, 36.4, 99, 2), v("12:00", 116, 74, 82, 16, 36.5, 99, 1)],
    prescriptions: [{ cat: "Medicamento", item: "Sulfato ferroso 40 mg Fe", posologia: "VO 1x/dia", status: "Ativo" }],
  },
];

export type BedStatus = "livre" | "ocupado" | "higienizacao" | "isolamento" | "alta";
export interface Bed { id: string; ward: Ward; status: BedStatus; patientId?: string }
const occ = Object.fromEntries(PATIENTS.map((p) => [p.bed, p.id]));
const mk = (ward: Ward, prefix: string, n: number, special: Record<number, BedStatus> = {}): Bed[] =>
  Array.from({ length: n }, (_, i) => {
    const id = `${prefix}-${String(i + 1).padStart(2, "0")}`.replace("ENF-0", "ENF-10").replace("PED-0", "PED-20");
    const pid = occ[id];
    const p = PATIENTS.find((x) => x.id === pid);
    const status: BedStatus = p ? (p.dischargeForecast === "14/11" ? "alta" : p.diagnosis.includes("VSR") ? "isolamento" : "ocupado") : special[i + 1] ?? "livre";
    return { id, ward, status, patientId: pid };
  });
export const BEDS: Bed[] = [
  ...mk("PSO", "PSO", 6, { 2: "ocupado", 4: "higienizacao" }), { id: "PSO-OBS1", ward: "PSO", status: "ocupado", patientId: "p5" },
  ...mk("PSP", "PSP", 6, { 1: "ocupado", 3: "isolamento" }),
  ...mk("CO", "CO", 5, { 4: "higienizacao" }),
  ...mk("UTIN", "UTIN", 8, { 1: "ocupado", 2: "ocupado", 5: "ocupado", 6: "isolamento" }),
  ...mk("ENF", "ENF", 9, { 2: "ocupado", 3: "ocupado", 6: "higienizacao" }), { id: "ENF-104B", ward: "ENF", status: "ocupado", patientId: "p6" },
  ...mk("ENF", "PED", 6, { 2: "ocupado", 4: "alta" }),
];

export type Manchester = "vermelho" | "laranja" | "amarelo" | "verde" | "azul";
export const MANCHESTER: Record<Manchester, { label: string; max: number; cls: string }> = {
  vermelho: { label: "Emergência", max: 0, cls: "bg-mt-red text-primary-foreground" },
  laranja: { label: "Muito urgente", max: 10, cls: "bg-mt-orange text-primary-foreground" },
  amarelo: { label: "Urgente", max: 60, cls: "bg-mt-yellow text-foreground" },
  verde: { label: "Pouco urgente", max: 120, cls: "bg-mt-green text-primary-foreground" },
  azul: { label: "Não urgente", max: 240, cls: "bg-mt-blue text-primary-foreground" },
};
export interface QueueItem { id: string; name: string; group: "obstetrica" | "pediatria"; complaint: string; risk?: Manchester; arrivedMinAgo: number; detail: string }
export const QUEUE: QueueItem[] = [
  { id: "q1", name: "Renata Souza Lima", group: "obstetrica", complaint: "Sangramento vaginal, 30 semanas", risk: "laranja", arrivedMinAgo: 6, detail: "IG 30s" },
  { id: "q2", name: "Tatiane Moreira", group: "obstetrica", complaint: "Perda de líquido", risk: "amarelo", arrivedMinAgo: 24, detail: "IG 38s" },
  { id: "q3", name: "Gabriela Nunes", group: "obstetrica", complaint: "Cefaleia e escotomas", risk: "vermelho", arrivedMinAgo: 2, detail: "IG 35s" },
  { id: "q4", name: "Priscila Andrade", group: "obstetrica", complaint: "Dor lombar leve", arrivedMinAgo: 3, detail: "IG 22s" },
  { id: "q5", name: "Pedro Henrique Araújo", group: "pediatria", complaint: "Febre há 2 dias", risk: "verde", arrivedMinAgo: 48, detail: "3 anos" },
  { id: "q6", name: "Valentina Rocha", group: "pediatria", complaint: "Desconforto respiratório", risk: "laranja", arrivedMinAgo: 9, detail: "1 ano" },
  { id: "q7", name: "Miguel Costa", group: "pediatria", complaint: "Otalgia", risk: "azul", arrivedMinAgo: 75, detail: "6 anos" },
  { id: "q8", name: "Helena Barros", group: "pediatria", complaint: "Vômitos", arrivedMinAgo: 1, detail: "2 anos" },
];

export const getPatient = (id: string) => PATIENTS.find((p) => p.id === id);
/** Dose em mg = mg/kg × peso, limitada à dose máxima quando informada. */
export function doseByWeight(mgPerKg: number, weightKg: number, maxMg?: number) {
  const d = Math.round(mgPerKg * weightKg * 100) / 100;
  return maxMg != null ? Math.min(d, maxMg) : d;
}
