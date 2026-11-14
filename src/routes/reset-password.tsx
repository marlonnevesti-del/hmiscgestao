import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { employeeHead } from "@/lib/employee-rules";
export const Route = createFileRoute("/reset-password")({ head: () => employeeHead("Nova senha", "Defina uma nova senha de acesso ao HMISC usando o link de recuperação."), component: Reset });
function Reset() {
  const [recovery, setRecovery] = useState(false); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { setRecovery(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" || sessionStorage.getItem("hmisc-recovery") === "true"); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!recovery || password !== confirm) { setMessage("Verifique o link de recuperação e a confirmação da senha."); return; } setBusy(true); try { const { error } = await supabase.auth.updateUser({ password }); if (error) { setMessage("Não foi possível alterar a senha. Use uma senha segura ou solicite outro link."); return; } sessionStorage.removeItem("hmisc-recovery"); await supabase.auth.signOut(); window.location.assign("/auth"); } finally { setBusy(false); } };
  return <main className="mx-auto max-w-sm px-4 py-16"><h1 className="mb-6 text-2xl font-semibold">HMISC · Nova senha</h1>{!recovery ? <p>Abra o link de recuperação enviado ao seu e-mail.</p> : <form onSubmit={submit} className="space-y-4"><label className="grid gap-1 text-xs">Nova senha<Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><label className="grid gap-1 text-xs">Confirmar senha<Input type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>{message && <p role="alert" className="text-sm text-destructive">{message}</p>}<Button disabled={busy} type="submit">Salvar nova senha</Button></form>}</main>;
}