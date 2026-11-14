import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { loadEmployeeAccess } from "@/lib/employee-access";
import { employeeHead } from "@/lib/employee-rules";
export const Route = createFileRoute("/pendente")({ head: () => employeeHead("Situação do cadastro", "Acompanhe a aprovação do seu cadastro profissional no hospital."), component: Pending });
function Pending() {
  const [status, setStatus] = useState("pending"); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); setError(""); try { const access = await loadEmployeeAccess(); setStatus(access?.profile.status ?? "signed_out"); } catch { setError("Não foi possível verificar a liberação."); } finally { setBusy(false); } };
  useEffect(() => { void check(); }, []);
  return <main className="mx-auto max-w-lg px-4 py-20"><Clock className="mb-4 h-10 w-10 text-clinical" /><h1 className="text-2xl font-semibold">{status === "approved" ? "Cadastro liberado" : status === "blocked" ? "Acesso não liberado" : "Cadastro aguardando liberação"}</h1><p className="my-4 text-sm text-muted-foreground">{status === "blocked" ? "Procure a administração do hospital." : status === "approved" ? "Seu acesso ao hospital está disponível." : "Confirme seu e-mail e aguarde a aprovação de um administrador."}</p>{error && <p role="alert">{error}</p>}<div className="flex flex-wrap gap-2">{status === "approved" ? <Button asChild><Link to="/">Entrar no sistema</Link></Button> : <Button onClick={check} disabled={busy}><RefreshCw />Verificar liberação</Button>}<Button variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.assign("/auth"); }}>Sair</Button></div></main>;
}