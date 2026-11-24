import { describe, expect, it } from "vitest";
import { bedAgeIssue } from "./nir-rules";

const ref = new Date("2026-11-24T12:00:00");

describe("Validação de idade por leito no NIR", () => {
  it("bloqueia adulto de 37 anos na UTIPED", () => {
    const msg = bedAgeIssue({ birthDate: "1989-05-18", age: "37 anos 6 meses 6 dias" }, "UTIPED-01", "UTI PED", ref);
    expect(msg).toContain("37 anos");
    expect(msg).toContain("14 anos");
  });

  it("aceita criança de 14 anos na UTIPED", () => {
    expect(bedAgeIssue({ birthDate: "2012-01-01" }, "UTIPED-01", "UTI PED", ref)).toBeNull();
  });

  it("bloqueia adolescente de 15 anos na Enfermaria Pediátrica", () => {
    expect(bedAgeIssue({ birthDate: "2011-01-01" }, "ENFP-01", "Enfermaria Pediátrica", ref)).toContain("15 anos");
  });

  it("bloqueia adulto sem data de nascimento usando idade em texto", () => {
    expect(bedAgeIssue({ age: "28 anos" }, "UTIPED-02", "UTI PED", ref)).toContain("28 anos");
  });

  it("bloqueia criança com mais de 28 dias na UTI Neonatal", () => {
    expect(bedAgeIssue({ birthDate: "2026-09-01" }, "UTIN-01", "UTI Neonatal", ref)).toContain("28 dias");
  });

  it("aceita recém-nascido com 10 dias na UTI Neonatal", () => {
    expect(bedAgeIssue({ birthDate: "2026-11-14" }, "UTIN-01", "UTI Neonatal", ref)).toBeNull();
  });

  it("permite adulto em Alojamento Conjunto / Maternidade", () => {
    expect(bedAgeIssue({ birthDate: "1989-05-18" }, "AC-01", "Alojamento Conjunto", ref)).toBeNull();
  });
});