import { describe, expect, it } from "vitest";
import { SPECIAL_CONDITIONS, specialConditionsText } from "./special-conditions";

describe("condições especiais", () => {
  it("oferece exatamente as cinco opções da ficha", () => {
    expect(SPECIAL_CONDITIONS).toEqual(["Autismo / TEA", "TDAH", "Deficiência intelectual", "Deficiência física", "Outra"]);
  });

  it("mostra o detalhe informado em Outra", () => {
    expect(specialConditionsText(["Autismo / TEA", "Outra"], "Necessita acompanhante")).toEqual(["Autismo / TEA", "Outra: Necessita acompanhante"]);
  });
});
