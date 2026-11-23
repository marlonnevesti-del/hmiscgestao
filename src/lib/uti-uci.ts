// UTI Pediátrica e UCI: regras separadas por unidade (escalas, bundles, balanço hídrico, modelos de evolução).
import type { Ward } from './hospital-data';
import { SCALES as PS_SCALES, type ScaleDef as PsScaleDef } from './ps-infantil';

export type IcuUnit = 'UTIP' | 'UCI' | 'UTIN';
export interface IcuScaleDef { id: string; name: string; items: { label: string; options: { label: string; score: number }[] }[]; interpret: (t: number) => string }
const o = (labels: string[], start = 0) => labels.map((label, i) => ({ label, score: i + start }));

export const COMFORT_B: IcuScaleDef = { id: 'comfortb', name: 'COMFORT-B (sedação)', items: [
  { label: 'Alerta', options: o(['Sono profundo', 'Sono leve', 'Cochilando', 'Acordado e alerta', 'Hiperalerta'], 1) },
  { label: 'Calma/agitação', options: o(['Calmo', 'Levemente ansioso', 'Ansioso', 'Muito ansioso', 'Pânico'], 1) },
  { label: 'Resposta respiratória / choro', options: o(['Sem tosse/respiração espontânea', 'Respiração espontânea leve', 'Tosse ocasional/resistência', 'Briga com ventilador', 'Briga intensa/tosse'], 1) },
  { label: 'Movimentos', options: o(['Nenhum', 'Leves ocasionais', 'Leves frequentes', 'Vigorosos extremidades', 'Vigorosos tronco/cabeça'], 1) },
  { label: 'Tônus muscular', options: o(['Relaxado', 'Reduzido', 'Normal', 'Aumentado/flexão', 'Rigidez extrema'], 1) },
  { label: 'Tensão facial', options: o(['Totalmente relaxada', 'Tônus normal', 'Tensão em alguns músculos', 'Tensão facial total', 'Careta'], 1) },
], interpret: (t) => t <= 10 ? 'Sedação excessiva' : t <= 22 ? 'Sedação adequada' : 'Sedação insuficiente / desconforto' };

export const NIPS: IcuScaleDef = { id: 'nips', name: 'NIPS (dor neonatal)', items: [
  { label: 'Expressão facial', options: o(['Relaxada', 'Contraída']) },
  { label: 'Choro', options: o(['Ausente', 'Resmungos', 'Vigoroso']) },
  { label: 'Respiração', options: o(['Relaxada', 'Diferente do basal']) },
  { label: 'Braços', options: o(['Relaxados', 'Fletidos/estendidos']) },
  { label: 'Pernas', options: o(['Relaxadas', 'Fletidas/estendidas']) },
  { label: 'Estado de alerta', options: o(['Dormindo/calmo', 'Agitado']) },
], interpret: (t) => t > 3 ? 'Dor presente – intervir' : 'Sem dor' };

export const SILVERMAN: IcuScaleDef = { id: 'silverman', name: 'Silverman-Andersen', items: [
  { label: 'Movimento tórax/abdome', options: o(['Sincronizado', 'Declive inspiratório', 'Balancim']) },
  { label: 'Tiragem intercostal', options: o(['Ausente', 'Discreta', 'Acentuada']) },
  { label: 'Retração xifoide', options: o(['Ausente', 'Discreta', 'Acentuada']) },
  { label: 'Batimento de asa nasal', options: o(['Ausente', 'Discreto', 'Acentuado']) },
  { label: 'Gemido expiratório', options: o(['Ausente', 'Audível com estetoscópio', 'Audível sem estetoscópio']) },
], interpret: (t) => t === 0 ? 'Sem desconforto' : t <= 4 ? 'Desconforto leve' : t <= 7 ? 'Desconforto moderado' : 'Desconforto grave' };

export const SEPSE_NEO: IcuScaleDef = { id: 'sepseneo', name: 'Protocolo de sepse neonatal', items: [
  { label: 'Fator de risco materno (bolsa rota >18h, febre, ITU, SGB+)', options: o(['Não', 'Sim']) },
  { label: 'Instabilidade térmica', options: o(['Não', 'Sim']) },
  { label: 'Desconforto respiratório / apneia', options: o(['Não', 'Sim']) },
  { label: 'Má perfusão / TEC > 3s / hipotensão', options: o(['Não', 'Sim']) },
  { label: 'Intolerância alimentar / distensão', options: o(['Não', 'Sim']) },
  { label: 'Hipoatividade / letargia', options: o(['Não', 'Sim']) },
  { label: 'Glicemia alterada (<45 ou >180)', options: o(['Não', 'Sim']) },
  { label: 'Laboratório alterado (PCR, I/T > 0,2, plaquetas <100 mil)', options: o(['Não', 'Sim']) },
], interpret: (t) => t >= 3 ? 'Sepse provável – abrir protocolo (hemocultura + ATB na 1ª hora)' : t >= 1 ? 'Suspeita – reavaliar em 6h' : 'Sem sinais de sepse' };

const ps = (id: string) => PS_SCALES.find((s) => s.id === id) as PsScaleDef as unknown as IcuScaleDef;

export interface UnitConfig { id: IcuUnit; ward: Ward; name: string; profile: string; scales: IcuScaleDef[]; bundles: Record<string, string[]>; evolutions: Record<string, string>; almoxSectors: string[]; balance: 'horario' | 'turno' }
export const UNITS: Record<IcuUnit, UnitConfig> = {
  UTIP: { id: 'UTIP', ward: 'UTIP', name: 'UTI Pediátrica', profile: 'Crianças de 29 dias a 14 anos em estado crítico', balance: 'horario', almoxSectors: ['UTI Ped'],
    scales: [ps('pews'), COMFORT_B, ps('dor'), ps('glasgow'), ps('bradenq'), ps('humpty')].filter(Boolean),
    bundles: {
      'PAV': ['Cabeceira 30–45°', 'Higiene oral com clorexidina 0,12%', 'Pressão do balonete 20–25 cmH2O', 'Aspiração em sistema fechado', 'Avaliação diária de extubação / despertar'],
      'CVC': ['Higiene das mãos', 'Curativo íntegro e datado', 'Desinfecção dos conectores', 'Avaliação diária de necessidade', 'Equipos dentro do prazo'],
      'SVD': ['Fixação adequada', 'Bolsa abaixo da bexiga', 'Higiene meatal', 'Fluxo desobstruído', 'Avaliação diária de retirada'],
    },
    evolutions: {
      'Médica (Intensivista)': 'Neurológico (Glasgow/sedação/pupilas): \nRespiratório (VMI/VNI, parâmetros, gaso): \nHemodinâmico (PAM, DVA, perfusão): \nRenal/Metabólico (diurese ml/kg/h, BH 24h): \nGastrointestinal/Nutrição: \nInfeccioso (culturas, D-ATB): \nConduta e metas 24h: ',
      'Enfermeiro': 'Dispositivos (CVC/PICC calibre e data, TOT, SVD): \nBundles checados: \nPele/lesões: \nIntercorrências: \nMetas de enfermagem: ',
      'Técnico de enfermagem': 'Sinais vitais: \nAspiração/secreção: \nHigiene e conforto: \nEliminações: \nIntercorrências: ',
      'Fisioterapia': 'Modo ventilatório / PEEP / FiO2: \nComplacência / resistência: \nDesmame: \nAspiração: \nMobilização: ',
    } },
  UCI: { id: 'UCI', ward: 'UCI', name: 'UCI – Cuidados Intermediários', profile: 'Recém-nascidos e lactentes de média complexidade (UCINCo, Canguru e UCI pediátrica)', balance: 'turno', almoxSectors: ['UCI', 'Lactário'],
    scales: [SILVERMAN, NIPS, ps('dini')].filter(Boolean),
    bundles: {
      'PICC / Cateter umbilical': ['Curativo íntegro e datado', 'Permeabilidade (salinização)', 'Desinfecção dos conectores', 'Avaliação diária de necessidade'],
      'Pele e dispositivos': ['Proteção nasal da pronga de CPAP', 'Proteção ocular na fototerapia', 'Mudança de decúbito', 'Hidratação da pele'],
      'Método Canguru': ['Posição canguru realizada', 'Estímulo ao aleitamento', 'Orientação aos pais', 'Registro do tempo pele a pele'],
    },
    evolutions: {
      'Médica (Neonatologia/Pediatria)': 'IG corrigida / idade: \nPeso (ganho/perda): \nRespiratório (Silverman, O2): \nFototerapia / bilirrubinas: \nTolerância alimentar / resíduo: \nTriagens e vacinas: \nConduta: ',
      'Enfermeiro': 'Coto umbilical: \nAcessos venosos: \nVínculo mãe-bebê / Canguru: \nOrientações de alta: ',
      'Técnico de enfermagem': 'Peso das fraldas: \nFototerapia (horas, proteção ocular): \nHigiene: \nSucções ao seio / aceitação da dieta: ',
      'Lactário / Nutrição': 'Tipo de dieta (LMO pasteurizado / fórmula): \nVolume prescrito: \nVolume aceito: \nVia (seio/copinho/gavagem): \nResíduo gástrico (volume/aspecto): \nIntervalo: ',
      'Fonoaudiologia': 'Sucção nutritiva / não nutritiva: \nCoordenação S-D-R: \nTransição sonda → via oral: ',
    } },
  UTIN: { id: 'UTIN', ward: 'UTIN', name: 'UTI Neonatal', profile: 'Recém-nascidos até 28 dias em estado crítico (prematuros e termos)', balance: 'horario', almoxSectors: ['UTI Neo'],
    scales: [NIPS, SILVERMAN, SEPSE_NEO, ps('humpty'), ps('bradenq'), ps('dor')].filter(Boolean),
    bundles: {
      'PAV neonatal': ['Cabeceira 15–30°', 'Higiene oral com colostro/água destilada', 'Aspiração apenas se necessário', 'Circuito sem condensado', 'Avaliação diária de extubação'],
      'Cateter umbilical / PICC': ['Higiene das mãos', 'Curativo íntegro e datado', 'Desinfecção dos conectores', 'Posição radiológica confirmada', 'Avaliação diária de necessidade'],
      'Pele e CPAP': ['Proteção de septo nasal', 'Pronga de tamanho adequado', 'Mudança de decúbito', 'Proteção ocular na fototerapia', 'Umidificação da incubadora'],
    },
    evolutions: {
      'Médica (Neonatologista)': 'DV / IG corrigida: \nPeso atual / nascimento: \nRespiratório (suporte, parâmetros, gaso): \nHemodinâmico: \nInfeccioso (culturas, D-ATB): \nMetabólico (HGT, eletrólitos, bilirrubinas): \nNutrição (dieta, NPT, volume ml/kg/d): \nConduta / previsão de alta: ',
      'Enfermeiro': 'Incubadora / temperatura: \nDispositivos (data e sítio): \nPele / LPP: \nBundles checados: \nVínculo mãe-bebê: \nIntercorrências: ',
      'Técnico de enfermagem': 'Sinais vitais / HGT: \nPeso das fraldas: \nAspiração: \nHigiene e conforto: \nIntercorrências: ',
      'Lactário / Nutrição': 'Tipo de dieta (LMO / LHP / fórmula): \nVolume prescrito: \nVolume aceito: \nVia: \nResíduo gástrico: ',
      'Fisioterapia': 'Suporte ventilatório: \nAusculta: \nCondutas: ',
      'Fonoaudiologia': 'Sucção / coordenação S-D-R: \nTransição via oral: ',
      'Serviço Social': 'Situação familiar: \nDocumentação (DNV, certidão, cartão SUS): \nEncaminhamentos: ',
    } },
};

/** Registros exclusivos da UTI Neonatal (dispositivos, triagens, transfusões, crescimento, recebimento). */
export type NeoKind = 'dispositivo' | 'triagem' | 'transfusao' | 'crescimento' | 'recebimento' | 'higienizacao' | 'evento';
export interface NeoEntry { id: string; at: string; by: string; type: NeoKind; data: Record<string, string> }
export const NEO_FORMS: Record<NeoKind, { title: string; fields: { key: string; label: string; options?: string[]; type?: string }[] }> = {
  recebimento: { title: 'Recebimento do paciente', fields: [{ key: 'chegada', label: 'Hora de chegada', type: 'datetime-local' }, { key: 'origem', label: 'Origem', options: ['Centro obstétrico', 'Centro cirúrgico', 'Alojamento conjunto', 'Transferência externa', 'PS'] }, { key: 'pesoNasc', label: 'Peso ao nascer (g)', type: 'number' }, { key: 'ig', label: 'IG ao nascer (semanas)', type: 'number' }, { key: 'apgar', label: 'Apgar 1º/5º' }, { key: 'mae', label: 'Nome / prontuário da mãe' }, { key: 'tipoSang', label: 'Tipo sanguíneo RN/mãe' }, { key: 'cidade', label: 'Cidade de origem' }, { key: 'altoRisco', label: 'Gestação de alto risco', options: ['Não', 'Sim'] }] },
  dispositivo: { title: 'Dispositivo (inserção / retirada)', fields: [{ key: 'disp', label: 'Dispositivo', options: ['VM / TOT', 'VNI / CPAP', 'Cateter umbilical venoso', 'Cateter umbilical arterial', 'PICC', 'Acesso periférico', 'SOG / SNG', 'SVD', 'Dreno'] }, { key: 'acao', label: 'Ação', options: ['Inserção', 'Retirada', 'Extubação acidental', 'Perda acidental'] }, { key: 'calibre', label: 'Calibre / nº' }, { key: 'sitio', label: 'Sítio' }, { key: 'validade', label: 'Validade', type: 'date' }] },
  triagem: { title: 'Triagem neonatal', fields: [{ key: 'teste', label: 'Teste', options: ['Pezinho', 'Coraçãozinho', 'Olhinho', 'Orelhinha', 'Linguinha', 'LACEN (externo)', 'Cariótipo'] }, { key: 'coleta', label: 'Data da coleta', type: 'date' }, { key: 'resultado', label: 'Resultado', options: ['Aguardando', 'Normal', 'Alterado', 'Recoleta'] }, { key: 'obs', label: 'Observação / motivo recoleta' }] },
  transfusao: { title: 'Transfusão', fields: [{ key: 'hemo', label: 'Hemocomponente', options: ['Concentrado de hemácias filtrado/irradiado', 'Plaquetas', 'Plasma', 'Crioprecipitado'] }, { key: 'volume', label: 'Volume (ml)', type: 'number' }, { key: 'tempo', label: 'Tempo de infusão' }, { key: 'bolsa', label: 'Nº da bolsa' }, { key: 'checagem', label: 'Dupla checagem por' }, { key: 'reacao', label: 'Reação', options: ['Nenhuma', 'Febre', 'Rash', 'Outra'] }] },
  crescimento: { title: 'Crescimento (Fenton / Intergrowth)', fields: [{ key: 'igc', label: 'IG corrigida (semanas)', type: 'number' }, { key: 'peso', label: 'Peso (g)', type: 'number' }, { key: 'comp', label: 'Comprimento (cm)', type: 'number' }, { key: 'pc', label: 'Perímetro cefálico (cm)', type: 'number' }, { key: 'curva', label: 'Curva', options: ['Fenton', 'Intergrowth-21st'] }, { key: 'percentil', label: 'Percentil', options: ['< P3', 'P3–P10', 'P10–P50', 'P50–P90', 'P90–P97', '> P97'] }] },
  higienizacao: { title: 'Higienização de leito / equipamento', fields: [{ key: 'item', label: 'Item', options: ['Incubadora', 'Berço aquecido', 'Bomba de seringa', 'Monitor', 'Ventilador', 'Leito (terminal)', 'Leito (concorrente)'] }, { key: 'obs', label: 'Observação' }] },
  evento: { title: 'Evento / desfecho', fields: [{ key: 'evento', label: 'Evento', options: ['LPP', 'Vacina BCG', 'Vacina Hepatite B', 'Imagem realizada', 'Previsão de alta', 'Alta', 'Transferência interna', 'Transferência externa', 'Óbito'] }, { key: 'data', label: 'Data', type: 'date' }, { key: 'obs', label: 'Detalhes' }] },
};
export const weightBand = (g: number) => !g ? 'Não informado' : g < 1000 ? '< 1.000 g' : g < 1500 ? '1.000–1.499 g' : g < 2500 ? '1.500–2.499 g' : '≥ 2.500 g';
export const igBand = (w: number) => !w ? 'Não informado' : w < 28 ? '< 28 sem' : w < 32 ? '28–31 sem' : w < 37 ? '32–36 sem' : '≥ 37 sem';
const inMonth = (iso: string, comp: string) => iso.slice(0, 7) === comp;
export function neoReport(patients: { registration?: { sex?: string }; diagnosis?: string; intensive?: IntensiveRecord }[], comp: string) {
  const count = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1; };
  const r = { admissions: 0, peso: {} as Record<string, number>, ig: {} as Record<string, number>, sexo: {} as Record<string, number>, cidade: {} as Record<string, number>, diagnostico: {} as Record<string, number>, eventos: {} as Record<string, number>, sepse: 0, extubacao: 0, altoRisco: 0, transfusoes: 0, triagensAlteradas: 0 };
  for (const p of patients) {
    const neo = p.intensive?.neo ?? []; const rec = neo.find((e) => e.type === 'recebimento' && inMonth(e.at, comp));
    if (rec) { r.admissions++; count(r.peso, weightBand(Number(rec.data['pesoNasc']))); count(r.ig, igBand(Number(rec.data['ig']))); count(r.sexo, p.registration?.sex || 'Não informado'); count(r.cidade, rec.data['cidade'] || 'Não informado'); count(r.diagnostico, p.diagnosis || 'Não informado'); if (rec.data['altoRisco'] === 'Sim') r.altoRisco++; }
    for (const e of neo.filter((x) => inMonth(x.at, comp))) {
      if (e.type === 'evento' && e.data['evento']) count(r.eventos, e.data['evento']);
      if (e.type === 'dispositivo' && e.data['acao'] === 'Extubação acidental') r.extubacao++;
      if (e.type === 'transfusao') r.transfusoes++;
      if (e.type === 'triagem' && e.data['resultado'] === 'Alterado') r.triagensAlteradas++;
    }
    r.sepse += (p.intensive?.scales ?? []).filter((x) => inMonth(x.at, comp) && x.scale === SEPSE_NEO.name && x.total >= 3).length;
  }
  return r;
}

export const unitScale = (u: IcuUnit, id: string) => UNITS[u].scales.find((s) => s.id === id);
export const scaleSum = (picks: number[]) => picks.reduce((a, b) => a + (b || 0), 0);

export interface BalanceEntry { id: string; at: string; by: string; period: string; inputs: Record<string, number>; outputs: Record<string, number>; weightKg: number; hours: number }
export const BH_INPUTS = ['Dieta enteral/oral', 'NPT', 'Soros/manutenção', 'Medicações EV', 'Expansão/hemoderivados'];
export const BH_OUTPUTS = ['Diurese', 'Drenos', 'Resíduo gástrico/vômitos', 'Fezes', 'Perdas insensíveis'];
export function balance(e: Pick<BalanceEntry, 'inputs' | 'outputs' | 'weightKg' | 'hours'>) {
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + (Number(b) || 0), 0);
  const tin = sum(e.inputs), tout = sum(e.outputs); const diurese = Number(e.outputs['Diurese']) || 0;
  const debito = e.weightKg > 0 && e.hours > 0 ? Math.round((diurese / e.weightKg / e.hours) * 100) / 100 : 0;
  return { inputs: tin, outputs: tout, net: tin - tout, debito, oliguria: e.weightKg > 0 && e.hours > 0 && debito < 1 };
}
export function balance24h(list: BalanceEntry[], now = Date.now()) {
  return list.filter((b) => now - new Date(b.at).getTime() <= 86_400_000).reduce((a, b) => a + balance(b).net, 0);
}

/** Sinais vitais da UTI Neonatal (aba própria, separada do balanço hídrico). */
export interface NeoVital { id: string; at: string; by: string; time: string; pas: number; pad: number; fc: number; fr: number; tax: number; tIncub: number; sat: number; fio2: string; hgt: number; dor: number }
export const pam = (pas: number, pad: number) => pas > 0 && pad > 0 ? Math.round((pas + 2 * pad) / 3) : 0;
export const NEO_BH_INPUTS = ['Soro / manutenção EV', 'NPT', 'Medicações EV', 'Expansão / hemoderivados', 'Dieta SOG/SNG', 'Dieta oral / seio', 'Medicação oral'];
export const NEO_BH_OUTPUTS = ['Diurese', 'Evacuação', 'Resíduo gástrico', 'Vômitos / regurgitação', 'Drenos', 'Coletas de sangue'];
export interface ScaleEntry { id: string; at: string; by: string; scale: string; total: number; result: string }
export interface BundleEntry { id: string; at: string; by: string; bundle: string; checks: string[]; total: number }
export interface TextEntry { id: string; at: string; by: string; kind: string; text: string }
export interface SafetyInfo { continuous: string; devices: string[]; precaution: string; diet: string }
export interface IntensiveRecord { vitals?: NeoVital[]; scales?: ScaleEntry[]; balances?: BalanceEntry[]; bundles?: BundleEntry[]; notes?: TextEntry[]; safety?: SafetyInfo; neo?: NeoEntry[] }
export const DEVICES = ['TOT', 'Traqueostomia', 'CVC', 'PICC', 'Cateter umbilical', 'SVD', 'SNG/SNE', 'Dreno', 'CPAP/VNI', 'Fototerapia'];
export const bundleAdherencePct = (b: Pick<BundleEntry, 'checks' | 'total'>) => b.total ? Math.round((b.checks.length / b.total) * 100) : 0;
