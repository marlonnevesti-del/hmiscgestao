import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { mergeSnapshots } from "./clinical-sync";

describe("mesclagem entre computadores", () => {
  it("cadastro feito em outro computador não some quando este salva", () => {
    const base = { patients: [{ id: "a" }], beSequence: 17 };
    const local = { patients: [{ id: "a", name: "editado" }], beSequence: 17 };
    const remote = { patients: [{ id: "a" }, { id: "maria" }], beSequence: 18 };
    const m = mergeSnapshots(base as never, local as never, remote as never);
    expect((m.patients as { id: string }[]).map((p) => p.id).sort()).toEqual(["a", "maria"]);
    expect((m.patients as { id: string; name?: string }[]).find((p) => p.id === "a")?.name).toBe("editado");
    expect(m.beSequence).toBe(18);
  });
  it("os dois computadores cadastram ao mesmo tempo e ambos ficam", () => {
    const m = mergeSnapshots({ patients: [] } as never, { patients: [{ id: "x" }] } as never, { patients: [{ id: "y" }] } as never);
    expect((m.patients as { id: string }[]).length).toBe(2);
  });
});
