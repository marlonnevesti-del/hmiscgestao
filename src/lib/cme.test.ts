import { describe, expect, it } from "vitest";
import { DEFAULT_KITS, checkKitUse, findKit, kitBarcode, setBio, startCycle } from "./cme";

const at = "2026-11-17T13:30:00.000Z";
describe("CME", () => {
  it("ciclo aprovado deixa caixa pronta com validade de 30 dias", () => {
    const r = startCycle(DEFAULT_KITS, [], { autoclave: "Autoclave 01", load: "Instrumental", temperature: 134, minutes: 15, chemical: "Aprovado", kitIds: ["CX-CES-01"] }, "Enf", at);
    const k = r.kits.find((x) => x.id === "CX-CES-01")!;
    expect(r.cycle.number).toBe("0001/2026");
    expect(k.status).toBe("Pronto");
    expect(k.expiresAt?.slice(0, 10)).toBe("2026-12-17");
    expect(kitBarcode(k, r.cycle)).toBe("CME-00012026-CXCES01");
    expect(findKit(r.kits, [r.cycle], "CME-00012026-CXCES01")?.id).toBe("CX-CES-01");
  });
  it("biológico reprovado bloqueia a caixa e impede o uso", () => {
    const r = startCycle(DEFAULT_KITS, [], { autoclave: "Autoclave 01", load: "", temperature: 134, minutes: 15, chemical: "Aprovado", kitIds: ["CX-CES-01"] }, "Enf", at);
    const kits = setBio(r.kits, r.cycle, "Reprovado", "Enf", at);
    expect(kits.find((x) => x.id === "CX-CES-01")!.status).toBe("Bloqueado");
  });
  it("caixa vencida não pode ser usada", () => {
    const r = startCycle(DEFAULT_KITS, [], { autoclave: "A", load: "", temperature: 134, minutes: 15, chemical: "Aprovado", kitIds: ["CX-CES-01"] }, "Enf", at);
    expect(checkKitUse(r.kits[0], r.cycle, "2027-01-01T00:00:00.000Z")).toMatch(/VENCIDA/);
    expect(checkKitUse(r.kits[0], r.cycle, "2026-11-20T00:00:00.000Z")).toBeNull();
  });
});
