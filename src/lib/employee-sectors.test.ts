import { describe, expect, it } from "vitest";
import { areasForSector, DEFAULT_EMPLOYEE_SECTORS, hasOnlyKnownAreas, isKnownSector, mergeEmployeeSectors, withSectorAreas } from "./employee-sectors";

describe("setores de colaboradores", () => {
  it("contém os 41 setores enviados pelo hospital", () => {
    expect(DEFAULT_EMPLOYEE_SECTORS).toHaveLength(41);
    expect(DEFAULT_EMPLOYEE_SECTORS).toContain("Engenharia Clínica");
    expect(DEFAULT_EMPLOYEE_SECTORS).toContain("UTI Neo");
    expect(DEFAULT_EMPLOYEE_SECTORS).toContain("UTI Ped");
  });
  it("acrescenta setores novos sem duplicar nomes com acentos ou maiúsculas diferentes", () => {
    expect(mergeEmployeeSectors(["nutricao", "Epidemiologia"])).toEqual(expect.arrayContaining(["Nutrição", "Epidemiologia"]));
    expect(mergeEmployeeSectors(["nutricao", "Epidemiologia"])).toHaveLength(42);
  });
  it("reconhece setores existentes sem diferenciar acentos", () => {
    expect(isKnownSector("Nutricao", [])).toBe(true);
    expect(isKnownSector("Setor inexistente", [])).toBe(false);
  });
  it("farmácia libera a farmácia sem liberar atendimento médico", () => {
    expect(areasForSector("Farmácia")).toEqual(["farmacia"]);
    expect(areasForSector("Farmácia")).not.toContain("atendimento");
  });
  it("recepção da maternidade libera a recepção correspondente", () => {
    expect(areasForSector("Recep Mat")).toEqual(["recepcao", "maternidade:recepcao"]);
  });
  it("setor soma acessos sem remover os escolhidos pelo administrador", () => {
    expect(withSectorAreas(["faturamento"], "Farmácia")).toEqual(["faturamento", "farmacia"]);
  });
  it("setor novo usa os acessos escolhidos pelo administrador", () => {
    expect(areasForSector("Epidemiologia", [{ name: "Epidemiologia", access_areas: ["sciras"] }])).toEqual(["sciras"]);
  });
  it("Direção e T.I. não recebem administração automaticamente", () => {
    expect(areasForSector("Direção")).toEqual([]);
    expect(areasForSector("T.I.")).toEqual([]);
  });
  it("recusa identificadores de acesso desconhecidos", () => {
    expect(hasOnlyKnownAreas(["farmacia", "ambulatorio:agenda"])).toBe(true);
    expect(hasOnlyKnownAreas(["administrador"])).toBe(false);
  });
});
