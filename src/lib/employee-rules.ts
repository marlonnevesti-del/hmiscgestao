import { z } from "zod";
import type { Profile } from "./hospital-data";

export const JOBS = ["Recepcionista", "Médico", "Enfermeiro", "Técnico de enfermagem", "Farmacêutico", "Fisioterapeuta", "Administrativo", "Outro"] as const;
export const needsCouncil = (job: string) => ["Médico", "Enfermeiro", "Técnico de enfermagem", "Farmacêutico", "Fisioterapeuta"].includes(job);
export const employeeSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo").max(150),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, "Usuário inválido"),
  email: z.string().trim().email("E-mail inválido").max(200),
  password: z.string().min(8, "Use pelo menos 8 caracteres").max(128),
  cpf: z.string().trim().regex(/^\d{11}$/, "Informe os 11 dígitos do CPF"),
  phone: z.string().trim().min(10, "Informe o telefone").max(20),
  birth_date: z.string().min(1, "Informe a data de nascimento").max(10),
  address: z.string().trim().min(5, "Informe o endereço").max(300),
  job_function: z.enum(JOBS),
  sector: z.string().trim().min(2, "Selecione o setor").max(80),
  other_function: z.string().trim().max(100).default(""),
  council_type: z.string().trim().max(30), council_number: z.string().trim().max(30), council_state: z.string().trim().max(2),
}).superRefine((v, ctx) => {
  if (v.job_function === "Outro" && !v.other_function) ctx.addIssue({ code: "custom", path: ["other_function"], message: "Informe a função" });
  if (needsCouncil(v.job_function) && (!v.council_type || !v.council_number || v.council_state.length !== 2)) ctx.addIssue({ code: "custom", path: ["council_number"], message: "Informe conselho, número e UF" });
});
export type EmployeeRegistration = z.input<typeof employeeSchema>;
export const employeeFunctionSchema = z.object({ id: z.string().uuid(), job_function: z.enum(JOBS), other_function: z.string().trim().max(100).default("") }).superRefine((v, ctx) => {
  if (v.job_function === "Outro" && !v.other_function) ctx.addIssue({ code: "custom", path: ["other_function"], message: "Informe a função" });
});
// Preview hostnames change; validate the protocol, not a fixed deployment list.
export const employeeRegistrationInputSchema = employeeSchema.and(z.object({
  origin: z.string().url().refine((origin) => {
    try {
      const url = new URL(origin);
      return url.protocol === "https:" || origin === "http://localhost:8080";
    } catch { return false; }
  }, "Origem inválida").transform((origin) => new URL(origin).origin),
}));
export const adminEmployeeCreationSchema = employeeSchema.and(z.object({
  approve_immediately: z.boolean().default(true),
}));
export type AdminEmployeeCreation = z.input<typeof adminEmployeeCreationSchema>;

const PASS_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASS_LOWER = "abcdefghijkmnopqrstuvwxyz";
const PASS_DIGIT = "23456789";
const PASS_SYMBOL = "@#$%&*!?";
const PASS_ALL = PASS_UPPER + PASS_LOWER + PASS_DIGIT + PASS_SYMBOL;

export function generateSecurePassword(length = 12): string {
  const size = Math.max(8, Math.min(32, Math.floor(length)));
  const randomIndex = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] ?? 0) % max;
  };
  const pick = (pool: string) => pool[randomIndex(pool.length)] ?? pool[0]!;
  const chars = [pick(PASS_UPPER), pick(PASS_LOWER), pick(PASS_DIGIT), pick(PASS_SYMBOL)];
  while (chars.length < size) chars.push(pick(PASS_ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join("");
}

export function formatEmployeeAccessSummary(data: { full_name: string; username: string; email: string; password: string }): string {
  return [
    "HMISC · Acesso ao Sistema",
    `Colaborador: ${data.full_name}`,
    `Usuário: ${data.username}`,
    `E-mail: ${data.email}`,
    `Senha inicial: ${data.password}`,
  ].join("\n");
}

export const canApproveEmployees = (roles: readonly string[], status: string) => status === "approved" && roles.some((r) => r === "admin" || r === "super_admin");
export const canCreateAdmins = (roles: readonly string[], status: string) => status === "approved" && roles.includes("super_admin");
export const canRemoveEmployee = (callerRoles: readonly string[], callerStatus: string, callerId: string, targetId: string, targetRoles: readonly string[]) => canApproveEmployees(callerRoles, callerStatus) && callerId !== targetId && !targetRoles.includes('super_admin') && (!targetRoles.includes('admin') || callerRoles.includes('super_admin'));
export function filterEmployees<T extends { status: string; full_name: string; username: string; email: string; job_function: string; sector?: string }>(employees: T[], status: string, query: string) {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  return employees.filter((employee) => (status === "all" || employee.status === status) && [employee.full_name, employee.username, employee.email, employee.job_function, employee.sector ?? ""].some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));
}
export function clinicalProfile(job: string, roles: readonly string[]): Profile {
  if (roles.includes("super_admin") || roles.includes("admin")) return "Administrador";
  if (job === "Recepcionista") return "Recepção";
  if (job === "Médico" || job === "Enfermeiro" || job === "Farmacêutico" || job === "Técnico de enfermagem" || job === "Fisioterapeuta" || job === "Administrativo") return job;
  return "Outro";
}
export function employeeHead(title: string, description: string) {
  return { meta: [{ title: `${title} – HMISC` }, { name: "description", content: description }, { property: "og:title", content: `${title} – HMISC` }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
}