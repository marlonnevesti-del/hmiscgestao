import { describe, expect, it } from "vitest";
import { pendingCounts } from "./dashboard";
const enc = (type: string, status: string) => ({ type, status_fluxo: status }) as never;
describe("pendingCounts", () => {
  it("counts open encounters per unit and ignores discharged", () => {
    const c = pendingCounts([enc("Ambulatório", "AGUARDANDO_TRIAGEM"), enc("Ambulatório", "ALTA_HOSPITALAR"), enc("Pronto socorro", "AGUARDANDO_FARMACIA")], []);
    expect(c["/ambulatorio"]).toBe(1); expect(c["/pronto-socorro"]).toBe(1); expect(c["/farmacia"]).toBe(1); expect(c["triagem"]).toBe(1);
  });
});
