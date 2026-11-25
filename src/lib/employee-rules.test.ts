import { describe, expect, it } from "vitest";
import { canApproveEmployees, canCreateAdmins, canRemoveEmployee, clinicalProfile, employeeSchema, employeeRegistrationInputSchema, needsCouncil, filterEmployees } from "./employee-rules";
import { can, canAccessPage } from "./hospital-data";
import { ATTENDANCE_TYPES } from "./care-flow";
describe("acesso de colaboradores", () => {
  const registration = { full_name: "Colaborador Teste", username: "colaborador", email: "teste@example.com", password: "Example-test!42", cpf: "12345678901", phone: "11999999999", birth_date: "1990-01-01", address: "Rua de Teste 10", job_function: "Recepcionista", sector: "Recep Mat", council_type: "", council_number: "", council_state: "" };
  it.each([
    "https://hmiscgestao.lovable.app",
    "https://id-preview--99c05fd0-634e-424c-a006-6c577d58a502.lovable.app",
    "https://hmisc-preview.lovableproject.com",
    "https://outro-preview.lovable.app",
  ])("aceita cadastro na origem HTTPS %s", (origin) => {
    expect(employeeRegistrationInputSchema.parse({ ...registration, origin }).origin).toBe(origin);
  });
  it("mantém suporte ao preview local", () => {
    expect(employeeRegistrationInputSchema.parse({ ...registration, origin: "http://localhost:8080" }).origin).toBe("http://localhost:8080");
  });
  it.each(["javascript:alert(1)", "ftp://example.com", "http://example.com", "não é URL"])("recusa origem insegura %s", (origin) => {
    expect(employeeRegistrationInputSchema.safeParse({ ...registration, origin }).success).toBe(false);
  });
  it('administradores removem colaboradores', () => expect(canRemoveEmployee(['admin'],'approved','a','b',['employee'])).toBe(true));
  it('somente principal remove administradores', () => { expect(canRemoveEmployee(['admin'],'approved','a','b',['admin'])).toBe(false); expect(canRemoveEmployee(['super_admin'],'approved','a','b',['admin'])).toBe(true); });
  it('protege o administrador principal', () => expect(canRemoveEmployee(['super_admin'],'approved','a','b',['super_admin'])).toBe(false));
  it('impede remoção da própria conta', () => expect(canRemoveEmployee(['super_admin'],'approved','a','a',['admin'])).toBe(false));
  it('colaborador não remove acessos', () => expect(canRemoveEmployee(['employee'],'approved','a','b',['employee'])).toBe(false));
  it("mostra cadastro pendente sem depender da confirmação do e-mail", () => {
    const pending = { status: "pending", full_name: "Colaborador Pendente", username: "pendente", email: "pendente@example.com", job_function: "Recepcionista" };
    expect(filterEmployees([pending, { ...pending, status: "approved" }], "pending", "")).toEqual([pending]);
  });
  it("ignora espaços nas buscas de colaboradores", () => {
    const pending = { status: "pending", full_name: "Colaborador Pendente", username: "pendente", email: "pendente@example.com", job_function: "Recepcionista" };
    expect(filterEmployees([pending], "pending", "  PENDENTE  ")).toEqual([pending]);
  });
  it("recepcionista não exige conselho", () => expect(needsCouncil("Recepcionista")).toBe(false));
  it("recepcionista pode se cadastrar sem conselho", () => expect(employeeSchema.safeParse({ full_name: "Colaborador Teste", username: "colaborador", email: "teste@example.com", password: "Example-test!42", cpf: "12345678901", phone: "11999999999", birth_date: "1990-01-01", address: "Rua de Teste 10", job_function: "Recepcionista", sector: "Recep Mat", council_type: "", council_number: "", council_state: "" }).success).toBe(true));
  it("profissional de saúde precisa de conselho", () => expect(employeeSchema.safeParse({ full_name: "Colaborador Teste", username: "colaborador", email: "teste@example.com", password: "Example-test!42", cpf: "12345678901", phone: "11999999999", birth_date: "1990-01-01", address: "Rua de Teste 10", job_function: "Médico", sector: "Ambulatório", council_type: "", council_number: "", council_state: "" }).success).toBe(false));
  it("apenas administradores liberam colaboradores", () => { expect(canApproveEmployees(["employee"], "approved")).toBe(false); expect(canApproveEmployees(["admin"], "approved")).toBe(true); });
  it("administrador pendente não pode liberar", () => expect(canApproveEmployees(["admin"], "pending")).toBe(false));
  it("só o administrador principal cadastra outros adms", () => { expect(canCreateAdmins(["admin"], "approved")).toBe(false); expect(canCreateAdmins(["super_admin"], "approved")).toBe(true); });
  it("administrador tem todas as ações hospitalares", () => { for (const action of ["prescrever", "evoluir", "parto", "checar", "triagem", "farmacia", "faturar", "cirurgia"] as const) expect(can("Administrador", action)).toBe(true); });
  it("função de recepção não recebe prescrição", () => expect(can(clinicalProfile("Recepcionista", ["employee"]), "prescrever")).toBe(false));
  it("recepção tem somente as três opções solicitadas", () => expect(ATTENDANCE_TYPES).toEqual(["Maternidade", "Pronto socorro", "Ambulatório"]));
  it("recepção abre cadastros mas não acessa áreas clínicas nem faturamento", () => {
    const profile = clinicalProfile("Recepcionista", ["employee"]);
    expect(canAccessPage(profile, "/recepcao")).toBe(true);
    for (const path of ["/atendimento", "/acolhimento", "/farmacia", "/enfermagem", "/colaboradores", "/faturamento", "/pacientes/123"]) expect(canAccessPage(profile, path)).toBe(false);
  });
  it("médico não recebe acesso de recepção ou farmácia", () => {
    expect(canAccessPage(clinicalProfile("Médico", ["employee"]), "/atendimento")).toBe(true);
    expect(canAccessPage(clinicalProfile("Médico", ["employee"]), "/recepcao")).toBe(false);
    expect(canAccessPage(clinicalProfile("Médico", ["employee"]), "/farmacia")).toBe(false);
  });
  it("farmacêutico recebe somente a área da farmácia", () => {
    expect(canAccessPage(clinicalProfile("Farmacêutico", ["employee"]), "/farmacia")).toBe(true);
    expect(canAccessPage(clinicalProfile("Farmacêutico", ["employee"]), "/atendimento")).toBe(false);
  });
  it("técnico não herda classificação de risco do enfermeiro", () => {
    expect(can(clinicalProfile("Técnico de enfermagem", ["employee"]), "checar")).toBe(true);
    expect(can(clinicalProfile("Técnico de enfermagem", ["employee"]), "triagem")).toBe(false);
  });
  it("administrativo recebe faturamento sem prescrição", () => {
    expect(canAccessPage(clinicalProfile("Administrativo", ["employee"]), "/faturamento")).toBe(true);
    expect(can(clinicalProfile("Administrativo", ["employee"]), "prescrever")).toBe(false);
  });
  it("principal mantém acesso a todas as áreas independentemente da função", () => {
    const profile = clinicalProfile("Recepcionista", ["super_admin"]);
    for (const path of ["/recepcao", "/acolhimento", "/atendimento", "/farmacia", "/enfermagem", "/colaboradores"]) expect(canAccessPage(profile, path)).toBe(true);
  });
});
import { canAccessPage as pageAccess, canAccessUnitTab as unitTab, defaultAreas } from "./hospital-data";
describe("áreas liberadas pelo administrador", () => {
  it("restringe às áreas escolhidas", () => {
    expect(pageAccess("Enfermeiro", "/acolhimento", ["acolhimento", "enfermagem"])).toBe(true);
    expect(pageAccess("Enfermeiro", "/atendimento", ["acolhimento", "enfermagem"])).toBe(false);
    expect(pageAccess("Médico", "/pacientes/1", ["atendimento", "pacientes"])).toBe(true);
    expect(pageAccess("Recepção", "/farmacia", ["recepcao"])).toBe(false);
  });
  it("sugere recepção para recepcionista", () => { expect(defaultAreas("Recepção")).toEqual(["recepcao", "ambulatorio:agenda", "ambulatorio:recepcao", "ambulatorio:especialidades", "pronto-socorro:recepcao", "pronto-socorro:internados", "maternidade:recepcao", "maternidade:internados"]); });
  it("médico liberado só no atendimento do PS vê só essa aba", () => { const a = ["pronto-socorro:atendimento"]; expect(unitTab("Médico", "pronto-socorro", "atendimento", a)).toBe(true); expect(unitTab("Médico", "pronto-socorro", "recepcao", a)).toBe(false); expect(pageAccess("Médico", "/pronto-socorro", a)).toBe(true); expect(pageAccess("Médico", "/ambulatorio", a)).toBe(false); });
});
