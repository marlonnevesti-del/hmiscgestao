import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hotelariaSnapshotSchema, isHotelariaFresh, sortHotelaria, type HotelariaResult } from "./hotelaria-beds";

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
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(4000), redirect: "error", cache: "no-store" });
      if (!response.ok) {
        console.error("Hotelaria bed read failed", response.status);
        throw new Error("Integration unavailable");
      }
      const text = await response.text();
      if (text.length > 2000000) throw new Error("Oversized integration response");
      const snapshot = hotelariaSnapshotSchema.parse(JSON.parse(text));
      if (!isHotelariaFresh(snapshot.generatedAt)) throw new Error("Stale integration response");
      return { status: "connected", snapshot: sortHotelaria(snapshot), checkedAt, message: "Hotelaria conectada" };
    } catch {
      return { status: "unavailable", snapshot: null, checkedAt, message: "Sem atualização da Hotelaria. Disponibilidade não confirmada." };
    }
  });