import { describe, expect, it } from "vitest";
import { doctorsForSpecialty } from "./doctors";
const list = [{ name: "A", specialty: "Ginecologia e Obstetrícia" }, { name: "B", specialty: "Pediatria; Gastroenterologia Pediátrica" }, { name: "C", specialty: "Dermatologia" }];
describe("médicos por especialidade", () => {
  it("Ginecologia traz o ginecologista-obstetra", () => expect(doctorsForSpecialty(list, "Ginecologia").map((d) => d.name)).toEqual(["A"]));
  it("Neonatologia/Pediatria Geral traz o pediatra", () => expect(doctorsForSpecialty(list, "Neonatologia/Pediatria Geral").map((d) => d.name)).toEqual(["B"]));
  it("Gastroenterologia Pediátrica traz só o gastro", () => expect(doctorsForSpecialty(list, "Gastroenterologia Pediátrica").map((d) => d.name)).toEqual(["B"]));
});
