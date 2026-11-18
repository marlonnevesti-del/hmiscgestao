import { describe, it, expect } from "vitest";
import { normalizeCity, splitStreet } from "./ibge";
describe("ibge", () => {
  it("normaliza acentos do município", () => expect(normalizeCity("Criciúma")).toBe(normalizeCity("CRICIUMA")));
  it("separa tipo de logradouro", () => expect(splitStreet("Rua Wenceslau Braz")).toEqual({ streetType: "Rua", street: "Wenceslau Braz" }));
});
