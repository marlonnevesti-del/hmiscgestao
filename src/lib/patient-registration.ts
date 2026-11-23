import { z } from "zod";

const text = z.string().trim().max(200, "Use no máximo 200 caracteres.");
const date = text.refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v) <= new Date()), "Informe uma data válida, não futura.");
const digits = (length: number, label: string) => text.refine((v) => !v || v.replace(/\D/g, "").length === length, `${label} deve ter ${length} dígitos.`);
export const addressSchema = z.object({
  primary: z.boolean(), type: text, postalCode: digits(8, "CEP"), streetType: text, street: text,
  number: text, complement: text, neighborhood: text, state: text, cityCode: text, city: text,
  country: text, company: text, situation: text, shift: text,
});
export const phoneSchema = z.object({ primary: z.boolean(), type: text, areaCode: text.refine(v => !v || /^\d{2,3}$/.test(v), "DDD inválido."), number: text.refine(v => !v || /^\d{8,9}$/.test(v.replace(/\D/g, "")), "Telefone inválido."), complement: text });
export const emailSchema = z.object({ primary: z.boolean(), email: z.string().trim().max(254).refine(v => !v || z.string().email().safeParse(v).success, "E-mail inválido.") });
export const registrationSchema = z.object({
  civilName: text.min(1, "Informe o nome civil."), useSocialName: z.boolean(), socialName: text,
  useAffectiveName: z.boolean(), affectiveName: text, birthDate: date, estimatedAge: z.boolean(),
  ageYears: text.regex(/^\d{0,3}$/, "Idade inválida."), ageMonths: text.refine(v => !v || (/^\d+$/.test(v) && Number(v) <= 11), "Meses devem estar entre 0 e 11."),
  ageDays: text.refine(v => !v || (/^\d+$/.test(v) && Number(v) <= 30), "Dias devem estar entre 0 e 30."),
  bloodType: text, rhFactor: text, weight: text.refine(v => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), "Peso inválido."),
  height: text.refine(v => !v || (Number.isFinite(Number(v)) && Number(v) >= 0), "Altura inválida."),
  sex: text, transgender: z.boolean(), unknownIdentity: z.boolean(), unknownNumber: text,
  insurance: text, insuranceCategory: text, insuranceCard: text, cns: digits(15, "CNS"), nationality: text,
  countryEntryDate: date, maritalStatus: text, education: text, spouse: text, parent1: text, parent2: text,
  skinColor: text, ethnicity: text, cpf: digits(11, "CPF"), identityDocument: text, birthCertificate: text,
  religion: text, homeless: z.boolean(), observation1: z.string().trim().max(2000), observation2: z.string().trim().max(2000),
  birthplaceState: text, birthplaceCode: text, birthplace: text, inpatientArchive: text, outpatientArchive: text, enrollment: text,
  profession: text, occupationCode: text, occupation: text, originState: text, originCityCode: text, originCity: text,
  pis: digits(11, "PIS/PASEP"), passport: text, rne: text, guardian: text, guardianRelationship: text,
  guardianAreaCode: text, guardianPhone: text, attendsSchool: z.boolean(), communicationBarrier: text,
  legacyHospital: text, legacyRecord: text, esusCode: text,
  addresses: z.array(addressSchema).max(20), phones: z.array(phoneSchema).max(20), emails: z.array(emailSchema).max(20),
  createdBy: text, createdAt: text, updatedBy: text, updatedAt: text,
}).superRefine((data, ctx) => {
  if (data.useSocialName && !data.socialName) ctx.addIssue({ code: "custom", path: ["socialName"], message: "Informe o nome social." });
  if (data.useAffectiveName && !data.affectiveName) ctx.addIssue({ code: "custom", path: ["affectiveName"], message: "Informe o nome afetivo." });
});
export type PatientRegistration = z.infer<typeof registrationSchema>;
export type PatientAddress = z.infer<typeof addressSchema>;
export const emptyAddress = (): PatientAddress => ({ primary: true, type: "Residencial", postalCode: "", streetType: "", street: "", number: "", complement: "", neighborhood: "", state: "", cityCode: "", city: "", country: "Brasil", company: "", situation: "", shift: "" });
export function emptyRegistration(): PatientRegistration {
  const strings = Object.fromEntries([
    "civilName socialName affectiveName birthDate ageYears ageMonths ageDays bloodType rhFactor weight height sex unknownNumber insuranceCategory insuranceCard cns countryEntryDate maritalStatus education spouse parent1 parent2 skinColor ethnicity cpf identityDocument birthCertificate religion observation1 observation2 birthplaceState birthplaceCode birthplace inpatientArchive outpatientArchive enrollment profession occupationCode occupation originState originCityCode originCity pis passport rne guardian guardianRelationship guardianAreaCode guardianPhone communicationBarrier legacyHospital legacyRecord esusCode createdBy createdAt updatedBy updatedAt"
  ].flatMap(line => line.split(" ")).map(key => [key, ""]));
  return registrationSchema.parse({ ...strings, civilName: "Novo paciente", insurance: "SUS", nationality: "Brasil", useSocialName: false, useAffectiveName: false, estimatedAge: false, transgender: false, unknownIdentity: false, homeless: false, attendsSchool: false, addresses: [emptyAddress()], phones: [{ primary: true, type: "Celular", areaCode: "", number: "", complement: "" }], emails: [{ primary: true, email: "" }] });
}
export function presentationName(data: PatientRegistration) {
  return (data.useSocialName ? data.socialName : data.useAffectiveName ? data.affectiveName : data.civilName).trim();
}
export function patientAge(data: PatientRegistration, today = new Date()) {
  if (data.birthDate && !data.estimatedAge) {
    const birth = new Date(`${data.birthDate}T12:00:00`);
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();
    if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    return `${years} anos ${months} meses ${days} dias`;
  }
  return [data.ageYears && `${data.ageYears} anos`, data.ageMonths && `${data.ageMonths} meses`, data.ageDays && `${data.ageDays} dias`].filter(Boolean).join(" ") || "—";
}
export type RegistrationMode = "completo" | "simplificado";
/** Required (blue) fields of each registration form. */
export function registrationIssues(r: PatientRegistration, mode: RegistrationMode): string[] {
  const issues: string[] = [];
  const blank = (v: string) => !v.trim();
  if (blank(r.sex)) issues.push("Informe o sexo.");
  if (blank(r.civilName) && !r.unknownIdentity) issues.push("Informe o nome civil ou marque paciente desconhecido.");
  if (mode === "simplificado") return issues;
  if (blank(r.birthDate) && !(r.estimatedAge && (r.ageYears || r.ageMonths || r.ageDays))) issues.push("Informe a data de nascimento ou a idade estimada.");
  if (blank(r.parent1)) issues.push("Informe o nome da filiação 1 (mãe, quando elegível).");
  if (blank(r.skinColor)) issues.push("Informe a cor (pele).");
  if (blank(r.birthplaceState) || blank(r.birthplace)) issues.push("Informe a naturalidade (UF e cidade).");
  return issues;
}
/** RN (neonato) só até 28 dias de vida; nunca data futura. */
export function newbornBirthIssue(birthDate: string, today = new Date()): string | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`); const ref = new Date(today); ref.setHours(12, 0, 0, 0);
  if (Number.isNaN(birth.getTime())) return "Data de nascimento inválida.";
  const days = Math.round((ref.getTime() - birth.getTime()) / 86400000);
  if (days < 0) return "Data de nascimento no futuro.";
  if (days > 28) return "Data incompatível com Recém-Nascido (limite de 28 dias). Corrija a data ou altere para Pediátrico.";
  return null;
}
export const PEDIATRIC_MAX_AGE = 14;
export const PEDIATRIC_EXCEPTION_REASONS = [
  "Seguimento de doença crônica / acompanhamento no HMISC",
  "Deficiência neuropsicomotora grave / paralisia cerebral",
  "Determinação judicial / liminar",
  "Autorizado pela Direção Técnica / Coordenação Médica",
  "Outro motivo clínico",
] as const;
/** Idade em anos completos na data de referência. */
export function ageYears(birthDate: string, today = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T12:00:00`); if (Number.isNaN(b.getTime())) return null;
  let y = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) y--;
  return y;
}
/** Pediatria aceita até 14 anos, 11 meses e 29 dias; acima exige exceção justificada. */
export function pediatricAgeIssue(birthDate: string, exception: { reason: string; note: string } | null, today = new Date()): string | null {
  const y = ageYears(birthDate, today);
  if (y === null || y <= PEDIATRIC_MAX_AGE) return null;
  if (!exception) return `Paciente com ${y} anos excede o limite padrão da Pediatria (14 anos). Marque "Admissão pediátrica excepcional" e informe o motivo.`;
  if (!exception.reason) return "Selecione o motivo da admissão pediátrica excepcional.";
  if (exception.reason === "Outro motivo clínico" && !exception.note.trim()) return "Descreva a justificativa do outro motivo clínico.";
  return null;
}
/** Name used for unidentified emergency patients. */
export const unknownPatientName = (n: string) => `DESCONHECIDO Nº ${n || "S/N"}`;
