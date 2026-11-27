/** Pronto-Socorro Infantil: leitos, escalas pediátricas, sepse e indicadores (regras puras). */
import type { Encounter } from './care-flow';
import type { Manchester } from './hospital-data';
import type { Movement } from './supply-flow';

export const PS_UNIT = 'Pronto socorro';
export const PS_BED_GROUPS: { local: string; beds: string[] }[] = [
  { local: 'Observação 1', beds: ['1.1', '1.2'] },
  { local: 'Observação 2', beds: ['2.1', '2.2'] },
  { local: 'Observação 3', beds: ['3.1', '3.2', '3.3', '3.4'] },
  { local: 'Observação 4', beds: ['4.1', '4.2', '4.3', '4.4', '4.5'] },
  { local: 'Isolamento', beds: ['Isolamento 1', 'Isolamento 2'] },
];
export const PS_BEDS = PS_BED_GROUPS.flatMap((g) => g.beds);
export const PS_DESTINATIONS = ['Consultório pediátrico', 'Consultório de ortopedia'] as const;
export type PsDestination = typeof PS_DESTINATIONS[number];
/** Tempo máximo (min) entre classificação e chamada médica, PCACR pediátrico. */
export const PCACR_MAX_MIN: Record<Manchester, number> = { vermelho: 0, laranja: 15, amarelo: 60, verde: 120, azul: 240 };

// ---- Escalas ----
export type ScaleId = 'pews' | 'dor' | 'humpty' | 'bradenq' | 'dini' | 'glasgow';
export interface ScaleDef { id: ScaleId; name: string; items: { label: string; options: { label: string; score: number }[] }[]; interpret: (total: number) => string }
const opts = (labels: string[], start = 0) => labels.map((label, i) => ({ label, score: i + start }));
export const SCALES: ScaleDef[] = [
  { id: 'pews', name: 'PEWS', items: [
    { label: 'Comportamento', options: opts(['Brincando/adequado', 'Sonolento', 'Irritado', 'Letárgico/confuso ou resposta reduzida à dor']) },
    { label: 'Cardiovascular', options: opts(['Corado, TEC 1–2 s', 'Pálido ou TEC 3 s', 'Acinzentado, TEC 4 s ou FC +20', 'Moteado, TEC ≥5 s ou FC +30 ou bradicardia']) },
    { label: 'Respiratório', options: opts(['Normal, sem retrações', 'FR +10 ou musculatura acessória ou FiO₂ 30%', 'FR +20, retrações ou FiO₂ 40%', 'FR −5 com retrações, gemência ou FiO₂ 50%']) },
  ], interpret: (t) => t >= 5 ? 'Alto risco – acionar médico imediatamente' : t >= 3 ? 'Atenção – reavaliar em 1 h e comunicar médico' : 'Baixo risco – rotina' },
  { id: 'dor', name: 'Dor (FLACC / Faces)', items: [
    { label: 'Face', options: opts(['Sem expressão/sorriso', 'Caretas ocasionais', 'Tremor de queixo frequente']) },
    { label: 'Pernas', options: opts(['Relaxadas', 'Inquietas/tensas', 'Chutando/encolhidas']) },
    { label: 'Atividade', options: opts(['Quieta, movimenta-se fácil', 'Contorcendo-se', 'Arqueada/rígida']) },
    { label: 'Choro', options: opts(['Sem choro', 'Gemidos/choramingo', 'Choro contínuo']) },
    { label: 'Consolabilidade', options: opts(['Satisfeita', 'Consolável com toque', 'Difícil de consolar']) },
  ], interpret: (t) => t >= 7 ? 'Dor intensa' : t >= 4 ? 'Dor moderada' : t >= 1 ? 'Dor leve' : 'Sem dor' },
  { id: 'humpty', name: 'Humpty Dumpty (queda)', items: [
    { label: 'Idade', options: [{ label: '≥13 anos', score: 1 }, { label: '7–12 anos', score: 2 }, { label: '3–6 anos', score: 3 }, { label: '<3 anos', score: 4 }] },
    { label: 'Sexo', options: [{ label: 'Feminino', score: 1 }, { label: 'Masculino', score: 2 }] },
    { label: 'Diagnóstico', options: [{ label: 'Outros', score: 1 }, { label: 'Comportamental/psiquiátrico', score: 2 }, { label: 'Oxigenação/respiratório/desidratação', score: 3 }, { label: 'Neurológico', score: 4 }] },
    { label: 'Fatores cognitivos', options: [{ label: 'Orientado', score: 1 }, { label: 'Esquece limitações', score: 2 }, { label: 'Não consciente das limitações', score: 3 }] },
    { label: 'Fatores ambientais', options: [{ label: 'Ambulatorial', score: 1 }, { label: 'Fora do leito', score: 2 }, { label: 'Berço/leito/mobiliário', score: 3 }, { label: 'Histórico de queda/bebê em cama', score: 4 }] },
    { label: 'Cirurgia/sedação', options: [{ label: 'Nenhuma/>48 h', score: 1 }, { label: 'Em 48 h', score: 2 }, { label: 'Em 24 h', score: 3 }] },
    { label: 'Medicamentos', options: [{ label: 'Outros/nenhum', score: 1 }, { label: 'Um dos listados', score: 2 }, { label: '2+ sedativos/hipnóticos/diuréticos', score: 3 }] },
  ], interpret: (t) => t >= 12 ? 'Alto risco de queda' : 'Baixo risco de queda' },
  { id: 'bradenq', name: 'Escala de Braden Q (Lesão por Pressão)', items: [
    { label: '1. Mobilidade – Capacidade de mudar e controlar a posição corporal', options: [
      { label: 'Nenhuma limitação', score: 4 },
      { label: 'Levemente limitado', score: 3 },
      { label: 'Muito limitado', score: 2 },
      { label: 'Completamente imóvel', score: 1 },
    ] },
    { label: '2. Atividade – Grau de atividade física', options: [
      { label: 'Crianças jovens demais para deambular ou deambulam frequentemente', score: 4 },
      { label: 'Deambulação ocasional', score: 3 },
      { label: 'Restrito à cadeira', score: 2 },
      { label: 'Acamado', score: 1 },
    ] },
    { label: '3. Percepção sensorial – Capacidade de responder ao desconforto relacionado à pressão', options: [
      { label: 'Nenhuma alteração', score: 4 },
      { label: 'Levemente limitado', score: 3 },
      { label: 'Muito limitada', score: 2 },
      { label: 'Completamente limitada', score: 1 },
    ] },
    { label: '4. Umidade – Grau de exposição da pele à umidade', options: [
      { label: 'Raramente úmida', score: 4 },
      { label: 'Ocasionalmente úmida', score: 3 },
      { label: 'Frequentemente úmida', score: 2 },
      { label: 'Constantemente úmida', score: 1 },
    ] },
    { label: '5. Fricção e cisalhamento – A pele e a superfície óssea adjacente deslizam uma sobre a outra', options: [
      { label: 'Nenhum problema aparente', score: 4 },
      { label: 'Problema potencial', score: 3 },
      { label: 'Problema', score: 2 },
      { label: 'Problema importante', score: 1 },
    ] },
    { label: '6. Nutrição – Padrão habitual de consumo alimentar', options: [
      { label: 'Excelente', score: 4 },
      { label: 'Adequada', score: 3 },
      { label: 'Inadequada', score: 2 },
      { label: 'Muito pobre', score: 1 },
    ] },
    { label: '7. Perfusão tecidual e oxigenação', options: [
      { label: 'Excelente', score: 4 },
      { label: 'Adequada', score: 3 },
      { label: 'Comprometida', score: 2 },
      { label: 'Extremamente comprometida', score: 1 },
    ] },
  ], interpret: (t) => t <= 16 ? 'Alto risco de lesão por pressão' : t <= 22 ? 'Risco moderado' : 'Baixo risco' },
  { id: 'dini', name: 'Escala de Dini (Complexidade Assistencial)', items: [
    { label: '1. Participação do acompanhante (Família)', options: [
      { label: 'Reconhece as necessidades físicas e emocionais do paciente e consegue atendê-las', score: 1 },
      { label: 'Demonstra disponibilidade para o cuidar do paciente', score: 2 },
      { label: 'Demonstra dificuldade, indisponibilidade ou ansiedade/medo/retraimento para cuidar do paciente', score: 3 },
      { label: 'Ausente ou que demonstre indisponibilidade ou agressividade para cuidar do paciente', score: 4 },
    ] },
    { label: '2. Rede de apoio e suporte familiar (Família)', options: [
      { label: 'Acompanhante envolvido na prestação e planejamento de cuidado durante todo o tempo', score: 1 },
      { label: 'Acompanhante envolvido na prestação e planejamento de cuidado mais de 12h/dia', score: 2 },
      { label: 'Acompanhante envolvido na prestação e planejamento de cuidado menos de 12h/dia', score: 3 },
      { label: 'Ausência de suporte familiar ou doença psiquiátrica do acompanhante', score: 4 },
    ] },
    { label: '3. Atividade (Paciente)', options: [
      { label: 'Demonstração de afeto com o familiar e de interesse a estímulos e atividades compatíveis com a idade', score: 1 },
      { label: 'Demonstração de afeto com o familiar e de interesse a estímulos, com limitações de atividades', score: 2 },
      { label: 'Desinteresse a estímulos por dor, tristeza, agitação psicomotora ou déficit no desenvolvimento', score: 3 },
      { label: 'Paralisia cerebral grave, coma, inconsciente ou sedado', score: 4 },
    ] },
    { label: '4. Oxigenação (Paciente)', options: [
      { label: 'Respiração espontânea, sem necessidade de oxigenoterapia ou desobstrução de vias aéreas', score: 1 },
      { label: 'Respiração espontânea, com necessidade de desobstrução de vias aéreas por instilação de SF 0,9%', score: 2 },
      { label: 'Respiração espontânea, com necessidade de aspiração e/ou necessidade de oxigenoterapia', score: 3 },
      { label: 'Ventilação mecânica (não invasiva ou invasiva)', score: 4 },
    ] },
    { label: '5. Mobilidade e deambulação (Paciente)', options: [
      { label: 'Deambula sem auxílio', score: 1 },
      { label: 'Repouso no leito e mobiliza-se sem auxílio', score: 2 },
      { label: 'Repouso no leito e mobiliza-se com auxílio ou deambula com supervisão', score: 3 },
      { label: 'Restrito no leito', score: 4 },
    ] },
    { label: '6. Alimentação e hidratação (Paciente)', options: [
      { label: 'Via oral de forma independente ou amamentação eficaz', score: 1 },
      { label: 'Via oral com auxílio e paciente colaborativo', score: 2 },
      { label: 'Sondas, via oral com paciente não colaborativo com risco de broncoaspiração ou amamentação ineficaz', score: 3 },
      { label: 'Nutrição/hidratação parenteral', score: 4 },
    ] },
    { label: '7. Eliminação (Paciente)', options: [
      { label: 'Vaso sanitário sem auxílio', score: 1 },
      { label: 'Vaso sanitário com auxílio', score: 2 },
      { label: 'Fraldas ou comadre ou urinol', score: 3 },
      { label: 'Sonda vesical ou estomas', score: 4 },
    ] },
    { label: '8. Higiene e cuidado corporal (Paciente)', options: [
      { label: 'Banho de aspersão sem auxílio', score: 1 },
      { label: 'Banho de aspersão com auxílio parcial', score: 2 },
      { label: 'Banho de imersão ou de aspersão em cadeira ou com auxílio total', score: 3 },
      { label: 'Banho no leito, incubadora ou berço', score: 4 },
    ] },
    { label: '9. Intervalo de aferição de controle (Procedimentos)', options: [
      { label: '6/6 horas', score: 1 },
      { label: '4/4 horas', score: 2 },
      { label: '2/2 horas', score: 3 },
      { label: 'Intervalo menos de 2 horas ou monitorização contínua', score: 4 },
    ] },
    { label: '10. Terapêutica medicamentosa (Procedimentos)', options: [
      { label: 'Não necessita de medicamentos', score: 1 },
      { label: 'Medicamentos por via tópica, ocular e/ou oral com paciente colaborativo', score: 2 },
      { label: 'Medicamentos por vias parenteral, enteral, inalatória, ocular ou oral, paciente não colaborativo', score: 3 },
      { label: 'Hemoderivados e/ou indicação absoluta de uso de bomba de infusão', score: 4 },
    ] },
    { label: '11. Integridade cutaneomucosa (Procedimentos)', options: [
      { label: 'Pele íntegra por todo corpo', score: 1 },
      { label: 'Necessidade de cuidados de BAIXA complexidade (hidratação cutânea ou fixação de cateter periférico)', score: 2 },
      { label: 'Necessidade de cuidados de MÉDIA complexidade que necessita de curativos', score: 3 },
      { label: 'Necessidade de cuidados de ALTA complexidade (debridamento, queimaduras ou eviscerações)', score: 4 },
    ] },
  ],
    interpret: (t) => t >= 37 ? 'Cuidados Intensivos' : t >= 31 ? 'Cuidados Semi-intensivos' : t >= 24 ? 'Alta Dependência' : t >= 18 ? 'Cuidados Intermediários' : 'Cuidados Mínimos' },
  { id: 'glasgow', name: 'Glasgow pediátrico', items: [
    { label: 'Abertura ocular', options: opts(['Nenhuma', 'À dor', 'À voz', 'Espontânea'], 1) },
    { label: 'Resposta verbal', options: opts(['Nenhuma', 'Gemidos à dor', 'Choro à dor', 'Choro irritado', 'Balbucia/orientado'], 1) },
    { label: 'Resposta motora', options: opts(['Nenhuma', 'Extensão', 'Flexão anormal', 'Retirada à dor', 'Localiza/retira ao toque', 'Movimentos espontâneos'], 1) },
  ], interpret: (t) => t <= 8 ? 'Grave – proteger via aérea' : t <= 12 ? 'Moderado' : 'Leve' },
];
export const scaleTotal = (s: ScaleDef, answers: number[]) => s.items.reduce((a, it, i) => a + (it.options[answers[i] ?? 0]?.score ?? 0), 0);
export interface ScaleRecord { id: string; scale: ScaleId | 'sae' | 'sbar'; total?: number; result: string; text?: string; at: string; by: string }

// ---- Sepse ----
export type SepsisKind = 'Pediátrica' | 'Neonatal';
export const SEPSIS_BUNDLE: Record<SepsisKind, string[]> = {
  'Pediátrica': ['Acesso venoso/intraósseo obtido', 'Hemocultura colhida antes do antibiótico', 'Lactato colhido', 'Antimicrobiano na 1ª hora', 'Expansão volêmica 10–20 mL/kg se hipoperfusão', 'Reavaliação após expansão', 'Médico e enfermeiro comunicados'],
  'Neonatal': ['Acesso venoso obtido', 'Hemocultura colhida antes do antibiótico', 'Hemograma e PCR', 'Glicemia', 'Antimicrobiano na 1ª hora', 'Controle térmico', 'Contato com UTI neonatal'],
};
export interface SepsisProtocol { id: string; kind: SepsisKind; openedAt: string; openedBy: string; checks: Record<string, string>; outcome?: string; closedAt?: string }

export interface PsInfo {
  destination?: PsDestination; bed?: string; obsAt?: string; returnRequestedAt?: string;
  awaitingDischargeAt?: string; evasion?: { at: string; by: string; note: string };
  scales?: ScaleRecord[]; sepsis?: SepsisProtocol[];
}
export type PsEncounter = Encounter & { ps?: PsInfo };

// ---- Tempos ----
const firstAt = (e: Encounter, status: string) => e.history.find((h) => h.status === status)?.at;
export const minutes = (a?: string, b?: string) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : null);
export const triagedAt = (e: Encounter) => firstAt(e, 'AGUARDANDO_MEDICO');
export const doctorCalledAt = (e: Encounter) => firstAt(e, 'EM_ATENDIMENTO_MEDICO');
export const outcomeAt = (e: Encounter) => firstAt(e, 'ALTA_HOSPITALAR') ?? e.fia?.openedAt ?? firstAt(e, 'ENCAMINHADO_INTERNACAO');
/** Diurno 07h–19h com meta de 6 h; noturno 19h–07h com meta de 12 h (pela hora de abertura). */
export const shiftOf = (iso: string) => { const h = new Date(iso).getHours(); return h >= 7 && h < 19 ? 'diurno' : 'noturno'; };
export const outcomeGoalMin = (iso: string) => (shiftOf(iso) === 'diurno' ? 360 : 720);
/** Situação do paciente em relação à meta de desfecho: ok, perto (≥80%) ou estourado. */
export function outcomeStatus(e: Encounter, now = new Date().toISOString()): 'ok' | 'perto' | 'estourado' {
  const m = minutes(e.openedAt, outcomeAt(e) ?? now) ?? 0; const goal = outcomeGoalMin(e.openedAt);
  return m > goal ? 'estourado' : m >= goal * 0.8 ? 'perto' : 'ok';
}
export const fmtMin = (m: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);

// ---- Relatório da coordenação ----
export interface PsPatientInfo { id: string; city: string; sex: string; ageBand: string }
const count = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((a, k) => { const x = k || 'Não informado'; a[x] = (a[x] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
/** period: "AAAA", "AAAA-MM" ou "AAAA-MM-DD". Considera somente a porta Pronto-Socorro Infantil. */
export function psReport(all: PsEncounter[], patients: PsPatientInfo[], movements: Movement[], period: string) {
  const list = all.filter((e) => e.type === PS_UNIT && e.openedAt.startsWith(period));
  const pinfo = (id: string) => patients.find((p) => p.id === id);
  const triaged = list.filter((e) => e.triage);
  const risks: Manchester[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul'];
  const triageMin = triaged.map((e) => minutes(e.openedAt, triagedAt(e))).filter((x): x is number => x != null);
  const doctor = triaged.filter((e) => doctorCalledAt(e)).map((e) => { const m = minutes(triagedAt(e), doctorCalledAt(e))!; return { e, m, ok: m <= PCACR_MAX_MIN[e.triage!.risk] }; });
  const closed = list.filter((e) => outcomeAt(e));
  const stay = closed.map((e) => ({ e, m: minutes(e.openedAt, outcomeAt(e))!, shift: shiftOf(e.openedAt) }));
  const goal = (shift: string) => { const s = stay.filter((x) => x.shift === shift); const inside = s.filter((x) => x.m <= outcomeGoalMin(x.e.openedAt)).length; return { total: s.length, inside, outside: s.length - inside, rate: pct(inside, s.length), avgMin: avg(s.map((x) => x.m)) }; };
  const evasions = list.filter((e) => e.ps?.evasion);
  const ids = new Set(list.map((e) => e.patientId));
  const consumption = (kinds: string[], depot: string) => count(movements.filter((m) => m.at.startsWith(period) && m.patientId && ids.has(m.patientId) && kinds.includes(m.kind) && m.from.toLowerCase().includes(depot)).flatMap((m) => Array(Math.max(1, m.qty)).fill(m.item) as string[]));
  const sepsis = list.flatMap((e) => (e.ps?.sepsis ?? []).map((s) => ({ e, s })));
  return {
    total: list.length,
    internacoes: list.filter((e) => e.fia || e.status_fluxo === 'ENCAMINHADO_INTERNACAO').length,
    ortopedia: list.filter((e) => e.ps?.destination === 'Consultório de ortopedia').length,
    pediatria: list.filter((e) => e.ps?.destination !== 'Consultório de ortopedia').length,
    byCity: count(list.map((e) => pinfo(e.patientId)?.city ?? '')),
    byAge: count(list.map((e) => pinfo(e.patientId)?.ageBand ?? '')),
    bySex: count(list.map((e) => pinfo(e.patientId)?.sex ?? '')),
    byCid: count(list.filter((e) => e.medical?.cid).map((e) => `${e.medical!.cid} ${e.medical!.diagnosis}`.trim())).slice(0, 15),
    classified: triaged.length,
    byRisk: risks.map((r) => { const n = triaged.filter((e) => e.triage!.risk === r).length; return { risk: r, n, pct: pct(n, triaged.length) }; }),
    avgTriageWaitMin: avg(triageMin),
    doctorInside: doctor.filter((x) => x.ok).length, doctorOutside: doctor.filter((x) => !x.ok).length, doctorRate: pct(doctor.filter((x) => x.ok).length, doctor.length),
    doctorByRisk: risks.map((r) => { const d = doctor.filter((x) => x.e.triage!.risk === r); return { risk: r, n: d.length, inside: d.filter((x) => x.ok).length, avgMin: avg(d.map((x) => x.m)) }; }),
    doctorLate: doctor.filter((x) => !x.ok).map((x) => x.e),
    diurno: goal('diurno'), noturno: goal('noturno'), avgStayMin: avg(stay.map((x) => x.m)),
    evasions: evasions.length, evasionRate: pct(evasions.length, list.length), evasionByRisk: count(evasions.map((e) => e.triage?.risk ?? 'sem classificação')),
    pharmacy: consumption(['consumo', 'requisicao'], 'farm'), warehouse: consumption(['consumo', 'requisicao'], 'almox'),
    sepsis, sepsisPed: sepsis.filter((x) => x.s.kind === 'Pediátrica').length, sepsisNeo: sepsis.filter((x) => x.s.kind === 'Neonatal').length,
  };
}
export function toCsvRows(rows: (string | number)[][]) { return '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'); }
