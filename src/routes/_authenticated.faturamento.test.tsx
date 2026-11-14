import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Patient } from "@/lib/hospital-data";
import { getState, setState } from "@/lib/hospital-store";
import { Route } from "./_authenticated.faturamento";

vi.mock("@/components/AppShell", () => ({ NoPermission: () => null }));

const Billing = Route.options.component;
const initialState = getState();
const patient: Patient = {
  id: "billing-regression", prontuario: "1", name: "Paciente teste", cpf: "",
  type: "puerpera", age: "30", weight: 60, allergies: [], risks: [],
  ward: "AC", bed: "AC-01", insurance: "SUS", authorized: true,
  diagnosis: "", admission: "", days: 2, evolutions: [], vitals: [], prescriptions: [],
};

afterEach(() => { cleanup(); setState(() => initialState); });

describe("faturamento sem seleção disponível", () => {
  it("abre com zero pacientes sem acessar um paciente inexistente", () => {
    setState(() => ({ patients: [], surgeries: [], admins: {} }));
    if (!Billing) throw new Error("Tela de faturamento não definida");
    expect(() => render(<Billing />)).not.toThrow();
  });

  it("acompanha a chegada e remoção de pacientes sem invalidar a seleção", () => {
    setState(() => ({ patients: [], surgeries: [], admins: {} }));
    if (!Billing) throw new Error("Tela de faturamento não definida");
    render(<Billing />);
    expect(() => act(() => setState(() => ({ patients: [patient] })))).not.toThrow();
    expect(() => act(() => setState(() => ({ patients: [{ ...patient, id: "replacement" }] })))).not.toThrow();
    expect(() => act(() => setState(() => ({ patients: [] })))).not.toThrow();
  });
});