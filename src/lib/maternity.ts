/** Obstetric records are encounter-scoped; no new hospital snapshot key. */
export type MaternityKind = 'checklist' | 'meows' | 'bishop' | 'silverman' | 'hpp';
export interface MaternityRecord {
  id: string; kind: MaternityKind; patientId: string; at: string; by: string;
  values: Record<string, string>; result: string; notes: string;
}
export interface MaternityField { id: string; label: string; options: { label: string; score: number }[] }
const scored = (labels: string[]): { label: string; score: number }[] => labels.map((label, score) => ({ label, score }));
export const BISHOP_FIELDS: MaternityField[] = [
  { id: 'dilation', label: 'Dilatação (cm)', options: scored(['Fechado', '1–2', '3–4', '≥5']) },
  { id: 'effacement', label: 'Apagamento (%)', options: scored(['0–30', '40–50', '60–70', '≥80']) },
  { id: 'station', label: 'Altura (De Lee)', options: scored(['−3', '−2', '−1 / 0', '+1 / +2']) },
  { id: 'consistency', label: 'Consistência do colo', options: scored(['Firme', 'Intermediária', 'Amolecida']) },
  { id: 'position', label: 'Posição do colo', options: scored(['Posterior', 'Intermediária', 'Anterior']) },
];
export const SILVERMAN_FIELDS: MaternityField[] = [
  { id: 'chest', label: 'Movimento toracoabdominal', options: scored(['Sincronizado', 'Tórax atrasa em relação ao abdome', 'Movimento em gangorra']) },
  { id: 'intercostal', label: 'Tiragem intercostal', options: scored(['Ausente', 'Discreta', 'Acentuada']) },
  { id: 'xiphoid', label: 'Retração xifoide', options: scored(['Ausente', 'Discreta', 'Acentuada']) },
  { id: 'nasal', label: 'Batimento de asas nasais', options: scored(['Ausente', 'Discreto', 'Acentuado']) },
  { id: 'grunting', label: 'Gemido expiratório', options: scored(['Ausente', 'Audível com estetoscópio', 'Audível sem estetoscópio']) },
];
export function fieldTotal(fields: MaternityField[], values: Record<string, string>): number {
  return fields.reduce((total, field) => {
    const value = values[field.id];
    const option = value === undefined || !/^\d+$/.test(value) ? undefined : field.options[Number(value)];
    if (!option) throw new Error(`Preencha ${field.label}.`);
    return total + option.score;
  }, 0);
}

// MEOWS CEMACH / Singh 2012, trigger table: https://pmc.ncbi.nlm.nih.gov/articles/PMC5910060/
export const MEOWS_NUMBERS = [
  { id: 'fr', label: 'Frequência respiratória (irpm)', min: 1, max: 100 },
  { id: 'sat', label: 'SpO₂ (%)', min: 1, max: 100 },
  { id: 'temp', label: 'Temperatura (°C)', min: 25, max: 45 },
  { id: 'pas', label: 'PA sistólica (mmHg)', min: 1, max: 300 },
  { id: 'pad', label: 'PA diastólica (mmHg)', min: 1, max: 200 },
  { id: 'fc', label: 'Frequência cardíaca (bpm)', min: 1, max: 300 },
];
export function meowsTriggers(values: Record<string, string>) {
  const n = (key: string) => {
    const field = MEOWS_NUMBERS.find((f) => f.id === key);
    const raw = values[key]; const value = Number(raw);
    if (!field || raw === undefined || !raw.trim() || !Number.isFinite(value) || value < field.min || value > field.max) throw new Error(`Informe ${field?.label ?? key} válido.`);
    return value;
  };
  const fr = n('fr'), sat = n('sat'), temp = n('temp'), pas = n('pas'), pad = n('pad'), fc = n('fc');
  if (!['0', '1', '2', '3'].includes(values['pain'] ?? '') || !['A', 'V', 'P', 'U'].includes(values['avpu'] ?? '')) throw new Error('Preencha dor MEOWS e resposta neurológica.');
  const triggers = [
    fr < 10 || fr > 30 ? 2 : fr >= 21 ? 1 : 0,
    sat < 95 ? 2 : 0,
    temp < 35 || temp > 38 ? 2 : temp <= 36 ? 1 : 0,
    pas < 90 || pas > 160 ? 2 : pas <= 100 || pas >= 150 ? 1 : 0,
    pad > 100 ? 2 : pad >= 90 ? 1 : 0,
    fc < 40 || fc > 120 ? 2 : fc <= 50 || fc >= 100 ? 1 : 0,
    Number(values['pain']) >= 2 ? 1 : 0,
    values['avpu'] === 'P' || values['avpu'] === 'U' ? 2 : values['avpu'] === 'V' ? 1 : 0,
  ];
  const red = triggers.filter((x) => x === 2).length, yellow = triggers.filter((x) => x === 1).length;
  return { red, yellow, alert: red >= 1 || yellow >= 2 };
}
// CMQCC hemorrhage toolkit v3.0 (2022), Appendix K. One row per distinct factor.
export const HPP_FACTORS = [
  { id: 'uterine', label: 'Cesárea prévia ou cirurgia uterina', high: false },
  { id: 'multiple', label: 'Gestação múltipla', high: false },
  { id: 'parity', label: 'Mais de 4 partos vaginais', high: false },
  { id: 'chorio', label: 'Corioamnionite', high: false },
  { id: 'previous', label: 'Uma hemorragia pós-parto prévia', high: false },
  { id: 'fibroids', label: 'Miomas uterinos grandes', high: false },
  { id: 'platelets', label: 'Plaquetas de 50.000 a 100.000/µL', high: false },
  { id: 'anemia', label: 'Hb de 8 a <10 g/dL ou Ht de 24 a <30%', high: false },
  { id: 'poly', label: 'Polidrâmnio', high: false },
  { id: 'gestation', label: 'IG <37 ou >41 semanas', high: false },
  { id: 'preeclampsia', label: 'Pré-eclâmpsia', high: false },
  { id: 'labor', label: 'Trabalho de parto / indução >24 horas', high: false },
  { id: 'previa', label: 'Placenta prévia ou baixa', high: true },
  { id: 'accreta', label: 'Acretismo placentário suspeito ou conhecido', high: true },
  { id: 'bleeding', label: 'Descolamento placentário ou sangramento ativo maior que tampão', high: true },
  { id: 'coagulopathy', label: 'Coagulopatia conhecida', high: true },
  { id: 'repeated', label: 'Mais de uma hemorragia pós-parto prévia', high: true },
  { id: 'hellp', label: 'Síndrome HELLP', high: true },
  { id: 'severePlatelets', label: 'Plaquetas <50.000/µL', high: true },
  { id: 'severeAnemia', label: 'Hb <8 g/dL ou Ht <24%', high: true },
  { id: 'demise', label: 'Óbito fetal', high: true },
];
export function hppRisk(values: Record<string, string>): 'Baixo' | 'Médio' | 'Alto' {
  for (const f of HPP_FACTORS) if (!['sim', 'nao'].includes(values[f.id] ?? '')) throw new Error(`Avalie: ${f.label}.`);
  const present = HPP_FACTORS.filter((f) => values[f.id] === 'sim');
  return present.some((f) => f.high) || present.filter((f) => !f.high).length >= 2 ? 'Alto' : present.length ? 'Médio' : 'Baixo';
}
// WHO 2015 checklist, adapted with explicit non-indication rather than universal orders.
export const BIRTH_PHASES = [
  { id: 'admissao', label: 'Na admissão', items: ['Necessidade de transferência avaliada', 'Indicação de partograma avaliada', 'Indicação de antibiótico avaliada e conduta registrada', 'Indicação de sulfato de magnésio / anti-hipertensivo avaliada e conduta registrada', 'Acompanhante incentivado', 'Higiene das mãos e disponibilidade de materiais verificadas'] },
  { id: 'antesExpulsivo', label: 'Antes do expulsivo ou da cesárea', items: ['Necessidade de antibiótico reavaliada', 'Necessidade de sulfato de magnésio / anti-hipertensivo reavaliada', 'Materiais e medicamentos para mãe e RN preparados', 'Assistente identificado', 'Equipe pronta para reanimação neonatal'] },
  { id: 'posParto', label: 'Após o nascimento — primeira hora', items: ['Sangramento materno avaliado', 'Uterotônico profilático e conduta registrados conforme protocolo', 'Necessidade de antibiótico materno avaliada', 'Necessidade de sulfato de magnésio / anti-hipertensivo avaliada', 'RN avaliado: reanimação, antibiótico ou cuidados especiais', 'Pele a pele e amamentação iniciados quando clinicamente possíveis', 'Sinais de alerta explicados à mãe / acompanhante'] },
  { id: 'alta', label: 'Antes da alta', items: ['Permanência e critérios de alta avaliados conforme protocolo', 'Sangramento materno controlado', 'Necessidade de antibiótico para mãe e RN avaliada', 'RN alimentando-se adequadamente', 'Planejamento familiar orientado', 'Retorno organizado e sinais de alerta explicados'] },
];
export const MATERNITY_LABELS: Record<MaternityKind, string> = { checklist: 'Parto seguro', meows: 'MEOWS', bishop: 'Índice de Bishop', silverman: 'Silverman-Andersen (RN)', hpp: 'Risco de Hemorragia (HPP)' };
export function maternityResult(kind: MaternityKind, values: Record<string, string>): string {
  if (kind === 'bishop') { const t = fieldTotal(BISHOP_FIELDS, values); return `${t}/13 — colo ${t <= 5 ? 'desfavorável' : t <= 8 ? 'intermediário' : 'favorável'}`; }
  if (kind === 'silverman') return `${fieldTotal(SILVERMAN_FIELDS, values)}/10 — desconforto respiratório observado`;
  if (kind === 'meows') { const t = meowsTriggers(values); return `${t.red} vermelho(s), ${t.yellow} amarelo(s) — ${t.alert ? 'acionar avaliação clínica' : t.yellow ? 'gatilho isolado: reavaliar' : 'sem gatilho nesta avaliação'}`; }
  if (kind === 'hpp') return `Risco ${hppRisk(values)} — CMQCC v3.0`;
  const phase = BIRTH_PHASES.find((p) => p.id === values['phase']);
  if (!phase) throw new Error('Selecione o momento do checklist.');
  for (const [i, label] of phase.items.entries()) if (!['feito', 'pendente', 'na'].includes(values[String(i)] ?? '')) throw new Error(`Avalie: ${label}.`);
  const pending = phase.items.filter((_, i) => values[String(i)] === 'pendente').length;
  return `${phase.label} — ${pending ? `${pending} pendência(s)` : 'sem pendências registradas'}`;
}