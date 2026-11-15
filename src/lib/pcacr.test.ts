import { describe, it, expect } from "vitest";
import { sugerirCorPCACR } from "./pcacr";

describe("PCACR", () => {
  it("usa o descritor mais grave assinalado", () => {
    expect(sugerirCorPCACR("ob-vitalidade", ["amarelo:Diminuição de movimentos fetais", "laranja:BCF < 110 ou > 160 bpm"])).toEqual({ cor: "laranja", tempoMax: 15 });
  });
  it("sem descritores não sugere cor", () => {
    expect(sugerirCorPCACR("ad-dor-toracica", [])).toBeNull();
  });
});
