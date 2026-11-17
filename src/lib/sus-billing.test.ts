import { describe, expect, it } from "vitest";
import { bpaFile, competenceOf, susIssues } from "./sus-billing";

const prof = { name: "Dr", cns: "123456789012345", cbo: "225125" };
const good = { cns: "700000000000001", cid: "O800", birthDate: "1990-01-01", sex: "F", cityCode: "354870", motherName: "Maria", kind: "BPA" as const };

describe("faturamento SUS", () => {
  it("competência AAAAMM", () => expect(competenceOf("2026-11-17T10:00:00Z")).toBe("202611"));
  it("sem CNS do paciente é pendência", () => expect(susIssues({ ...good, cns: "" }, prof)).toContain("Paciente sem CNS (15 dígitos)"));
  it("profissional sem CBO é pendência", () => expect(susIssues(good, { ...prof, cbo: "" })).toContain("Profissional sem CBO"));
  it("registro completo não tem pendência", () => expect(susIssues(good, prof)).toEqual([]));
  it("AIH exige nome da mãe", () => expect(susIssues({ ...good, kind: "AIH", motherName: "" }, prof)).toContain("Sem nome da mãe"));
  it("BPA exporta só linhas sem pendência", () => {
    const base = { encounter: { number: "BAA-1" }, patient: undefined, date: "2026-11-10", cpf: "", name: "Ana", procedure: "0301060061", ...good };
    const rows = [{ ...base, issues: [] }, { ...base, issues: ["x"] }] as never;
    expect(bpaFile(rows, "202611", prof).trim().split("\r\n")).toHaveLength(2);
  });
});
