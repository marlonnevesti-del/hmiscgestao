import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { employeeRegistrationInputSchema, employeeFunctionSchema } from "./employee-rules";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("username", data.username.trim().replace(/[%_\\]/g, "\\$&")).limit(1);
    if (taken?.length) return { ok: false, message: "Este nome de usuário já está em uso. Escolha outro." };
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
export const updateEmployeeFunction = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => employeeFunctionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_employee_function", { target_id: data.id, new_function: data.job_function === "Outro" ? `Outro: ${data.other_function}` : data.job_function });
    if (error) throw new Error("Não foi possível definir a função deste colaborador");
    return { ok: true };
  });

export const updateEmployeeAreas = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), areas: z.array(z.string().max(40)).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_employee_areas", { target_id: data.id, areas: data.areas });
    if (error) throw new Error("Não foi possível definir as áreas deste colaborador");
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
export const loginWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ username: z.string().trim().min(1).max(50), password: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const fail = { ok: false as const, message: "Usuário ou senha inválidos, ou e-mail ainda não confirmado." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("profiles").select("email").ilike("username", data.username.replace(/[%_\\]/g, "\\$&")).limit(2);
    if (!rows || rows.length !== 1 || !rows[0]?.email) return fail;
    const url = process.env["SUPABASE_URL"]; const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return fail;
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key); return fetch(input, { ...init, headers });
    } } });
    const { data: auth, error } = await client.auth.signInWithPassword({ email: rows[0].email, password: data.password });
    if (error || !auth.session) return fail;
    return { ok: true as const, access_token: auth.session.access_token, refresh_token: auth.session.refresh_token };
  });

export const resolveUsernameForReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ username: z.string().trim().min(1).max(50), redirectTo: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("profiles").select("email").ilike("username", data.username.replace(/[%_\\]/g, "\\$&")).limit(2);
    if (rows?.length === 1 && rows[0]?.email && /^https?:$/.test(new URL(data.redirectTo).protocol)) await supabaseAdmin.auth.resetPasswordForEmail(rows[0].email, { redirectTo: data.redirectTo });
    return { ok: true };
  });

export const adminEmployeeEditSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(3).max(120),
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().toLowerCase().email().max(160),
  cpf: z.string().trim().max(20),
  phone: z.string().trim().max(30),
  birth_date: z.string().trim().max(20),
  address: z.string().trim().max(200),
  council_type: z.string().trim().max(20),
  council_number: z.string().trim().max(30),
  council_state: z.string().trim().max(4),
  resend: z.boolean().optional(),
  origin: z.string().url().optional(),
});

export const adminUpdateEmployee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminEmployeeEditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: principal } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!admin && !principal) return { ok: false, message: "Somente administradores podem corrigir cadastros" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.id);
    if (!principal && (targetRoles ?? []).some((r) => r.role === "super_admin")) return { ok: false, message: "Somente o administrador principal pode alterar este cadastro" };
    const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("username", data.username.replace(/[%_\\]/g, "\\$&")).neq("id", data.id).limit(1);
    if (taken?.length) return { ok: false, message: "Este nome de usuário já está em uso" };
    const { data: current } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (!current?.user) return { ok: false, message: "Colaborador não encontrado" };
    const emailChanged = (current.user.email ?? "").toLowerCase() !== data.email;
    if (emailChanged) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { email: data.email });
      if (error) return { ok: false, message: "Não foi possível alterar o e-mail (talvez já esteja em uso)" };
    }
    const { id, resend, origin, ...fields } = data;
    const { error } = await supabaseAdmin.from("profiles").update(fields).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar o cadastro" };
    let sent = false;
    if (resend && !current.user.email_confirmed_at) {
      const r = await supabaseAdmin.auth.resend({ type: "signup", email: data.email, ...(origin ? { options: { emailRedirectTo: origin } } : {}) });
      sent = !r.error;
    }
    return { ok: true, message: sent ? "Cadastro corrigido e e-mail de confirmação reenviado" : "Cadastro corrigido" };
  });
