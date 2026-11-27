import { describe, expect, it } from "vitest";
import { guessColumnMap, markDuplicates, normalizeDate, normalizeTime, parseAgendaPdfLines, parseCsvText, previewAgendaGrid, sanitizeProfessional } from "./agenda-import";
import { getState, importAppointments, setState } from "./hospital-store";
import { addSpecialty, DEFAULT_SPECIALTIES } from "./ambulatorio";

describe("importação de agenda do ambulatório", () => {
  it("rejeita linha de paciente como especialidade sem criar pacientes ou horários", () => {
    setState(() => ({ profile: "Recepção", accessAreas: null, patients: [], appointments: [], ambSpecialties: DEFAULT_SPECIALTIES }));
    const item = { date: "2027-01-14", time: "07:30", patientName: "PACIENTE TESTE", cpf: "", cns: "", prontuario: "", specialty: "PACIENTE TESTE 48 AMBULATÓRIO CON SUS/SUS MASTOLOGIA", professional: "PROFISSIONAL TESTE", note: "" };
    expect(() => importAppointments([item])).toThrow("Especialidade contém dados da agenda");
    expect(getState().patients).toHaveLength(0);
    expect(getState().appointments).toHaveLength(0);
    expect(getState().ambSpecialties).toEqual(DEFAULT_SPECIALTIES);
  });

  it("bloqueia cadastro de especialidade contaminada mas preserva especialidades legítimas novas", () => {
    expect(() => addSpecialty(DEFAULT_SPECIALTIES, "PACIENTE TESTE 48 AMBULATÓRIO CON SUS/SUS MASTOLOGIA", "medica")).toThrow("linha de agenda");
    expect(addSpecialty(DEFAULT_SPECIALTIES, "Banco de Leite", "nao_medica").at(-1)?.name).toBe("Banco de Leite");
  });

  it("não trata cabeçalho da agenda ou setor como especialidade", () => {
    const rows = parseAgendaPdfLines(["Especialidade: Mastologia", "Agenda: PACIENTE TESTE 48 AMBULATÓRIO CON SUS/SUS MASTOLOGIA", "Setor: AMBULATÓRIO", "Data: 14/01/2027", "07:30 ANA TESTE"], "salux.pdf");
    expect(rows[0]?.item.specialty).toBe("Mastologia");
    expect(rows[0]?.errors).toEqual([]);
  });
  it("normaliza datas e horários de planilhas", () => {
    expect(normalizeDate("26/11/2026")).toBe("2026-11-26");
    expect(normalizeDate("2026-11-26")).toBe("2026-11-26");
    expect(normalizeTime("8:30")).toBe("08:30");
    expect(normalizeTime(0.5)).toBe("12:00");
  });

  it("lê CSV, mapeia colunas e valida linhas", () => {
    const csv = "Data,Horário,Paciente,CPF,Especialidade,Profissional\n26/11/2026,08:00,Ana Paula,12345678901,Pediatria,Dr. João\n,09:00,Sem Data,,Pediatria,Dr. João";
    const grid = parseCsvText(csv);
    const map = guessColumnMap(grid[0] ?? []);
    const rows = previewAgendaGrid(grid, "agenda.csv", map);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[0]?.item.date).toBe("2026-11-26");
    expect(rows[1]?.errors).toContain("Data inválida");
  });

  it("extrai agendamentos de linhas de PDF", () => {
    const lines = [
      "Especialidade: Pediatria",
      "Médico: DR. JOÃO SANTOS",
      "Agenda do dia 27/11/2026",
      "08:30 MARIA CLARA SOUZA 123.456.789-01",
      "09:00 PEDRO HENRIQUE",
    ];
    const rows = parseAgendaPdfLines(lines, "agenda.pdf");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.item.date).toBe("2026-11-27");
    expect(rows[0]?.item.time).toBe("08:30");
    expect(rows[0]?.item.patientName).toBe("MARIA CLARA SOUZA");
    expect(rows[0]?.item.cpf).toBe("12345678901");
    expect(rows[0]?.item.specialty).toBe("Pediatria");
  });

  it("ignora telefones com hífen e bloqueia números no campo profissional", () => {
    expect(sanitizeProfessional("5468")).toBe("");
    expect(sanitizeProfessional("48 99908-5468")).toBe("");
    expect(sanitizeProfessional("DR. JOÃO SANTOS")).toBe("DR. JOÃO SANTOS");
    const lines = [
      "Recurso: DRA. ANA PAULA",
      "Especialidade: Fisioterapia",
      "Agenda do dia 30/11/2026",
      "08:15 ENZO DE SOUZA DA ROSA (48) 99908-5468",
    ];
    const rows = parseAgendaPdfLines(lines, "salux.pdf");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.item.patientName).toBe("ENZO DE SOUZA DA ROSA");
    expect(rows[0]?.item.professional).toBe("DRA. ANA PAULA");
  });

  it("importa no store criando paciente novo e bloqueando duplicidade", () => {
    setState(() => ({ profile: "Recepção", employeeName: "Recepcionista", patients: [], appointments: [] }));
    const items = [
      { date: "2026-12-10", time: "10:00", patientName: "LUCAS TESTE AGENDA", cpf: "11122233344", cns: "", prontuario: "", specialty: "Pediatria", professional: "DR. TESTE", note: "CONSULTA" },
    ];
    const r1 = importAppointments(items);
    expect(r1.imported).toBe(1);
    expect(r1.createdPatients).toBe(1);

    const dupCheck = markDuplicates(
      [{ source: "t.csv", row: 2, item: items[0]!, errors: [] }],
      getState().appointments,
      getState().patients,
      getState().ambSpecialties,
    );
    expect(dupCheck[0]?.duplicate).toBe(true);

    const r2 = importAppointments(items);
    expect(r2.imported).toBe(0);
    expect(r2.skippedDuplicates).toBe(1);
  });
});