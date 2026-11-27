import type { Encounter } from './care-flow';
import type { Patient } from './hospital-data';

/** Documentos clínicos da internação: Busca de Leito de UTI, Descrição Cirúrgica, Evolução Clínica (SOAP), Serviço Social e Encaminhamento. */
export type ClinicalDocKind = 'uti' | 'cirurgica' | 'evolucao' | 'social' | 'encaminhamento';
export interface DocField { key: string; label: string; long?: boolean; options?: string[]; required?: boolean }
export interface ClinicalDoc { id: string; at: string; by: string; values: Record<string, string> }

export const CLINICAL_DOCS: Record<ClinicalDocKind, { title: string; button: string; fields: DocField[] }> = {
  uti: { title: 'FICHA DE SOLICITAÇÃO / BUSCA DE LEITO DE UTI', button: 'Busca leito UTI', fields: [
    { key: 'tipo', label: 'Tipo de UTI', options: ['UTI Neonatal', 'UTI Pediátrica', 'UTI Adulto', 'UTI Obstétrica', 'PS Infantil'], required: true },
    { key: 'prioridade', label: 'Prioridade', options: ['1 – Emergência', '2 – Urgência', '3 – Eletiva'], required: true },
    { key: 'cid', label: 'CID principal', required: true },
    { key: 'diagnostico', label: 'Diagnóstico / hipótese', required: true },
    { key: 'resumo', label: 'Resumo clínico e justificativa', long: true, required: true },
    { key: 'ventilacao', label: 'Suporte ventilatório', options: ['Ar ambiente', 'Cateter O2', 'Máscara/Venturi', 'VNI / CPAP', 'Ventilação mecânica'] },
    { key: 'drogas', label: 'Drogas vasoativas / sedação' },
    { key: 'sinais', label: 'Sinais vitais atuais (PA, FC, FR, SatO2, Tax, Glasgow)' },
    { key: 'escore', label: 'Escore de gravidade (SOFA / PIM2 / SNAPPE)' },
    { key: 'exames', label: 'Exames relevantes', long: true },
    { key: 'regulacao', label: 'Nº protocolo da Central de Regulação' },
    { key: 'medico', label: 'Médico solicitante', required: true }, { key: 'crm', label: 'CRM' },
  ] },
  cirurgica: { title: 'DESCRIÇÃO CIRÚRGICA', button: 'Descrição cirúrgica', fields: [
    { key: 'data', label: 'Data / horário (início – fim)', required: true },
    { key: 'cirurgiao', label: 'Cirurgião', required: true }, { key: 'crm', label: 'CRM' },
    { key: 'auxiliar', label: 'Auxiliar(es)' }, { key: 'anestesista', label: 'Anestesista' },
    { key: 'anestesia', label: 'Tipo de anestesia', options: ['Geral', 'Raquianestesia', 'Peridural', 'Combinada', 'Sedação', 'Local', 'Bloqueio'] },
    { key: 'preop', label: 'Diagnóstico pré-operatório', required: true }, { key: 'posop', label: 'Diagnóstico pós-operatório' },
    { key: 'procedimento', label: 'Procedimento realizado', required: true }, { key: 'sigtap', label: 'Código SIGTAP' },
    { key: 'descricao', label: 'Descrição dos tempos cirúrgicos', long: true, required: true },
    { key: 'achados', label: 'Achados operatórios', long: true },
    { key: 'sangramento', label: 'Perda sanguínea estimada' }, { key: 'drenos', label: 'Drenos / sondas' },
    { key: 'peca', label: 'Peça para anatomopatológico', options: ['Não', 'Sim'] },
    { key: 'intercorrencias', label: 'Intercorrências' },
    { key: 'destino', label: 'Destino', options: ['SRPA', 'Enfermaria', 'Alojamento Conjunto', 'UTI'] },
  ] },
  evolucao: { title: 'EVOLUÇÃO CLÍNICA', button: 'Evolução clínica', fields: [
    { key: 's', label: 'S – Subjetivo', long: true, required: true }, { key: 'o', label: 'O – Objetivo / exame físico', long: true, required: true },
    { key: 'a', label: 'A – Avaliação', long: true, required: true }, { key: 'p', label: 'P – Plano / conduta', long: true, required: true },
    { key: 'medico', label: 'Médico', required: true }, { key: 'crm', label: 'CRM' },
  ] },
  social: { title: 'EVOLUÇÃO DO SERVIÇO SOCIAL', button: 'Serviço Social', fields: [
    { key: 'composicao', label: 'Composição familiar / rede de apoio', long: true },
    { key: 'renda', label: 'Renda e benefícios (Bolsa Família, BPC…)' },
    { key: 'moradia', label: 'Condições de moradia' },
    { key: 'vulnerabilidade', label: 'Vulnerabilidade', options: ['Sem vulnerabilidade', 'Baixa', 'Moderada', 'Alta'], required: true },
    { key: 'demandas', label: 'Demandas identificadas', long: true },
    { key: 'evolucao', label: 'Evolução / intervenção realizada', long: true, required: true },
    { key: 'assistente', label: 'Assistente social', required: true }, { key: 'cress', label: 'CRESS' },
  ] },
  encaminhamento: { title: 'FICHA DE ENCAMINHAMENTO PARA SERVIÇO DE REFERÊNCIA', button: 'Encaminhamento', fields: [
    { key: 'servico', label: 'Serviço de destino', options: ['CRAS', 'CREAS', 'Conselho Tutelar', 'UBS / ESF', 'CAPS', 'Ministério Público / Judiciário', 'Outro'], required: true },
    { key: 'unidade', label: 'Unidade / município' },
    { key: 'motivo', label: 'Motivo do encaminhamento', long: true, required: true },
    { key: 'historico', label: 'Breve histórico', long: true },
    { key: 'contato', label: 'Contato do responsável' },
    { key: 'assistente', label: 'Assistente social', required: true }, { key: 'cress', label: 'CRESS' },
  ] },
};

export const missingFields = (kind: ClinicalDocKind, v: Record<string, string>) =>
  CLINICAL_DOCS[kind].fields.filter((f) => f.required && !v[f.key]?.trim()).map((f) => f.label);

export const DAY = 86_400_000;
/** Internações (encounters com FIA) no mês e reinternações: mesma paciente com FIA anterior em até 30 dias / 6 meses. */
export function admissionsReport(encounters: Encounter[], patients: Patient[], month: string) {
  const adm = encounters.filter((e) => e.fia).sort((a, b) => a.fia!.openedAt.localeCompare(b.fia!.openedAt));
  const inMonth = adm.filter((e) => e.fia!.openedAt.slice(0, 7) === month);
  const rows = inMonth.map((e) => {
    const prev = adm.filter((x) => x.patientId === e.patientId && x.fia!.openedAt < e.fia!.openedAt).pop();
    const gap = prev ? (Date.parse(e.fia!.openedAt) - Date.parse(prev.discharge?.at || prev.fia!.openedAt)) / DAY : null;
    const end = e.discharge?.at ? Date.parse(e.discharge.at) : null;
    return { e, p: patients.find((p) => p.id === e.patientId), gap, r30: gap !== null && gap <= 30, r6m: gap !== null && gap <= 182, los: end ? Math.max(0, (end - Date.parse(e.fia!.openedAt)) / DAY) : null };
  });
  const closed = rows.filter((r) => r.los !== null);
  return { rows, total: rows.length, r30: rows.filter((r) => r.r30).length, r6m: rows.filter((r) => r.r6m).length,
    altas: closed.length, avgLos: closed.length ? closed.reduce((s, r) => s + r.los!, 0) / closed.length : 0 };
}
export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
