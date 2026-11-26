import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";
import { DEFAULT_TRIAGE_SIGTAP } from "./medical-sigtap";
import { CNES, DEFAULT_INSTITUTION, type InstitutionConfig } from "./institution";

export { CNES } from "./institution";
export interface Professional { name: string; cns: string; cbo: string }
export interface SusRow {
  encounter: Encounter; patient?: Patient | undefined; kind: "BPA" | "AIH";
  date: string; cns: string; cpf: string; name: string; birthDate: string; sex: string; motherName: string;
  cityCode: string; cid: string; procedure: string; issues: string[];
  aihNumber: string; aihAuthorizedAt: string; exitReason: string; births: AihBirth[];
  origin?: "triage" | "procedure";
  procedureName?: string;
}
export interface AihBirth { rnId: string; name: string; dnv: string; weight: number; weeks: string; alive: boolean }

/** Motivos de saída/permanência da Tabela SUS (SIH/SUS). */
export const EXIT_REASONS: [string, string][] = [
  ["11", "Alta curado"], ["12", "Alta melhorado"], ["14", "Alta a pedido"], ["15", "Alta com previsão de retorno"], ["16", "Alta por evasão"], ["18", "Alta por outros motivos"],
  ["21", "Permanência por características da doença"], ["22", "Permanência por intercorrência"], ["23", "Permanência por impossibilidade sócio-familiar"], ["28", "Permanência por outros motivos"],
  ["31", "Transferência para outro estabelecimento"], ["32", "Transferência para internação domiciliar"],
  ["41", "Óbito com DO fornecida pelo médico assistente"], ["42", "Óbito com DO fornecida pelo IML"], ["43", "Óbito com DO fornecida pelo SVO"],
  ["51", "Encerramento administrativo"],
  ["61", "Alta da mãe/puérpera e do recém-nascido"], ["62", "Alta da mãe/puérpera e permanência do RN"], ["63", "Alta da mãe/puérpera e óbito do RN"],
  ["64", "Alta da mãe/puérpera com óbito fetal"], ["65", "Óbito da gestante e do concepto"], ["66", "Óbito da mãe/puérpera e alta do RN"], ["67", "Óbito da mãe/puérpera e permanência do RN"],
];
export const isObstetricExit = (c: string) => /^6[1-7]$/.test(c);
/** Nº AIH: 13 dígitos (UF + ano + sequência + dígito). */
export const validAihNumber = (v = "") => /^\d{13}$/.test(v.replace(/\D/g, ""));
export const validDnv = (v = "") => /^\d{8,11}$/.test(v.replace(/\D/g, ""));

/** Competência AAAAMM a partir de uma data ISO. */
export const competenceOf = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; };
const digits = (v = "") => v.replace(/\D/g, "");
const wasAdmitted = (e: Encounter) => e.status_fluxo === "ENCAMINHADO_INTERNACAO" || e.history.some((h) => h.status === "ENCAMINHADO_INTERNACAO");

export const SIGTAP_DEFAULT = { BPA: "0301060061", AIH: "0303010037" };

/** Códigos SIGTAP usados pelo faturamento ambulatorial do HMISC (atalho de 1 clique). */
export const HMISC_BPA_CODES: { code: string; label: string }[] = [
  { code: "0301010072", label: "Consulta médica em atenção especializada" },
  { code: "0301010048", label: "Consulta de profissional de nível superior (não médico)" },
  { code: "0301060061", label: "Atendimento materno até 4 horas" },
  { code: "0301060029", label: "Atendimento materno acima de 4 horas (observação)" },
  { code: "0301060118", label: "Acolhimento com classificação de risco" },
];
const endOf = (e: Encounter) => e.discharge?.at || e.baaClosedAt || e.history.at(-1)?.at || "";
/** Maternidade: até 4h → 0301060061; acima de 4h → 0301060029. Sem horário de saída, mantém até 4h. */
export function maternalCodeByDuration(e: Pick<Encounter, "openedAt" | "discharge" | "baaClosedAt" | "history">): string {
  const end = Date.parse(endOf(e as Encounter)), start = Date.parse(e.openedAt);
  return Number.isFinite(end) && Number.isFinite(start) && end - start > 4 * 3600000 ? "0301060029" : "0301060061";
}
/** Exames realizados que ainda não têm laudo. */
export const examsWithoutReport = (e: Encounter) => (e.examRequests ?? []).filter((x) => x.status === "Realizado" && !x.report?.trim());

/** Código real do atendimento (laudo AIH ou procedimento registrado); padrão só se nada foi informado. */
export function pickProcedure(e: Encounter, kind: "BPA" | "AIH"): string {
  const aih = digits(e.aihLaudo?.['codigo']), proc = digits(e.sigtapCode);
  const ok = (c: string) => c.length === 10 ? c : "";
  const fallback = kind === "BPA" && e.type === "Maternidade" ? maternalCodeByDuration(e) : SIGTAP_DEFAULT[kind];
  return (kind === "AIH" ? ok(aih) || ok(proc) : ok(proc)) || fallback;
}

/** RNs vinculados à mãe, com DNV informado no laudo AIH (chave dnv_<id>). */
export function birthsOf(e: Encounter, p: Patient | undefined, patients: Patient[]): AihBirth[] {
  return (p?.babyIds ?? []).map((id) => patients.find((x) => x.id === id)).filter((b): b is Patient => !!b).map((b) => ({
    rnId: b.id, name: b.name, dnv: digits(e.aihLaudo?.[`dnv_${b.id}`]), weight: b.newborn?.pesoNascer ?? Math.round(b.weight * 1000),
    weeks: (p?.ig ?? "").match(/\d+/)?.[0] ?? "", alive: e.aihLaudo?.[`rnObito_${b.id}`] !== "1",
  }));
}

export function buildSusRows(encounters: Encounter[], patients: Patient[], competence: string, prof: Professional): SusRow[] {
  return encounters.filter((e) => competenceOf(e.openedAt) === competence).flatMap((e) => {
    const p = patients.find((x) => x.id === e.patientId);
    const r = p?.registration;
    const kind = wasAdmitted(e) ? "AIH" : "BPA";
    const row: SusRow = {
      encounter: e, patient: p, kind, date: e.openedAt.slice(0, 10),
      cns: digits(r?.cns), cpf: digits(r?.cpf || p?.cpf), name: r?.civilName || p?.name || "",
      birthDate: r?.birthDate ?? "", sex: (r?.sex ?? "").slice(0, 1).toUpperCase(),
      motherName: r?.parent1 || p?.motherName || "", cityCode: digits(r?.addresses?.find((a) => a.primary)?.cityCode || r?.addresses?.find((a) => a.cityCode)?.cityCode || r?.birthplaceCode),
      cid: (e.medical?.cid ?? "").replace(/\W/g, "").toUpperCase(), procedure: pickProcedure(e, kind), issues: [],
      aihNumber: digits(e.aihLaudo?.['aihNumero']), aihAuthorizedAt: e.aihLaudo?.['aihData'] ?? "", exitReason: e.aihLaudo?.['motivoSaida'] ?? "",
      births: kind === "AIH" ? birthsOf(e, p, patients) : [],
    };
    row.issues = susIssues(row, prof);
    examsWithoutReport(e).forEach((x) => row.issues.push(`Exame realizado sem laudo: ${x.exams}`));
    const triageCode = digits(e.triage?.sigtapCode) || (e.triage ? DEFAULT_TRIAGE_SIGTAP : "");
    const rows: SusRow[] = [row];
    const seenBpa = new Set<string>(kind === "BPA" ? [row.procedure] : []);
    if (triageCode && !seenBpa.has(triageCode)) {
      seenBpa.add(triageCode);
      const triageRow: SusRow = { ...row, kind: "BPA", procedure: triageCode, aihNumber: "", aihAuthorizedAt: "", exitReason: "", births: [], origin: "triage", issues: [] };
      triageRow.issues = susIssues(triageRow, prof);
      rows.push(triageRow);
    }
    for (const ep of e.extraProcedures ?? []) {
      const epCode = digits(ep.code);
      if (epCode.length !== 10 || seenBpa.has(epCode)) continue;
      seenBpa.add(epCode);
      const epRow: SusRow = { ...row, kind: "BPA", procedure: epCode, procedureName: ep.name, aihNumber: "", aihAuthorizedAt: "", exitReason: "", births: [], origin: "procedure", issues: [] };
      epRow.issues = susIssues(epRow, prof);
      rows.push(epRow);
    }
    return rows;
  });
}

/** Pendências que o validador do DATASUS rejeitaria. */
export function susIssues(r: Pick<SusRow, "cns" | "cid" | "birthDate" | "sex" | "cityCode" | "motherName" | "kind"> & { procedure?: string; date?: string }, prof: Professional): string[] {
  const out: string[] = [];
  const obstetric = (r.procedure ?? "").startsWith("0411") || (r.procedure ?? "").startsWith("0310") || r.cid.startsWith("O");
  if (obstetric && r.sex === "M") out.push("Procedimento/CID obstétrico em paciente masculino");
  if (r.birthDate && r.date && r.birthDate > r.date) out.push("Nascimento posterior ao atendimento");
  if (r.cid.startsWith("P") && r.birthDate && r.date && (Date.parse(r.date) - Date.parse(r.birthDate)) / 86400000 > 28) out.push("CID perinatal (P) fora do período neonatal (28 dias)");
  if (r.cns.length !== 15) out.push("Paciente sem CNS (15 dígitos)");
  if (!r.cid) out.push("Sem CID-10");
  if (!r.birthDate) out.push("Sem data de nascimento");
  if (r.sex !== "M" && r.sex !== "F") out.push("Sem sexo");
  if (r.cityCode.length < 6) out.push("Sem código IBGE do município");
  if (r.kind === "AIH" && !r.motherName) out.push("Sem nome da mãe");
  if (r.kind === "AIH") out.push(...aihIssues(r as Partial<SusRow>));
  if (digits(prof.cns).length !== 15) out.push("Profissional sem CNS");
  if (digits(prof.cbo).length !== 6) out.push("Profissional sem CBO");
  return out;
}

/** Campos oficiais da AIH: número autorizado, data, motivo de saída e dados do RN. */
export function aihIssues(r: Partial<Pick<SusRow, "aihNumber" | "aihAuthorizedAt" | "exitReason" | "births" | "date">>): string[] {
  const out: string[] = [];
  if (!validAihNumber(r.aihNumber)) out.push("Sem nº da AIH autorizada (13 dígitos)");
  if (!r.aihAuthorizedAt) out.push("Sem data de autorização da AIH");
  if (!r.exitReason) out.push("Sem motivo de saída SUS");
  else if (!EXIT_REASONS.some(([c]) => c === r.exitReason)) out.push("Motivo de saída inválido");
  if (r.exitReason && isObstetricExit(r.exitReason)) {
    const b = r.births ?? [];
    if (!b.length) out.push("Motivo de parto sem RN vinculado");
    b.forEach((x) => { if (x.alive && !validDnv(x.dnv)) out.push(`${x.name}: sem nº da DNV`); if (!x.weight) out.push(`${x.name}: sem peso ao nascer`); });
    if (b.length && !b[0]?.weeks) out.push("Sem idade gestacional (semanas)");
  }
  return out;
}

const pad = (v: string, n: number) => v.slice(0, n).padEnd(n, " ");
const num = (v: string | number, n: number) => String(v).replace(/\D/g, "").slice(-n).padStart(n, "0");
const plain = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/** Remessa BPA-I (linhas tipo 03) no layout posicional; só exporta linhas sem pendência. */
export function bpaFile(rows: SusRow[], competence: string, prof: Professional, inst: InstitutionConfig = DEFAULT_INSTITUTION): string {
  const ok = rows.filter((r) => r.kind === "BPA" && r.issues.length === 0);
  const cnes = inst.cnes || CNES;
  const esfera = inst.esferaGestao === "M" ? "M" : "E";
  const header = `01#BPA#${competence}${num(ok.length, 6)}${num(1, 6)}${num(0, 4)}${pad(plain(inst.razaoSocial || inst.nomeFantasia || "HMISC"), 30)}${pad(plain(inst.sigla || "HMISC"), 6)}${num(inst.cnpj, 14)}${pad(plain(inst.orgaoGestor || "SECRETARIA DE ESTADO DA SAUDE"), 40)}${esfera}${pad("HMISC 1.0", 10)}`;
  const lines = ok.map((r, i) => [
    "03", num(cnes, 7), competence, num(prof.cns, 15), num(prof.cbo, 6), r.date.replace(/-/g, ""), num(1, 3), num(i + 1, 2),
    num(r.procedure, 10), num(r.cns, 15), r.sex, num(r.cityCode, 6), pad(r.cid, 4), num(ageAt(r.birthDate, r.date), 3), num(1, 6),
    "01", pad(r.encounter.number, 13), "BPA", pad(plain(r.name), 30), r.birthDate.replace(/-/g, ""),
  ].join(""));
  return [header, ...lines].join("\r\n") + "\r\n";
}

/** Remessa de AIH em lote (registro por internação) para conferência/importação no SISAIH01. */
export function aihFile(rows: SusRow[], competence: string, prof: Professional, inst: InstitutionConfig = DEFAULT_INSTITUTION): string {
  const cnes = inst.cnes || CNES;
  return rows.filter((r) => r.kind === "AIH" && r.issues.length === 0).map((r) => [
    num(cnes, 7), competence, pad(r.encounter.number, 13), r.date.replace(/-/g, ""), num(r.procedure, 10), pad(r.cid, 4),
    num(r.cns, 15), pad(plain(r.name), 70), r.birthDate.replace(/-/g, ""), r.sex, pad(plain(r.motherName), 70), num(r.cityCode, 7),
    num(prof.cns, 15), num(prof.cbo, 6), num(r.aihNumber, 13), r.aihAuthorizedAt.replace(/-/g, "").padEnd(8, "0"), num(r.exitReason, 2),
    ...r.births.flatMap((b) => [num(b.dnv, 11), num(b.weight, 4), num(b.weeks, 2), b.alive ? "1" : "2"]),
  ].join("")).join("\r\n") + "\r\n";
}

export function ageAt(birth: string, at: string) {
  const b = new Date(birth), d = new Date(at);
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return 0;
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return Math.max(0, a);
}

/** Nome oficial da remessa CIHA01: CNES + AAAA + MM + ".CHA". */
export const cihaFileName = (competence: string, cnes: string = CNES) => `${cnes.replace(/\D/g, "") || CNES}${competence}.CHA`;
const ddmmaaaa = (iso: string) => { const d = iso.slice(0, 10).split("-"); return d.length === 3 ? `${d[2]}${d[1]}${d[0]}` : "00000000"; };

/**
 * Remessa de importação do CIHA01 (Portarias GM/MS 637/2007 e 1.171/2011).
 * Header tipo 1; internações (FIA) tipo 2; ambulatoriais (BAA) tipo 4; sem movimento tipo 3.
 * Endereço/nascimento/sexo seguem as posições oficiais (2–131); os campos seguintes seguem a ordem da portaria.
 */
export function cihaFile(rows: SusRow[], competence: string, inst: InstitutionConfig = DEFAULT_INSTITUTION): string {
  const ok = rows.filter((r) => r.issues.length === 0);
  const header = `1${num(inst.cnes || CNES, 7)}${pad("1.0.0.0", 7)}`;
  if (!ok.length) return [header, "3"].join("\r\n") + "\r\n";
  const lines = ok.map((r) => {
    const a = r.patient?.registration?.addresses?.find((x) => x.primary) ?? r.patient?.registration?.addresses?.[0];
    const street = [a?.streetType, a?.street].filter(Boolean).join(" ");
    const out = r.encounter.discharge?.at || r.encounter.history.at(-1)?.at || r.encounter.openedAt;
    return [
      r.kind === "AIH" ? "2" : "4", pad(plain(r.name), 60), pad(plain(street), 25), pad(plain(a?.number ?? ""), 5), pad(plain(a?.complement ?? ""), 15),
      num(r.cityCode.slice(0, 6), 6), pad(plain(a?.state ?? "SC"), 2), num(a?.postalCode ?? "", 8), ddmmaaaa(r.birthDate), r.sex,
      num(r.cns, 15), pad(r.encounter.number, 15), num(r.procedure, 10), pad(r.cid, 4), pad("", 4),
      ddmmaaaa(r.date), ddmmaaaa(out), num(r.exitReason || (r.encounter.discharge ? "11" : "00"), 2), "06", num(competence, 6),
    ].join("");
  });
  return [header, ...lines].join("\r\n") + "\r\n";
}
