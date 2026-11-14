import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { HeartPulse, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { employeeHead } from "@/lib/employee-rules";
import { loadEmployeeAccess } from "@/lib/employee-access";
import { useServerFn } from "@tanstack/react-start";
import { loginWithUsername, resolveUsernameForReset } from "@/lib/employees.functions";
export const Route = createFileRoute("/auth")({ head: () => employeeHead("Acesso de colaboradores", "Acesso seguro de colaboradores e administradores do hospital materno-infantil."), component: Login });
function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [forgot, setForgot] = useState(false); const navigate = useNavigate(); const login = useServerFn(loginWithUsername); const reset = useServerFn(resolveUsernameForReset);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const username = email.trim();
      if (forgot) { await reset({ data: { username, redirectTo: `${window.location.origin}/reset-password` } }); setMessage("Se o usuário existir, um e-mail para definir a senha foi enviado ao endereço cadastrado."); return; }
      const result = await login({ data: { username, password } });
      if (!result.ok) { setMessage(result.message); return; }
      const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
      if (error) { setMessage("Não foi possível acessar. Tente novamente."); return; }
      const access = await loadEmployeeAccess(); await navigate({ to: access?.profile.status === "approved" ? "/" : "/pendente" });
    } catch { setMessage("Não foi possível acessar. Tente novamente."); } finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8"><div className="w-full max-w-sm"><HeartPulse className="mb-3 h-10 w-10 text-clinical" /><h1 className="text-3xl font-semibold text-primary">HMISC</h1><p className="mb-8 text-sm text-muted-foreground">Hospital Materno-Infantil</p><h2 className="mb-4 text-lg font-semibold">{forgot ? "Definir ou recuperar senha" : "Acesso de colaboradores"}</h2><form onSubmit={submit} className="space-y-4"><label className="grid gap-1 text-xs font-medium">Nome de usuário<Input value={email} required autoComplete="username" onChange={(e) => setEmail(e.target.value)} /></label>{!forgot && <label className="grid gap-1 text-xs font-medium">Senha<Input type="password" value={password} required autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} /></label>}{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button type="submit" className="w-full" disabled={busy}><LogIn />{busy ? "Aguarde…" : forgot ? "Enviar e-mail" : "Entrar"}</Button></form><Button variant="link" className="mt-2 px-0" onClick={() => { setForgot(!forgot); setMessage(""); }}>{forgot ? "Voltar para o acesso" : "Definir ou recuperar senha"}</Button><div className="mt-6 border-t pt-5"><Button variant="outline" asChild className="w-full"><Link to="/cadastro-colaborador">Cadastrar-me como colaborador</Link></Button></div></div></main>;
}