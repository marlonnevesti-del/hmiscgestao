import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { employeeRegistrationInputSchema } from "./employee-rules";

export const registerEmployee = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => employeeRegistrationInputSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Cadastro temporariamente indisponível");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key); return fetch(input, { ...init, headers });
    } } });
    const { password, other_function, origin, ...fields } = data;
    const { error } = await client.auth.signUp({ email: data.email, password, options: { data: { ...fields, job_function: data.job_function === "Outro" ? other_function : data.job_function }, emailRedirectTo: origin } });
    if (error) return { ok: false, message: error.code === "weak_password" ? "Escolha uma senha mais segura, com letras, números e símbolos." : "Não foi possível cadastrar. Verifique os dados ou tente novamente mais tarde." };
    return { ok: true, message: "Cadastro recebido. Confirme seu e-mail e aguarde a liberação por um administrador." };
  });

export const listEmployees = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: principal } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!admin && !principal) throw new Error("Somente administradores podem consultar colaboradores");
  const { data, error } = await context.supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error("Não foi possível consultar colaboradores");
  const { data: roles, error: rolesError } = await context.supabase.from("user_roles").select("user_id,role");
  if (rolesError) throw new Error("Não foi possível consultar permissões");
  return (data ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
});

export const reviewEmployee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["approved", "blocked"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("review_employee", { target_id: data.id, new_status: data.status });
    if (error) throw new Error("Não foi possível alterar o acesso deste colaborador");
    return { ok: true };
  });

export const removeEmployee = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('remove_employee_access', { target_id: data.id });
    if (error) throw new Error('Não foi possível remover este acesso. A conta principal e sua própria conta são protegidas.');
    return { ok: true };
  });

export const createAdministrator = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ full_name: z.string().trim().min(3).max(150), email: z.string().email().max(200), username: z.string().min(3).max(50), password: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!allowed) throw new Error("Somente o administrador principal pode cadastrar administradores");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { full_name: data.full_name, username: data.username, job_function: "Administrador" } });
    if (error || !created.user) return { ok: false, message: "Não foi possível criar a conta. Verifique se o e-mail já está cadastrado e escolha uma senha segura." };
    const { error: grantError } = await context.supabase.rpc("grant_administrator", { target_id: created.user.id });
    if (grantError) { await supabaseAdmin.auth.admin.deleteUser(created.user.id); throw new Error("Não foi possível conceder o acesso administrativo"); }
    return { ok: true, message: "Administrador cadastrado e liberado" };
  });