import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { HeartPulse, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { employeeHead } from "@/lib/employee-rules";
import { loadEmployeeAccess } from "@/lib/employee-access";
export const Route = createFileRoute("/auth")({ head: () => employeeHead("Acesso de colaboradores", "Acesso seguro de colaboradores e administradores do hospital materno-infantil."), component: Login });
function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [forgot, setForgot] = useState(false); const navigate = useNavigate();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const address = email.trim().toLowerCase() === "marlonneves" ? "marlonneves.ti@gmail.com" : email.trim();
      if (forgot) { const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/reset-password` }); setMessage(error ? "Não foi possível enviar o e-mail. Tente novamente." : "Se houver uma conta, você receberá um e-mail para definir sua senha."); return; }
      const { error } = await supabase.auth.signInWithPassword({ email: address, password });
      if (error) { setMessage("E-mail ou senha inválidos, ou e-mail ainda não confirmado."); return; }
      const access = await loadEmployeeAccess(); await navigate({ to: access?.profile.status === "approved" ? "/" : "/pendente" });
    } catch { setMessage("Não foi possível acessar. Tente novamente."); } finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8"><div className="w-full max-w-sm"><HeartPulse className="mb-3 h-10 w-10 text-clinical" /><h1 className="text-3xl font-semibold text-primary">HMISC</h1><p className="mb-8 text-sm text-muted-foreground">Hospital Materno-Infantil</p><h2 className="mb-4 text-lg font-semibold">{forgot ? "Definir ou recuperar senha" : "Acesso de colaboradores"}</h2><form onSubmit={submit} className="space-y-4"><label className="grid gap-1 text-xs font-medium">E-mail ou Marlonneves<Input value={email} required autoComplete="username" onChange={(e) => setEmail(e.target.value)} /></label>{!forgot && <label className="grid gap-1 text-xs font-medium">Senha<Input type="password" value={password} required autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} /></label>}{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}<Button type="submit" className="w-full" disabled={busy}><LogIn />{busy ? "Aguarde…" : forgot ? "Enviar e-mail" : "Entrar"}</Button></form><Button variant="link" className="mt-2 px-0" onClick={() => { setForgot(!forgot); setMessage(""); }}>{forgot ? "Voltar para o acesso" : "Definir ou recuperar senha"}</Button><div className="mt-6 border-t pt-5"><Button variant="outline" asChild className="w-full"><Link to="/cadastro-colaborador">Cadastrar-me como colaborador</Link></Button></div></div></main>;
}