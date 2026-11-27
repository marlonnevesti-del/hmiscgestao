import type { Encounter, ExtraProcedure } from './care-flow';

export const MILK_REASONS = ['Atendimento no Banco de Leite', 'Cadastro de Doadora', 'Coleta de Leite Materno', 'Processamento de Leite Materno'] as const;
export interface MilkCareRecord {
  id: string; at: string; by: string; council: string;
  reason: string; assessment: string; conduct: string; plan: string; cid: string;
  consultationCode: string; procedures: ExtraProcedure[];
}
export function milkCareText(r: MilkCareRecord) {
  return `Banco de Leite · ${r.reason}\nAvaliação: ${r.assessment}\nConduta: ${r.conduct}\nPlano/orientações: ${r.plan}\nCID: ${r.cid}\n${r.by} · ${r.council}`;
}
export function validateMilkCare(r: Omit<MilkCareRecord, 'id' | 'at' | 'by'>, e: Encounter, finish: boolean) {
  if (!r.assessment.trim() || !r.conduct.trim() || !r.council.trim() || !r.cid.trim()) throw new Error('Informe avaliação, conduta, CID e COREN/CRM.');
  if (!MILK_REASONS.some((x) => x === r.reason)) throw new Error('Selecione o motivo do atendimento.');
  if (r.consultationCode && !['0301010048', '0301010072'].includes(r.consultationCode)) throw new Error('Código de consulta inválido.');
  if (r.procedures.some((p) => !/^02\d{8}$/.test(p.code))) throw new Error('Selecione exames do grupo 02 SIGTAP.');
  if (e.status_fluxo === 'ALTA_HOSPITALAR') throw new Error('Atendimento encerrado.');
  if (finish && (e.type !== 'Ambulatório' || e.specialty !== 'Banco de Leite' || e.fia || e.admission?.status === 'autorizada')) throw new Error('A conclusão do Banco de Leite não pode encerrar uma internação ou atendimento de outro setor.');
  if (finish && !r.consultationCode) throw new Error('Confirme o código da consulta realizada.');
}