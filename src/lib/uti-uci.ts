// UTI Pediátrica e UCI: regras separadas por unidade (escalas, bundles, balanço hídrico, modelos de evolução).
import type { Ward } from './hospital-data';
import { SCALES as PS_SCALES, type ScaleDef as PsScaleDef } from './ps-infantil';

export type IcuUnit = 'UTIP' | 'UCI';
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
};

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

export interface ScaleEntry { id: string; at: string; by: string; scale: string; total: number; result: string }
export interface BundleEntry { id: string; at: string; by: string; bundle: string; checks: string[]; total: number }
export interface TextEntry { id: string; at: string; by: string; kind: string; text: string }
export interface SafetyInfo { continuous: string; devices: string[]; precaution: string; diet: string }
export interface IntensiveRecord { scales?: ScaleEntry[]; balances?: BalanceEntry[]; bundles?: BundleEntry[]; notes?: TextEntry[]; safety?: SafetyInfo }
export const DEVICES = ['TOT', 'Traqueostomia', 'CVC', 'PICC', 'Cateter umbilical', 'SVD', 'SNG/SNE', 'Dreno', 'CPAP/VNI', 'Fototerapia'];
export const bundleAdherencePct = (b: Pick<BundleEntry, 'checks' | 'total'>) => b.total ? Math.round((b.checks.length / b.total) * 100) : 0;
