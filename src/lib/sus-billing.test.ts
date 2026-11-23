import { describe, expect, it } from "vitest";
import { bpaFile, competenceOf, susIssues } from "./sus-billing";

const prof = { name: "Dr", cns: "123456789012345", cbo: "225125" };
const good = { cns: "700000000000001", cid: "O800", birthDate: "1990-01-01", sex: "F", cityCode: "354870", motherName: "Maria", kind: "BPA" as const };

describe("faturamento SUS", () => {
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
  it("nome do arquivo segue CNES+AAAAMM.CHA", () => { expect(cihaFileName("202611")).toBe("2077485202611.CHA"); });
  it("sem movimento gera header e registro tipo 3", () => { expect(cihaFile([], "202611")).toBe("120774851.0.0.0\r\n3\r\n"); });
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
