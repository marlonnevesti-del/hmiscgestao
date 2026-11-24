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

describe("merge3 entre computadores", () => {
  it("mantém evolução do médico e sinais da enfermagem no mesmo paciente", async () => {
    const { mergeSnapshots } = await import("./clinical-sync");
    const p = { id: "p1", evolutions: [] as unknown[], vitals: [] as unknown[] };
    const out = mergeSnapshots({ patients: [p] }, { patients: [{ ...p, evolutions: [{ text: "medico" }] }] }, { patients: [{ ...p, vitals: [{ pa: "12x8" }] }] }) as { patients: typeof p[] };
    expect(out.patients[0]?.evolutions).toHaveLength(1);
    expect(out.patients[0]?.vitals).toHaveLength(1);
  });
  it("soma baixas simultâneas de estoque (100 - 5 - 10 = 85)", async () => {
    const { mergeSnapshots } = await import("./clinical-sync");
    const out = mergeSnapshots({ stock: [{ id: "d", qty: 100 }] }, { stock: [{ id: "d", qty: 95 }] }, { stock: [{ id: "d", qty: 90 }] }) as { stock: { qty: number }[] };
    expect(out.stock[0]?.qty).toBe(85);
  });
  it("sequência BAA nunca volta", async () => {
    const { mergeSnapshots } = await import("./clinical-sync");
    const out = mergeSnapshots({ beSequence: 10 }, { beSequence: 12 }, { beSequence: 11 }) as { beSequence: number };
    expect(out.beSequence).toBe(12);
  });
});

describe("campos clínicos não somam", () => {
  it("peso alterado nos dois computadores fica com o deste computador", async () => {
    const { mergeSnapshots } = await import("./clinical-sync");
    const out = mergeSnapshots({ patients: [{ id: "p", weight: 10 }] }, { patients: [{ id: "p", weight: 11 }] }, { patients: [{ id: "p", weight: 12 }] }) as { patients: { weight: number }[] };
    expect(out.patients[0]?.weight).toBe(11);
  });
});

describe("indicador e reenvio manual", () => {
  it("dispara o callback registrado ao acionar reenvio", async () => {
    const { registerSyncRetry, triggerSyncRetry, setSyncStatus } = await import("./sync-status");
    const fn = vi.fn();
    registerSyncRetry(fn);
    setSyncStatus("pending");
    triggerSyncRetry();
    expect(fn).toHaveBeenCalledTimes(1);
    registerSyncRetry(null);
  });
});

describe("proteção contra abas antigas e ressuscitação de testes", () => {
  it("bloqueia ressuscitação de paciente presente em deletedPatientIds", () => {
    const m = mergeSnapshots(
      { patients: [] } as never,
      { patients: [{ id: "rn-3", name: "RN de teste" }, { id: "novo", name: "Queli" }] } as never,
      { patients: [{ id: "novo", name: "Queli" }], deletedPatientIds: ["rn-3"] } as never,
    );
    expect((m.patients as { id: string }[]).map((p) => p.id)).toEqual(["novo"]);
    expect(m.deletedPatientIds).toContain("rn-3");
  });
  it("descarta rascunho local com mais de 10 minutos ou mais de 3 versões de defasagem", async () => {
    const { isPendingStale } = await import("./clinical-sync");
    const now = 1_700_000_000_000;
    expect(isPendingStale(now - 11 * 60 * 1000, 100, 100, now)).toBe(true);
    expect(isPendingStale(now - 60 * 1000, 96, 100, now)).toBe(true);
    expect(isPendingStale(now - 60 * 1000, undefined, 100, now)).toBe(true);
    expect(isPendingStale(now - 60 * 1000, 98, 100, now)).toBe(false);
  });
});
