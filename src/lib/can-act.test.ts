import { describe, expect, it } from "vitest";
import { canAct } from "./hospital-data";
describe("áreas liberadas pelo admin", () => {
  it("farmacêutico com recepção liberada pode cadastrar", () => expect(canAct("Farmacêutico", "recepcao", ["farmacia", "pronto-socorro:recepcao"])).toBe(true));
  it("farmacêutico sem recepção liberada não cadastra", () => expect(canAct("Farmacêutico", "recepcao", ["farmacia"])).toBe(false));
});
