import { describe, it, expect } from "vitest";
import { UNIT_AREAS, canAccessUnitTab } from "./hospital-data";

const psTabs = () => UNIT_AREAS.find((u) => u.id === "pronto-socorro")!.tabs.map((t) => t.id);

describe("fila única de atendimento do Pronto-Socorro", () => {
  it("não tem mais a aba 'Aguardando consulta'", () => {
    expect(psTabs()).not.toContain("aguardando");
    expect(psTabs()).toContain("atendimento");
  });
  it("enfermagem da porta mantém acesso à aba única sem poder prescrever", () => {
    expect(canAccessUnitTab("Enfermeiro", "pronto-socorro", "atendimento")).toBe(true);
    expect(canAccessUnitTab("Técnico de enfermagem", "pronto-socorro", "atendimento")).toBe(true);
    expect(canAccessUnitTab("Recepção", "pronto-socorro", "atendimento")).toBe(false);
  });
  it("liberação antiga 'pronto-socorro:aguardando' vale para a aba única", () => {
    expect(canAccessUnitTab("Recepção", "pronto-socorro", "atendimento", ["pronto-socorro:aguardando"])).toBe(true);
    expect(canAccessUnitTab("Recepção", "pronto-socorro", "atendimento", ["pronto-socorro:recepcao"])).toBe(false);
  });
  it("ambulatório continua exigindo prescrição para a aba de atendimento", () => {
    expect(canAccessUnitTab("Enfermeiro", "ambulatorio", "atendimento")).toBe(false);
    expect(canAccessUnitTab("Médico", "ambulatorio", "atendimento")).toBe(true);
  });
});
