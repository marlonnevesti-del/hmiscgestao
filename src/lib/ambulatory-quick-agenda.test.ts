import { beforeEach, describe, expect, it } from "vitest";
import { getState, quickScheduleAppointment, setState } from "./hospital-store";

describe("quickScheduleAppointment", () => {
  beforeEach(() => {
    setState(() => ({ profile: "Recepção", accessAreas: null }));
  });

  it("pre-registers a new patient with basic fields and schedules the appointment", () => {
    const spec = getState().ambSpecialties[0]!;
    const beforePatients = getState().patients.length;
    const res = quickScheduleAppointment(
      { name: "Maria Clara Silva", birthDate: "2020-05-10", motherOrGuardian: "Ana Silva", phone: "11988887777", cpf: "123.456.789-01" },
      { date: "2026-12-01", time: "09:30", specialtyId: spec.id, professional: "Dr. João", note: "Primeira vez", nursingPreConsult: false },
    );
    expect(res.reused).toBe(false);
    expect(getState().patients.length).toBe(beforePatients + 1);
    expect(res.patient.name).toBe("MARIA CLARA SILVA");
    expect(res.patient.cpf).toBe("12345678901");
    expect(res.patient.motherName).toBe("Ana Silva");
    expect(res.patient.registration?.phones[0]?.areaCode).toBe("11");
    expect(res.patient.registration?.phones[0]?.number).toBe("988887777");
    expect(res.appointment.patientId).toBe(res.patient.id);
    expect(res.appointment.status).toBe("agendado");
  });

  it("reuses an existing patient when CPF matches and avoids creating duplicates", () => {
    const spec = getState().ambSpecialties[0]!;
    const first = quickScheduleAppointment(
      { name: "Lucas Mendes", phone: "21977776666", cpf: "99988877766" },
      { date: "2026-12-02", time: "10:00", specialtyId: spec.id, professional: "Dra. Paula", note: "", nursingPreConsult: false },
    );
    const countAfterFirst = getState().patients.length;
    const second = quickScheduleAppointment(
      { name: "Lucas Mendes", cpf: "999.888.777-66" },
      { date: "2026-12-03", time: "11:00", specialtyId: spec.id, professional: "Dra. Paula", note: "Retorno", nursingPreConsult: false },
    );
    expect(second.reused).toBe(true);
    expect(second.patient.id).toBe(first.patient.id);
    expect(getState().patients.length).toBe(countAfterFirst);
  });

  it("rejects missing name or occupied slot without creating an orphan patient", () => {
    const spec = getState().ambSpecialties[0]!;
    const before = getState().patients.length;
    expect(() => quickScheduleAppointment(
      { name: "   " },
      { date: "2026-12-04", time: "08:00", specialtyId: spec.id, professional: "Dr. Carlos", note: "", nursingPreConsult: false },
    )).toThrow("Informe o nome completo do paciente.");

    quickScheduleAppointment(
      { name: "Paciente Um" },
      { date: "2026-12-04", time: "08:00", specialtyId: spec.id, professional: "Dr. Carlos", note: "", nursingPreConsult: false },
    );
    const afterOne = getState().patients.length;
    expect(afterOne).toBe(before + 1);

    expect(() => quickScheduleAppointment(
      { name: "Paciente Dois" },
      { date: "2026-12-04", time: "08:00", specialtyId: spec.id, professional: "Dr. Carlos", note: "", nursingPreConsult: false },
    )).toThrow("Horário já ocupado para este profissional.");
    expect(getState().patients.length).toBe(afterOne);
  });
});