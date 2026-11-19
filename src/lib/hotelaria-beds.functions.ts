import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { hotelariaSnapshotSchema, normalizeHotelaria, isHotelariaFresh, sortHotelaria, type HotelariaResult } from "./hotelaria-beds";

export const readHotelariaBeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HotelariaResult> => {
    const { data: profile, error } = await context.supabase.from("profiles").select("status").eq("id", context.userId).single();
    if (error || profile?.status !== "approved") throw new Error("Acesso não autorizado.");
    const checkedAt = new Date().toISOString();
    const origin = process.env["HOTELARIA_INTEGRATION_ORIGIN"];
    const token = process.env["HOTELARIA_INTEGRATION_TOKEN"];
    if (!origin || !token) return { status: "not_configured", snapshot: null, checkedAt, message: "Vínculo com a Hotelaria aguardando ativação." };
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid integration origin");
      url.pathname = "/api/public/integracao/leitos";
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(4000), redirect: "manual", cache: "no-store" });
      if (!response.ok) {
        console.error("Hotelaria bed read failed", response.status);
        throw new Error("Integration unavailable");
      }
      const text = await response.text();
      if (text.length > 2000000) throw new Error("Oversized integration response");
      const snapshot = hotelariaSnapshotSchema.parse(normalizeHotelaria(JSON.parse(text)));
      if (!isHotelariaFresh(snapshot.generatedAt)) throw new Error("Stale integration response");
      return { status: "connected", snapshot: sortHotelaria(snapshot), checkedAt, message: "Hotelaria conectada" };
    } catch {
      return { status: "unavailable", snapshot: null, checkedAt, message: "Sem atualização da Hotelaria. Disponibilidade não confirmada." };
    }
  });
// Atomic reservation in Hotelaria: only succeeds when the bed is still "disponivel".
export const reserveHotelariaBed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leitoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; codigo?: string | undefined; message: string }> => {
    const { data: profile, error } = await context.supabase.from("profiles").select("status").eq("id", context.userId).single();
    if (error || profile?.status !== "approved") throw new Error("Acesso não autorizado.");
    const origin = process.env["HOTELARIA_INTEGRATION_ORIGIN"]; const token = process.env["HOTELARIA_INTEGRATION_TOKEN"];
    if (!origin || !token) return { ok: false, message: "Vínculo com a Hotelaria não configurado." };
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:") throw new Error("bad origin");
      url.pathname = "/api/public/integracao/reservar-leito";
      const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ leitoId: data.leitoId }), signal: AbortSignal.timeout(6000), redirect: "manual" });
      const body = await r.json().catch(() => null) as { ok?: boolean; leito?: { codigo?: string; status?: string } } | null;
      if (r.ok && body?.ok) return { ok: true, codigo: body.leito?.codigo, message: "Leito reservado na Hotelaria." };
      if (r.status === 409) return { ok: false, message: `Leito não está mais disponível na Hotelaria${body?.leito?.status ? ` (${body.leito.status})` : ""}.` };
      console.error("Hotelaria reserve failed", r.status);
      return { ok: false, message: "Hotelaria não confirmou a reserva. Tente novamente." };
    } catch {
      return { ok: false, message: "Sem comunicação com a Hotelaria. Reserva não feita." };
    }
  });
// On discharge, ask Hotelaria to move the bed to "aguardando_higienizacao" (cleaning queue).
export const releaseHotelariaBed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ codigo: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { data: profile, error } = await context.supabase.from("profiles").select("status").eq("id", context.userId).single();
    if (error || profile?.status !== "approved") throw new Error("Acesso não autorizado.");
    const origin = process.env["HOTELARIA_INTEGRATION_ORIGIN"]; const token = process.env["HOTELARIA_INTEGRATION_TOKEN"];
    if (!origin || !token) return { ok: false, message: "Vínculo com a Hotelaria não configurado." };
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:") throw new Error("bad origin");
      url.pathname = "/api/public/integracao/liberar-leito";
      const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ codigo: data.codigo }), signal: AbortSignal.timeout(6000), redirect: "manual" });
      if (r.ok) return { ok: true, message: `Leito ${data.codigo} enviado para higienização na Hotelaria.` };
      console.error("Hotelaria release failed", r.status);
      return { ok: false, message: r.status === 404 ? "A Hotelaria ainda não recebe avisos de alta — avise a higienização manualmente." : "Hotelaria não confirmou a liberação do leito." };
    } catch {
      return { ok: false, message: "Sem comunicação com a Hotelaria. Avise a higienização manualmente." };
    }
  });
