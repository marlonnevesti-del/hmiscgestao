import { describe, expect, it } from "vitest";
import { inCareBy } from "./hospital-store";
import type { Encounter } from "./care-flow";
const enc = (status: string, by: string) => ({ status_fluxo: status, history: [{ status: "AGUARDANDO_MEDICO", at: "", by: "Recepção" }, { status, at: "", by }] }) as unknown as Encounter;
describe("semáforo de atendimento", () => {
  it("mostra quem está atendendo", () => expect(inCareBy(enc("EM_ATENDIMENTO_MEDICO", "Dr. Paulo"))).toBe("Dr. Paulo"));
  it("libera quando não está em consulta", () => expect(inCareBy(enc("AGUARDANDO_MEDICO", "Dr. Paulo"))).toBeNull());
});
