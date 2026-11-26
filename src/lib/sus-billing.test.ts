import { describe, expect, it } from "vitest";
import { CNES, aihFile, bpaFile, competenceOf, susIssues, type SusRow } from "./sus-billing";

const prof = { name: "Dr", cns: "123456789012345", cbo: "225125" };
const good = { cns: "700000000000001", cid: "O800", birthDate: "1990-01-01", sex: "F", cityCode: "354870", motherName: "Maria", kind: "BPA" as const };

describe("faturamento SUS", () => {
  it("usa o CNES HMISC 2594277 nas remessas BPA e AIH", () => {
    expect(CNES).toBe("2594277");
    const row: SusRow = { encounter: { id: "e", number: "BAA-1", patientId: "p", status_fluxo: "ALTA_HOSPITALAR", openedAt: "2026-11-10T10:00:00Z", type: "Maternidade", specialty: "Obstetrícia", complaint: "Avaliação", history: [] }, date: "2026-11-10", cpf: "", name: "Ana", procedure: "0301060061", ...good, issues: [], aihNumber: "4226100012345", aihAuthorizedAt: "2026-11-10", exitReason: "12", births: [] };
    expect(bpaFile([row], "202611", prof).split("\r\n")[1]?.slice(2, 9)).toBe("2594277");
    expect(aihFile([{ ...row, kind: "AIH" }], "202611", prof).slice(30, 37)).toBe("2594277");
  });
  it("competência AAAAMM", () => expect(competenceOf("2026-11-17T10:00:00Z")).toBe("202611"));
  it("sem CNS do paciente é pendência", () => expect(susIssues({ ...good, cns: "" }, prof)).toContain("Paciente sem CNS (15 dígitos)"));
  it("profissional sem CBO é pendência", () => expect(susIssues(good, { ...prof, cbo: "" })).toContain("Profissional sem CBO"));
  it("glosa: CID obstétrico em paciente masculino", () => expect(susIssues({ ...good, sex: "M" }, prof)).toContain("Procedimento/CID obstétrico em paciente masculino"));
  it("glosa: CID perinatal após 28 dias", () => expect(susIssues({ ...good, cid: "P599", birthDate: "2026-01-01", date: "2026-03-01" }, prof)).toContain("CID perinatal (P) fora do período neonatal (28 dias)"));
  it("CID perinatal dentro de 28 dias é aceito", () => expect(susIssues({ ...good, cid: "P599", birthDate: "2026-03-01", date: "2026-03-20" }, prof)).toEqual([]));
  it("registro completo não tem pendência", () => expect(susIssues(good, prof)).toEqual([]));
  it("AIH exige nome da mãe", () => expect(susIssues({ ...good, kind: "AIH", motherName: "" }, prof)).toContain("Sem nome da mãe"));
  it("BPA exporta só linhas sem pendência", () => {
    const base = { encounter: { number: "BAA-1" }, patient: undefined, date: "2026-11-10", cpf: "", name: "Ana", procedure: "0301060061", ...good };
    const rows = [{ ...base, issues: [] }, { ...base, issues: ["x"] }] as never;
    expect(bpaFile(rows, "202611", prof).trim().split("\r\n")).toHaveLength(2);
  });
});

import { buildSusRows } from "./sus-billing";
describe("código IBGE", () => {
  it("usa o código da naturalidade quando o endereço não tem", () => {
    const e = { id: "e", patientId: "p", openedAt: "2026-11-10T10:00:00Z", status_fluxo: "ALTA_HOSPITALAR", history: [] } as never;
    const p = { id: "p", name: "Ana", registration: { birthplaceCode: "4204608", addresses: [{ primary: true, cityCode: "" }] } } as never;
    expect(buildSusRows([e], [p], "202611", { name: "", cns: "", cbo: "" })[0]?.cityCode).toBe("4204608");
  });
});

import { pickProcedure } from "./sus-billing";
describe("pickProcedure", () => {
  it("usa o código do laudo de AIH na internação", () => expect(pickProcedure({ aihLaudo: { codigo: "04.11.01.003-4" } } as never, "AIH")).toBe("0411010034"));
  it("usa o procedimento registrado no BPA", () => expect(pickProcedure({ sigtapCode: "0401010023" } as never, "BPA")).toBe("0401010023"));
  it("cai no padrão sem código", () => expect(pickProcedure({} as never, "BPA")).toBe("0301060061"));
});

import { cihaFile, cihaFileName } from "./sus-billing";
describe("CIHA-01", () => {
  it("nome do arquivo segue CNES+AAAAMM.CHA", () => { expect(cihaFileName("202611")).toBe("2594277202611.CHA"); });
  it("sem movimento gera header e registro tipo 3", () => { expect(cihaFile([], "202611")).toBe("125942771.0.0.0\r\n3\r\n"); });
});

import { aihIssues } from "./sus-billing";
describe("campos oficiais da AIH", () => {
  const base = { aihNumber: "4226100012345", aihAuthorizedAt: "2026-11-02", exitReason: "12", births: [], date: "2026-11-01" };
  it("completa não tem pendência", () => expect(aihIssues(base)).toEqual([]));
  it("nº da AIH exige 13 dígitos", () => expect(aihIssues({ ...base, aihNumber: "123" })).toContain("Sem nº da AIH autorizada (13 dígitos)"));
  it("exige motivo de saída", () => expect(aihIssues({ ...base, exitReason: "" })).toContain("Sem motivo de saída SUS"));
  it("motivo de parto exige RN", () => expect(aihIssues({ ...base, exitReason: "61" })).toContain("Motivo de parto sem RN vinculado"));
  it("RN vivo exige DNV", () => expect(aihIssues({ ...base, exitReason: "61", births: [{ rnId: "r", name: "RN", dnv: "", weight: 3100, weeks: "39", alive: true }] })).toContain("RN: sem nº da DNV"));
});

import { maternalCodeByDuration, examsWithoutReport } from "./sus-billing";
describe("regras HMISC BPA", () => {
  const base = { openedAt: "2026-11-01T10:00:00Z", history: [] } as never as Parameters<typeof maternalCodeByDuration>[0];
  it("materno até 4h usa 0301060061", () => expect(maternalCodeByDuration({ ...base, baaClosedAt: "2026-11-01T14:00:00Z" })).toBe("0301060061"));
  it("materno acima de 4h usa 0301060029", () => expect(maternalCodeByDuration({ ...base, baaClosedAt: "2026-11-01T14:01:00Z" })).toBe("0301060029"));
  it("exame realizado sem laudo é pendência", () => expect(examsWithoutReport({ examRequests: [{ status: "Realizado", exams: "Hemograma" }, { status: "Laudado", exams: "RX", report: "ok" }] } as never)).toHaveLength(1));
});

import { DEFAULT_INSTITUTION } from "./institution";
describe("dados institucionais nas remessas SUS", () => {
  it("pré-carrega CNES 2594277, CNPJ 47.708.771/0026-50 e Diretor Clínico com CNS 708006369271128", () => {
    expect(DEFAULT_INSTITUTION.razaoSocial).toBe("IRMANDADE DA SANTA CASA DE MISERICORDIA DE SAO BERNARDO DO CAMPO");
    expect(DEFAULT_INSTITUTION.cnes).toBe("2594277");
    expect(DEFAULT_INSTITUTION.cnpj).toBe("47.708.771/0026-50");
    expect(DEFAULT_INSTITUTION.esferaGestao).toBe("E");
    expect(DEFAULT_INSTITUTION.diretorClinico.nome).toBe("MANOEL ROBSON DAMIN MONTEIRO");
    expect(DEFAULT_INSTITUTION.diretorClinico.cns).toBe("708006369271128");
  });
  it("cabeçalho BPA usa CNPJ (14 dígitos), esfera Estadual e órgão gestor configurados", () => {
    const header = bpaFile([], "202611", { name: "Dr", cns: "708006369271128", cbo: "225125" }, DEFAULT_INSTITUTION).split("\r\n")[0] ?? "";
    expect(header).toContain("IRMANDADE DA SANTA CASA DE MIS");
    expect(header).toContain("47708771002650");
    expect(header).toContain("SECRETARIA DE ESTADO DA SAUDE DE SANTA C");
    expect(header).toContain("EHMISC 1.0");
  });
  it("arquivo SISAIH01 segue layout de 1800 colunas com CNES nas posições 31-37 e município nas posições 38-43", () => {
    const row = {
      encounter: { id: "e1", number: "FIA-2026-9002" }, patientId: "p1", name: "FERNANDA COSTA", cns: "700003334445552",
      birthDate: "1994-09-12", sex: "F", motherName: "ROSA COSTA", cityCode: "420460", date: "2026-11-05",
      kind: "AIH", procedure: "0310010039", cid: "O800", aihNumber: "4226100123456", aihAuthorizedAt: "2026-11-05",
      exitReason: "61", births: [{ rnId: "r1", name: "RN", dnv: "98765432101", weight: 3280, weeks: "39", alive: true }], issues: [],
    } as never;
    const line = aihFile([row], "202611", { name: "Dr", cns: "708006369271128", cbo: "225125" }, DEFAULT_INSTITUTION).split("\r\n")[0] ?? "";
    expect(line).toHaveLength(1800);
    expect(line.slice(11, 17)).toBe("202611");
    expect(line.slice(30, 37)).toBe("2594277");
    expect(line.slice(37, 43)).toBe("420460");
    expect(line.slice(43, 56)).toBe("4226100123456");
    expect(line.slice(56, 60)).toBe("0102");
  });
});
