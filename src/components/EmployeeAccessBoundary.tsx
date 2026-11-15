import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadEmployeeAccess } from "@/lib/employee-access";
import { Button } from "@/components/ui/button";
import { AppShell } from "./AppShell";
import { useClinicalSync } from "@/lib/clinical-sync";
import { canAccessPage } from "@/lib/hospital-data";
import { clinicalProfile } from "@/lib/employee-rules";

function ClinicalSync() { useClinicalSync(); return null; }

export function EmployeeAccessBoundary({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter(); const queryClient = useQueryClient(); const [ready, setReady] = useState(false);
  const publicPage = ["/auth", "/cadastro-colaborador", "/pendente", "/reset-password"].includes(path);
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery") { sessionStorage.setItem("hmisc-recovery", "true"); if (window.location.pathname !== "/reset-password") window.location.replace(`/reset-password${window.location.hash}`); }
    setReady(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") { sessionStorage.setItem("hmisc-recovery", "true"); void router.navigate({ to: "/reset-password" }); return; }
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      if (event === "SIGNED_OUT") { queryClient.setQueryData(["employee-access"], null); queryClient.removeQueries({ queryKey: ["employees"] }); }
      else void queryClient.invalidateQueries();
      void router.invalidate();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  const { data: access, isLoading, error, refetch } = useQuery({ queryKey: ["employee-access"], queryFn: loadEmployeeAccess, enabled: ready && !publicPage, refetchInterval: 15000, retry: false });
  if (publicPage) return children;
  if (!ready || isLoading) return <div className="p-8 text-sm text-muted-foreground">Verificando acesso…</div>;
  if (error) return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">Não foi possível verificar seu acesso</h1><Button className="mt-4" onClick={() => void refetch()}>Tentar novamente</Button></main>;
  if (access?.profile.status !== "approved") return <main className="mx-auto max-w-lg px-4 py-20"><h1 className="text-3xl font-semibold text-primary">HMISC</h1><h2 className="my-4 text-lg">{access ? "Cadastro aguardando liberação" : "Acesso de colaboradores"}</h2><div className="flex flex-wrap gap-2"><Button asChild><Link to={access ? "/pendente" : "/auth"}>{access ? "Ver situação do cadastro" : "Entrar"}</Link></Button>{!access && <Button variant="outline" asChild><Link to="/cadastro-colaborador">Cadastrar-me</Link></Button>}</div></main>;
  const permitted = canAccessPage(clinicalProfile(access.profile.job_function, access.roles), path);
  if (path === "/painel-tv" && permitted) return <><ClinicalSync />{children}</>;
  return <AppShell><ClinicalSync />{permitted ? children : <main className="space-y-4"><h1 className="text-xl font-semibold">Área não liberada para sua função</h1><Button asChild><Link to="/">Voltar ao painel</Link></Button></main>}</AppShell>;
}