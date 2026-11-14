import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Activity, BedDouble, Bell, ChevronLeft, ClipboardList, HeartPulse, Search, Stethoscope, Users } from "lucide-react";
import { PATIENTS, WARDS } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: Activity },
  { to: "/acolhimento", label: "Acolhimento", icon: ClipboardList },
  { to: "/pacientes", label: "Pacientes / PEP", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("CO");
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return PATIENTS.filter((p) => [p.name, p.cpf, p.prontuario, p.motherName ?? ""].some((f) => f.toLowerCase().includes(t))).slice(0, 6);
  }, [q]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={cn("sticky top-0 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all", collapsed ? "w-16" : "w-60")}>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <HeartPulse className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!collapsed && <div className="leading-tight"><div className="text-sm font-semibold text-sidebar-accent-foreground">HMI Gestão</div><div className="text-[10px] uppercase tracking-wider opacity-70">Materno-Infantil</div></div>}
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} title={n.label} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent")}>
                <n.icon className="h-4 w-4 shrink-0" />{!collapsed && n.label}
              </Link>
            );
          })}
          {!collapsed && <div className="px-3 pt-4 text-[10px] uppercase tracking-wider opacity-60">Acesso rápido</div>}
          {!collapsed && PATIENTS.slice(0, 4).map((p) => (
            <Link key={p.id} to="/pacientes/$id" params={{ id: p.id }} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:bg-sidebar-accent">
              <BedDouble className="h-3.5 w-3.5 opacity-70" /><span className="truncate">{p.bed} · {p.name.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center gap-2 rounded-md p-2 text-xs hover:bg-sidebar-accent" aria-label="Recolher menu">
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />{!collapsed && "Recolher"}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente: nome, CPF, prontuário ou nome da mãe" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-11 rounded-md border bg-popover p-1 shadow-lg">
                {results.map((p) => (
                  <button key={p.id} onClick={() => { setQ(""); navigate({ to: "/pacientes/$id", params: { id: p.id } }); }} className="flex w-full flex-col items-start rounded px-3 py-2 text-left hover:bg-muted">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">Pront. {p.prontuario} · CPF {p.cpf} {p.motherName ? `· Mãe: ${p.motherName}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select value={ward} onChange={(e) => setWard(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Unidade">
            {WARDS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full bg-maternal-soft px-3 py-1 text-xs font-medium text-maternal md:flex">
              <Bell className="h-3.5 w-3.5" /> 2 alertas críticos
            </div>
            <div className="flex items-center gap-2 text-sm"><Stethoscope className="h-4 w-4 text-clinical" /><span className="hidden md:inline">Dra. Helena Prado</span></div>
          </div>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
