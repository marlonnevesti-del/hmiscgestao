import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Activity, Ambulance, Baby, Stethoscope, Package, BedDouble, Bell, ChevronLeft, ClipboardList, HeartPulse, Pill, Receipt, Scissors, Search, ShieldCheck, ShieldAlert, Tv, UserCog, UserPlus, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { loadEmployeeAccess } from "@/lib/employee-access";
import { canApproveEmployees } from "@/lib/employee-rules";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canAccessPage, canAccessUnitTab, can, PHARMACY_TABS, WAREHOUSE_TABS, UNIT_AREAS } from "@/lib/hospital-data";
import { professionalName, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";
import { PharmacyCallAlert } from "./PharmacyCallAlert";

const GROUPS = [
  { label: "Assistência", items: [
    { to: "/ambulatorio", label: "Ambulatório", icon: Stethoscope },
    { to: "/pronto-socorro", label: "Pronto Socorro", icon: Ambulance },
    { to: "/maternidade", label: "Maternidade", icon: Baby },
    { to: "/pacientes", label: "Pacientes / PEP", icon: Users },
    { to: "/painel-tv", label: "Painel de Chamadas (TV)", icon: Tv },
  ] },
  { label: "Apoio", items: [
    { to: "/nir", label: "NIR – Regulação de Leitos", icon: BedDouble },
    { to: "/centro-cirurgico", label: "Centro Cirúrgico", icon: Scissors },
    { to: "/gestao-cirurgica", label: "SRPA · CO · Indicadores", icon: Activity },
    { to: "/cme", label: "CME – Esterilização", icon: ShieldCheck },
    { to: "/sciras", label: "SCIRAS / CCIH", icon: ShieldAlert },
    { to: "/farmacia", label: "Farmácia", icon: Pill },
    { to: "/enfermagem", label: "Posto de Enfermagem", icon: HeartPulse },
    { to: "/almoxarifado", label: "Almoxarifado", icon: Package },
    { to: "/solicitacao-almoxarifado", label: "Solicitação ao Almoxarifado", icon: ClipboardList },
  ] },
  { label: "Administrativo", items: [{ to: "/faturamento", label: "Faturamento TISS", icon: Receipt }, { to: "/faturamento-sus", label: "Faturamento SUS", icon: Receipt }] },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const patients = useStore((s) => s.patients);
  const profile = useStore((s) => s.profile);
  const accessAreas = useStore((s) => s.accessAreas);
  const { data: access } = useQuery({ queryKey: ["employee-access"], queryFn: loadEmployeeAccess });
  const queue = useStore((s) => s.queue);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const aba = useRouterState({ select: (s) => (s.location.search as { aba?: string }).aba });
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return patients.filter((p) => [p.name, p.cpf, p.prontuario, p.motherName ?? ""].some((f) => f.toLowerCase().includes(t))).slice(0, 6);
  }, [q, patients]);
  const alerts = useMemo(() => [
    ...queue.filter((x) => x.risk === "vermelho").map((x) => ({ text: `Emergência na fila: ${x.name} – ${x.complaint}`, to: "/acolhimento" as const })),
    ...patients.filter((p) => p.vitals.at(-1) && (p.vitals.at(-1)?.sat ?? 100) < 92).map((p) => ({ text: `SatO2 ${(p.vitals.at(-1)?.sat ?? 100)}% – ${p.name} (${p.bed})`, id: p.id })),
    ...patients.filter((p) => p.vitals.at(-1) && (p.vitals.at(-1)?.pas ?? 0) >= 140).map((p) => ({ text: `PA ${(p.vitals.at(-1)?.pas ?? 0)}/${(p.vitals.at(-1)?.pad ?? 0)} – ${p.name}`, id: p.id })),
    ...patients.filter((p) => p.prescriptions.some((r) => r.pharmacy === "Pendente")).map((p) => ({ text: `Medicação aguardando farmácia – ${p.name}`, to: "/farmacia" as const })),
    ...(can(profile, "sciras") || accessAreas?.includes("sciras") ? patients.filter((p) => p.prescriptions.some((r) => r.atb?.status === "Aguardando SCIRAS")).map((p) => ({ text: `Antimicrobiano aguardando SCIRAS – ${p.name}`, to: "/sciras" as const })) : []),
  ], [queue, patients, profile, accessAreas]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {can(profile, "farmacia") && <PharmacyCallAlert />}
      <aside className={cn("sticky top-0 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all print:hidden", collapsed ? "w-16" : "w-60")}>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <HeartPulse className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!collapsed && <div className="leading-tight"><div className="text-sm font-semibold text-sidebar-accent-foreground">HMI Gestão</div><div className="text-[10px] uppercase tracking-wider opacity-70">Materno-Infantil</div></div>}
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto p-2">
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              {!collapsed && <div className="px-3 text-[10px] uppercase tracking-wider opacity-60">{g.label}</div>}
              {g.items.filter((n) => canAccessPage(profile, n.to, accessAreas)).map((n) => {
                const active = path.startsWith(n.to);
                return (
                  <div key={n.to}><Link to={n.to} title={n.label} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent")}>
                    <n.icon className="h-4 w-4 shrink-0" />{!collapsed && n.label}
                  </Link>
                  {active && !collapsed && (() => { if (n.to === "/farmacia") { const cur = PHARMACY_TABS.find((t) => t.id === aba)?.id ?? "fila"; return <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">{PHARMACY_TABS.map((t, i) => <Link key={t.id} to="/farmacia" search={{ aba: t.id }} className={cn("block rounded px-2 py-1 text-xs", cur === t.id ? "bg-sidebar-accent font-semibold" : "opacity-80 hover:bg-sidebar-accent")}>{i + 1}. {t.label}</Link>)}</div>; } if (n.to === "/almoxarifado") { const cur = WAREHOUSE_TABS.find((t) => t.id === aba)?.id ?? "pedidos"; return <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">{WAREHOUSE_TABS.map((t, i) => <Link key={t.id} to="/almoxarifado" search={{ aba: t.id }} className={cn("block rounded px-2 py-1 text-xs", cur === t.id ? "bg-sidebar-accent font-semibold" : "opacity-80 hover:bg-sidebar-accent")}>{i + 1}. {t.label}</Link>)}</div>; } const u = UNIT_AREAS.find((x) => `/${x.id}` === n.to); if (!u) return null; const tabs = u.tabs.filter((t) => canAccessUnitTab(profile, u.id, t.id, accessAreas)); const cur = tabs.find((t) => t.id === aba)?.id ?? tabs[0]?.id; return <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">{tabs.map((t, i) => <Link key={t.id} to={n.to} search={{ aba: t.id }} className={cn("block rounded px-2 py-1 text-xs", cur === t.id ? "bg-sidebar-accent font-semibold" : "opacity-80 hover:bg-sidebar-accent")}>{i + 1}. {t.label}</Link>)}</div>; })()}</div>
                );
              })}
            </div>
          ))}
          {canApproveEmployees(access?.roles ?? [], access?.profile.status ?? "") && <Link to="/colaboradores" title="Colaboradores" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"><UserCog className="h-4 w-4 shrink-0" />{!collapsed && "Colaboradores"}</Link>}
          {!collapsed && <div className="px-3 pt-2 text-[10px] uppercase tracking-wider opacity-60">Acesso rápido</div>}
          {!collapsed && canAccessPage(profile, "/pacientes", accessAreas) && patients.slice(0, 5).map((p) => (
            <Link key={p.id} to="/pacientes/$id" params={{ id: p.id }} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:bg-sidebar-accent">
              <BedDouble className="h-3.5 w-3.5 opacity-70" /><span className="truncate">{p.bed} · {p.name.split(" ").slice(0, 2).join(" ")}</span>
            </Link>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center gap-2 rounded-md p-2 text-xs hover:bg-sidebar-accent" aria-label="Recolher menu">
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />{!collapsed && "Recolher"}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-2 sm:px-4 print:hidden">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: nome, CPF, prontuário ou nome da mãe" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            {canAccessPage(profile, "/pacientes", accessAreas) && results.length > 0 && (
              <div className="absolute left-0 right-0 top-11 rounded-md border bg-popover p-1 shadow-lg">
                {results.map((p) => (
                  <button key={p.id} onClick={() => { setQ(""); navigate({ to: "/pacientes/$id", params: { id: p.id } }); }} className="flex w-full flex-col items-start rounded px-3 py-2 text-left hover:bg-muted">
                    <span className="text-sm font-medium">{p.name} <span className="font-mono text-xs text-muted-foreground">{p.bed}</span></span>
                    <span className="text-xs text-muted-foreground">Pront. {p.prontuario} · CPF {p.cpf} {p.motherName ? `· Mãe: ${p.motherName}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Popover>
              <PopoverTrigger className="relative flex items-center gap-1.5 rounded-full bg-maternal-soft px-3 py-1.5 text-xs font-medium text-maternal" aria-label="Alertas críticos">
                <Bell className="h-4 w-4" /> {alerts.length}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-2">
                <div className="px-2 pb-2 text-sm font-semibold">Alertas críticos</div>
                {alerts.map((a, i) => (
                  <button key={i} onClick={() => ("id" in a ? navigate({ to: "/pacientes/$id", params: { id: a.id } }) : navigate({ to: a.to }))} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-maternal" />{a.text}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <label className="hidden items-center gap-2 text-sm md:flex">
              <UserCog className="h-4 w-4 text-clinical" />
              <span className="text-xs font-medium">{profile}</span>
              <span className="hidden text-xs text-muted-foreground xl:inline">{professionalName(profile)}</span>
            </label>
            <Button variant="ghost" size="icon" aria-label="Sair do sistema" title="Sair do sistema" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}><LogOut /></Button>
          </div>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}

export function NoPermission({ action }: { action: string }) {
  return <div className="rounded-md border border-dashed bg-muted p-3 text-xs text-muted-foreground">Seu acesso não permite {action}. Procure a administração do hospital.</div>;
}
