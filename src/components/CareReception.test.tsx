import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Patient } from "@/lib/hospital-data";
import { getState, setState } from "@/lib/hospital-store";
import { registrationFor } from "@/lib/patient-registration-mapping";
import { CareReception } from "./CareReception";

vi.mock("./AppShell", () => ({ NoPermission: () => null }));
const initial = getState();
const patient: Patient = {
  id: "cpf-test", prontuario: "PR-CPF", name: "Paciente CPF", cpf: "12345678901",
  type: "pediatria", age: "8", weight: 25, allergies: [], risks: [],
  motherName: "Mãe CPF", guardian: "Responsável CPF", insurance: "SUS", authorized: true,
  diagnosis: "", ward: "PSP", bed: "", admission: "", days: 1, evolutions: [], vitals: [], prescriptions: [],
};
patient.registration = { ...registrationFor(patient), cpf: patient.cpf, birthDate: "2018-01-01", cns: "700000000000005" };
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  setState(() => ({ profile: "Recepção", accessAreas: null, patients: [patient], encounters: [] }));
});
afterEach(() => { cleanup(); setState(() => initial); vi.unstubAllGlobals(); });

it("digitar CPF completo recupera os dados existentes sem gravar ou abrir atendimento", () => {
  render(<CareReception />);
  fireEvent.change(screen.getByRole("textbox", { name: "CPF" }), { target: { value: "123.456.789-01" } });
  expect(screen.getByRole("textbox", { name: "Nome civil" })).toHaveValue("Paciente CPF");
  expect(screen.getByRole("textbox", { name: "Cartão de saúde (CNS)" })).toHaveValue("700000000000005");
  expect(getState().patients).toEqual([patient]);
  expect(getState().encounters).toEqual([]);
});

it("trocar o CPF selecionado não mantém os dados do paciente anterior", () => {
  render(<CareReception />);
  const cpf = screen.getByRole("textbox", { name: "CPF" });
  fireEvent.change(cpf, { target: { value: patient.cpf } });
  fireEvent.change(cpf, { target: { value: "98765432100" } });
  expect(screen.getByRole("textbox", { name: "Nome civil" })).toHaveValue("");
  expect(screen.getByRole("textbox", { name: "Cartão de saúde (CNS)" })).toHaveValue("");
  expect(getState().patients).toEqual([patient]);
});

it("CPF duplicado não seleciona automaticamente um dos pacientes", () => {
  setState(() => ({ patients: [patient, { ...patient, id: "cpf-other", name: "Outro" }] }));
  render(<CareReception />);
  fireEvent.change(screen.getByRole("textbox", { name: "CPF" }), { target: { value: patient.cpf } });
  expect(screen.getByRole("textbox", { name: "Nome civil" })).toHaveValue("");
  expect(getState().patients).toHaveLength(2);
});