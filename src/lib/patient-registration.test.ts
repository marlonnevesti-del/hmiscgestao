import { describe, expect, it } from "vitest";
import { emptyRegistration, patientAge, presentationName, registrationSchema } from "./patient-registration";

describe("cadastro conforme os anexos", () => {
  it("usa o nome social selecionado sem perder o civil", () => {
    const r = { ...emptyRegistration(), civilName: "Nome civil", useSocialName: true, socialName: "Nome social" };
    expect(presentationName(r)).toBe("Nome social");
    expect(registrationSchema.parse(r).civilName).toBe("Nome civil");
  });
  it("usa o nome afetivo quando selecionado", () => expect(presentationName({ ...emptyRegistration(), useAffectiveName: true, affectiveName: "Nome afetivo" })).toBe("Nome afetivo"));
  it("calcula anos, meses e dias pela data de nascimento", () => expect(patientAge({ ...emptyRegistration(), birthDate: "2020-11-16" }, new Date("2026-11-16T12:00:00"))).toBe("6 anos 0 meses 0 dias"));
  it("mantém idade estimada", () => expect(patientAge({ ...emptyRegistration(), estimatedAge: true, ageYears: "8", ageMonths: "2", ageDays: "3" })).toBe("8 anos 2 meses 3 dias"));
  it("permite CNS ausente e rejeita CNS incompleto", () => {
    expect(registrationSchema.safeParse(emptyRegistration()).success).toBe(true);
    expect(registrationSchema.safeParse({ ...emptyRegistration(), cns: "123" }).success).toBe(false);
  });
  it("exige o nome social quando seu uso está marcado", () => expect(registrationSchema.safeParse({ ...emptyRegistration(), useSocialName: true }).success).toBe(false));
  it("guarda múltiplos contatos e dados legados", () => {
    const r = registrationSchema.parse({ ...emptyRegistration(), legacyHospital: "HMISC", legacyRecord: "12345", esusCode: "678", phones: [{ primary: true, type: "Celular", areaCode: "11", number: "999999999", complement: "" }, { primary: false, type: "Residencial", areaCode: "11", number: "33333333", complement: "" }] });
    expect(r.phones).toHaveLength(2); expect(r.legacyRecord).toBe("12345"); expect(r.esusCode).toBe("678");
  });
});