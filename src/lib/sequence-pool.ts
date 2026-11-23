import { supabase } from "@/integrations/supabase/client";

// Números de BAA/FIA reservados no servidor (contador atômico): dois computadores nunca recebem o mesmo.
type Kind = "baa" | "fia";
const pool: Record<Kind, number | null> = { baa: null, fia: null };
const busy: Record<Kind, boolean> = { baa: false, fia: false };

export async function refillSequence(kind: Kind, min = 0) {
  if (pool[kind] != null || busy[kind]) return;
  busy[kind] = true;
  try {
    const { data, error } = await supabase.rpc("next_clinical_number", { _kind: kind, _min: min });
    if (!error && typeof data === "number") pool[kind] = data;
  } finally { busy[kind] = false; }
}

/** Usa o número reservado (ou o local como reserva) e já pede o próximo. */
export function takeSequence(kind: Kind, localNext: number): number {
  const n = pool[kind];
  pool[kind] = null;
  void refillSequence(kind, Math.max(n ?? 0, localNext));
  return n != null && n >= localNext ? n : localNext;
}
