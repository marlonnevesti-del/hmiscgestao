import { describe, expect, it } from "vitest";
import { defaultEvoCat, needsCatConfirm } from "./evolution-category";
describe("categoria de evolução", () => {
  it("fisioterapeuta abre em Fisioterapia", () => expect(defaultEvoCat("Fisioterapeuta")).toBe("Fisioterapia"));
  it("técnico abre em Enfermagem", () => expect(defaultEvoCat("Técnico de enfermagem")).toBe("Enfermagem"));
  it("assistente social abre em Serviço Social", () => expect(defaultEvoCat("Outro", "Outro: Assistente Social")).toBe("Serviço Social"));
  it("médico abre em Médica", () => expect(defaultEvoCat("Médico")).toBe("Médica"));
  it("trocar para outra categoria pede confirmação", () => { expect(needsCatConfirm("Fisioterapia", "Médica")).toBe(true); expect(needsCatConfirm("Fisioterapia", "Fisioterapia")).toBe(false); });
});
