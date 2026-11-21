import type { Encounter } from "./care-flow";
import type { Patient } from "./hospital-data";

export const CNES = "2077485";
export interface Professional { name: string; cns: string; cbo: string }
export interface SusRow {
  encounter: Encounter; patient?: Patient | undefined; kind: "BPA" | "AIH";
  date: string; cns: string; cpf: string; name: string; birthDate: string; sex: string; motherName: string;
  cityCode: string; cid: string; procedure: string; issues: string[];
}

/** Competência AAAAMM a partir de uma data ISO. */
export const competenceOf = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; };
const digits = (v = "") => v.replace(/\D/g, "");
const wasAdmitted = (e: Encounter) => e.status_fluxo === "ENCAMINHADO_INTERNACAO" || e.history.some((h) => h.status === "ENCAMINHADO_INTERNACAO");

export const SIGTAP_DEFAULT = { BPA: "0301060061", AIH: "0303010037" };

/** Código real do atendimento (laudo AIH ou procedimento registrado); padrão só se nada foi informado. */
export function pickProcedure(e: Encounter, kind: "BPA" | "AIH"): string {
  const aih = digits(e.aihLaudo?.['codigo']), proc = digits(e.sigtapCode);
  const ok = (c: string) => c.length === 10 ? c : "";
  return (kind === "AIH" ? ok(aih) || ok(proc) : ok(proc)) || SIGTAP_DEFAULT[kind];
}

export function buildSusRows(encounters: Encounter[], patients: Patient[], competence: string, prof: Professional): SusRow[] {
  return encounters.filter((e) => competenceOf(e.openedAt) === competence).map((e) => {
    const p = patients.find((x) => x.id === e.patientId);
    const r = p?.registration;
    const kind = wasAdmitted(e) ? "AIH" : "BPA";
    const row: SusRow = {
      encounter: e, patient: p, kind, date: e.openedAt.slice(0, 10),
      cns: digits(r?.cns), cpf: digits(r?.cpf || p?.cpf), name: r?.civilName || p?.name || "",
      birthDate: r?.birthDate ?? "", sex: (r?.sex ?? "").slice(0, 1).toUpperCase(),
      motherName: r?.parent1 || p?.motherName || "", cityCode: digits(r?.addresses?.find((a) => a.primary)?.cityCode || r?.addresses?.find((a) => a.cityCode)?.cityCode || r?.birthplaceCode),
      cid: (e.medical?.cid ?? "").replace(/\W/g, "").toUpperCase(), procedure: pickProcedure(e, kind), issues: [],
    };
    row.issues = susIssues(row, prof);
    return row;
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
  if (digits(prof.cns).length !== 15) out.push("Profissional sem CNS");
  if (digits(prof.cbo).length !== 6) out.push("Profissional sem CBO");
  return out;
}

const pad = (v: string, n: number) => v.slice(0, n).padEnd(n, " ");
const num = (v: string | number, n: number) => String(v).replace(/\D/g, "").slice(-n).padStart(n, "0");
const plain = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

/** Remessa BPA-I (linhas tipo 03) no layout posicional; só exporta linhas sem pendência. */
export function bpaFile(rows: SusRow[], competence: string, prof: Professional): string {
  const ok = rows.filter((r) => r.kind === "BPA" && r.issues.length === 0);
  const header = `01#BPA#${competence}${num(ok.length, 6)}${num(1, 6)}${num(0, 4)}${pad("HMISC", 30)}${pad("HMISC", 6)}${num("", 14)}${pad("SECRETARIA MUNICIPAL DE SAUDE", 40)}M${pad("HMISC 1.0", 10)}`;
  const lines = ok.map((r, i) => [
    "03", num(CNES, 7), competence, num(prof.cns, 15), num(prof.cbo, 6), r.date.replace(/-/g, ""), num(1, 3), num(i + 1, 2),
    num(r.procedure, 10), num(r.cns, 15), r.sex, num(r.cityCode, 6), pad(r.cid, 4), num(ageAt(r.birthDate, r.date), 3), num(1, 6),
    "01", pad(r.encounter.number, 13), "BPA", pad(plain(r.name), 30), r.birthDate.replace(/-/g, ""),
  ].join(""));
  return [header, ...lines].join("\r\n") + "\r\n";
}

/** Remessa de AIH em lote (registro por internação) para conferência/importação no SISAIH01. */
export function aihFile(rows: SusRow[], competence: string, prof: Professional): string {
  return rows.filter((r) => r.kind === "AIH" && r.issues.length === 0).map((r) => [
    num(CNES, 7), competence, pad(r.encounter.number, 13), r.date.replace(/-/g, ""), num(r.procedure, 10), pad(r.cid, 4),
    num(r.cns, 15), pad(plain(r.name), 70), r.birthDate.replace(/-/g, ""), r.sex, pad(plain(r.motherName), 70), num(r.cityCode, 7),
    num(prof.cns, 15), num(prof.cbo, 6),
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
export const cihaFileName = (competence: string) => `${CNES}${competence}.CHA`;
const ddmmaaaa = (iso: string) => { const d = iso.slice(0, 10).split("-"); return d.length === 3 ? `${d[2]}${d[1]}${d[0]}` : "00000000"; };

/**
 * Remessa de importação do CIHA01 (Portarias GM/MS 637/2007 e 1.171/2011).
 * Header tipo 1; internações (FIA) tipo 2; ambulatoriais (BAA) tipo 4; sem movimento tipo 3.
 * Endereço/nascimento/sexo seguem as posições oficiais (2–131); os campos seguintes seguem a ordem da portaria.
 */
export function cihaFile(rows: SusRow[], competence: string): string {
  const ok = rows.filter((r) => r.issues.length === 0);
  const header = `1${num(CNES, 7)}${pad("1.0.0.0", 7)}`;
  if (!ok.length) return [header, "3"].join("\r\n") + "\r\n";
  const lines = ok.map((r) => {
    const a = r.patient?.registration?.addresses?.find((x) => x.primary) ?? r.patient?.registration?.addresses?.[0];
    const street = [a?.streetType, a?.street].filter(Boolean).join(" ");
    const out = r.encounter.discharge?.at || r.encounter.history.at(-1)?.at || r.encounter.openedAt;
    return [
      r.kind === "AIH" ? "2" : "4", pad(plain(r.name), 60), pad(plain(street), 25), pad(plain(a?.number ?? ""), 5), pad(plain(a?.complement ?? ""), 15),
      num(r.cityCode.slice(0, 6), 6), pad(plain(a?.state ?? "SC"), 2), num(a?.postalCode ?? "", 8), ddmmaaaa(r.birthDate), r.sex,
      num(r.cns, 15), pad(r.encounter.number, 15), num(r.procedure, 10), pad(r.cid, 4), pad("", 4),
      ddmmaaaa(r.date), ddmmaaaa(out), r.encounter.discharge ? "11" : "00", "06", num(competence, 6),
    ].join("");
  });
  return [header, ...lines].join("\r\n") + "\r\n";
}
