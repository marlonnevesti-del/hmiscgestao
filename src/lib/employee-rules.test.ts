import { describe, expect, it } from "vitest";
import { canApproveEmployees, canCreateAdmins, canRemoveEmployee, clinicalProfile, employeeSchema, needsCouncil, filterEmployees } from "./employee-rules";
import { can } from "./hospital-data";
describe("acesso de colaboradores", () => {
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
  it("recepcionista pode se cadastrar sem conselho", () => expect(employeeSchema.safeParse({ full_name: "Colaborador Teste", username: "colaborador", email: "teste@example.com", password: "Example-test!42", cpf: "12345678901", phone: "11999999999", birth_date: "1990-01-01", address: "Rua de Teste 10", job_function: "Recepcionista", council_type: "", council_number: "", council_state: "" }).success).toBe(true));
  it("profissional de saúde precisa de conselho", () => expect(employeeSchema.safeParse({ full_name: "Colaborador Teste", username: "colaborador", email: "teste@example.com", password: "Example-test!42", cpf: "12345678901", phone: "11999999999", birth_date: "1990-01-01", address: "Rua de Teste 10", job_function: "Médico", council_type: "", council_number: "", council_state: "" }).success).toBe(false));
  it("apenas administradores liberam colaboradores", () => { expect(canApproveEmployees(["employee"], "approved")).toBe(false); expect(canApproveEmployees(["admin"], "approved")).toBe(true); });
  it("administrador pendente não pode liberar", () => expect(canApproveEmployees(["admin"], "pending")).toBe(false));
  it("só o administrador principal cadastra outros adms", () => { expect(canCreateAdmins(["admin"], "approved")).toBe(false); expect(canCreateAdmins(["super_admin"], "approved")).toBe(true); });
  it("administrador tem todas as ações hospitalares", () => { for (const action of ["prescrever", "evoluir", "parto", "checar", "triagem", "farmacia", "faturar", "cirurgia"] as const) expect(can("Administrador", action)).toBe(true); });
  it("função de recepção não recebe prescrição", () => expect(can(clinicalProfile("Recepcionista", ["employee"]), "prescrever")).toBe(false));
});