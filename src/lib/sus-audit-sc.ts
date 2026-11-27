import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";
import { competenceOf, type Professional, type SusRow } from "./sus-billing";

export type AuditSeverity = "bloqueio" | "alerta";
export interface AuditFinding {
  severity: AuditSeverity;
  category: "AIH / SISREG" | "Obstetrícia / DNV" | "Cadastro / IBGE" | "Profissional / CNES" | "SADT / Laudos" | "SIGTAP / CID";
  encounterNumber: string;
  patientName: string;
  message: string;
}

export interface PreAuditReport {
  competence: string;
  total: number;
  readyCount: number;
  blockedCount: number;
  warningCount: number;
  findings: AuditFinding[];
}

const digits = (v = "") => v.replace(/\D/g, "");

/** Executa crítica prévia com regras rígidas do DATASUS e da SES-SC. */
export function runSusPreAudit(
  rows: SusRow[],
  patients: Patient[],
  competence: string,
  prof: Professional,
): PreAuditReport {
  const findings: AuditFinding[] = [];
  const blockedIds = new Set<string>();
  const warnedIds = new Set<string>();
  const dnvSeen = new Map<string, string>();

  if (digits(prof.cns).length !== 15 || digits(prof.cbo).length !== 6) {
    findings.push({
      severity: "bloqueio",
      category: "Profissional / CNES",
      encounterNumber: "LOTE",
      patientName: prof.name || "Profissional responsável",
      message: "Informe CNS (15 dígitos) e CBO (6 dígitos) válidos do profissional vinculado ao CNES.",
    });
  }

  for (const r of rows) {
    const key = `${r.encounter.id}-${r.origin ?? "main"}-${r.procedure}`;
    for (const issue of r.issues) {
      blockedIds.add(key);
      const category: AuditFinding["category"] =
        /AIH|saída/i.test(issue) ? "AIH / SISREG"
        : /DNV|parto|gestacional|obstétric/i.test(issue) ? "Obstetrícia / DNV"
        : /exame|laudo/i.test(issue) ? "SADT / Laudos"
        : /Profissional|CBO/i.test(issue) ? "Profissional / CNES"
        : /CID|procedimento|idade|permanência/i.test(issue) ? "SIGTAP / CID"
        : "Cadastro / IBGE";
      findings.push({ severity: "bloqueio", category, encounterNumber: r.encounter.number, patientName: r.name, message: issue });
    }

    if (r.cityCode === "999999") {
      blockedIds.add(key);
      findings.push({ severity: "bloqueio", category: "Cadastro / IBGE", encounterNumber: r.encounter.number, patientName: r.name, message: "Código IBGE genérico (999999) é rejeitado pelo DATASUS." });
    }

    if (r.kind === "AIH") {
      const aihNum = digits(r.aihNumber);
      if (aihNum.length === 13 && !aihNum.startsWith("42")) {
        warnedIds.add(key);
        findings.push({ severity: "alerta", category: "AIH / SISREG", encounterNumber: r.encounter.number, patientName: r.name, message: `Nº AIH ${aihNum} não inicia com 42 (série UF Santa Catarina).` });
      }
      const dischargeDate = r.encounter.discharge?.at?.slice(0, 10) ?? "";
      if (r.aihAuthorizedAt && dischargeDate && r.aihAuthorizedAt > dischargeDate) {
        warnedIds.add(key);
        findings.push({ severity: "alerta", category: "AIH / SISREG", encounterNumber: r.encounter.number, patientName: r.name, message: "Data de autorização da AIH posterior à data da alta — risco de glosa na SES-SC." });
      }
      for (const b of r.births) {
        if (b.dnv) {
          const prev = dnvSeen.get(b.dnv);
          if (prev && prev !== r.encounter.number) {
            blockedIds.add(key);
            findings.push({ severity: "bloqueio", category: "Obstetrícia / DNV", encounterNumber: r.encounter.number, patientName: r.name, message: `DNV ${b.dnv} duplicada com o atendimento ${prev}.` });
          } else {
            dnvSeen.set(b.dnv, r.encounter.number);
          }
        }
      }
      const p = r.patient;
      if (p?.babyIds?.length && r.exitReason && r.exitReason !== "62") {
        const hasAdmittedBaby = p.babyIds.some((bid) => {
          const baby = patients.find((x) => x.id === bid);
          return !!baby && (baby.ward === "UTIN" || baby.ward === "UCI" || !!baby.bed);
        });
        if (hasAdmittedBaby) {
          warnedIds.add(key);
          findings.push({ severity: "alerta", category: "Obstetrícia / DNV", encounterNumber: r.encounter.number, patientName: r.name, message: "RN permanece internado (UTI/UCI) — motivo de saída da mãe deve ser 62." });
        }
      }
    }
  }

  const blockedCount = blockedIds.size;
  const warningCount = [...warnedIds].filter((id) => !blockedIds.has(id)).length;
  const readyCount = Math.max(0, rows.length - blockedCount);
  return { competence, total: rows.length, readyCount, blockedCount, warningCount, findings };
}

export interface ClosingChecklistItem {
  id: string;
  label: string;
  detail: string;
}

export const SC_CLOSING_CHECKLIST: ClosingChecklistItem[] = [
  { id: "dnv-sinasc", label: "DNVs dos partos conferidas com o Centro Obstétrico / SINASC", detail: "Validar nº DNV, peso ao nascer, idade gestacional e motivo 62 para RN em UTI Neo." },
  { id: "aih-sisreg", label: "Autorizações de AIH (SISREG) conferidas antes da alta", detail: "Verificar série 42 (SC) e datas de autorização compatíveis com internação e alta." },
  { id: "diarias-uti", label: "Diárias de UTI Neonatal, UTI Pediátrica e UCI batidas com o Censo", detail: "Conferir permanência e mudanças de procedimento para longa permanência." },
  { id: "sadt-terceiros", label: "Exames terceirizados conciliados em Conferência de Exames", detail: "Garantir pedido médico (PED) e laudo assinado para todos os exames faturados." },
  { id: "cnes-profissionais", label: "Médicos e CBOs da competência ativos no espelho do CNES", detail: "Evitar glosa por profissional sem vínculo ativo no CNES 2594277." },
  { id: "validador-datasus", label: "Lotes testados nos validadores oficiais (SISAIH01 e BPA Magnético)", detail: "Importar TXT/ZIP na máquina do faturamento antes do envio à GEFAT/SES-SC." },
];

export interface ContractGoalsConfig {
  partos: number;
  internacoes: number;
  consultas: number;
  exames: number;
}

export const DEFAULT_CONTRACT_GOALS: ContractGoalsConfig = {
  partos: 180,
  internacoes: 220,
  consultas: 3500,
  exames: 1800,
};

export interface GoalProgress {
  key: keyof ContractGoalsConfig;
  label: string;
  actual: number;
  target: number;
  pct: number;
  status: "atingida" | "atencao" | "critica";
}

export function computeContractGoals(
  rows: SusRow[],
  encounters: Encounter[],
  competence: string,
  targets: ContractGoalsConfig = DEFAULT_CONTRACT_GOALS,
): GoalProgress[] {
  const compEncs = encounters.filter((e) => competenceOf(e.openedAt) === competence);
  const aihRows = rows.filter((r) => r.kind === "AIH");
  const partos = aihRows.filter((r) => r.births.length > 0 || /^(0310|0411)/.test(r.procedure) || /^O8[0-4]/.test(r.cid)).length;
  const internacoes = aihRows.length;
  const consultas = rows.filter((r) => r.kind === "BPA" && r.origin !== "triage" && r.origin !== "procedure").length;
  const exames = compEncs.reduce((sum, e) => sum + (e.examRequests ?? []).filter((x) => x.status === "Realizado").length, 0);

  const make = (key: keyof ContractGoalsConfig, label: string, actual: number): GoalProgress => {
    const target = Math.max(1, targets[key]);
    const pct = Math.round((actual / target) * 100);
    const status = pct >= 90 ? "atingida" : pct >= 65 ? "atencao" : "critica";
    return { key, label, actual, target, pct, status };
  };

  return [
    make("partos", "Partos / Obstetrícia (AIH)", partos),
    make("internacoes", "Internações Totais (AIH)", internacoes),
    make("consultas", "Consultas e Atendimentos (BPA)", consultas),
    make("exames", "Exames / SADT Realizados", exames),
  ];
}