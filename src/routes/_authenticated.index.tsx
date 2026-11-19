import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Ambulance, Baby, BedDouble, HeartPulse, Pill, ShieldAlert, Stethoscope, Users } from "lucide-react";
import { canAccessPage } from "@/lib/hospital-data";
import { professionalName, useStore } from "@/lib/hospital-store";
import { pendingCounts } from "@/lib/dashboard";
import logo from "@/assets/logo-hmisc-santa-casa.png.asset.json";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Painel do plantão – HMISC" },
    { name: "description", content: "Painel operacional com filas, leitos e alertas do Hospital Materno Infantil Santa Catarina." },
    { property: "og:title", content: "Painel do plantão – HMISC" },
    { property: "og:description", content: "Filas, leitos e alertas do plantão em um só lugar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

const QUICK = [
  { to: "/ambulatorio", label: "Ambulatório", icon: Stethoscope },
  { to: "/pronto-socorro", label: "Pronto Socorro", icon: Ambulance },
  { to: "/maternidade", label: "Maternidade", icon: Baby },
  { to: "/pacientes", label: "Pacientes / PEP", icon: Users },
  { to: "/nir", label: "Mapa de leitos", icon: BedDouble },
  { to: "/farmacia", label: "Farmácia", icon: Pill },
  { to: "/enfermagem", label: "Posto de Enfermagem", icon: HeartPulse },
  { to: "/sciras", label: "SCIRAS / CCIH", icon: ShieldAlert },
] as const;

function greeting() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }

function Home() {
  const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  const encounters = useStore((s) => s.encounters); const patients = useStore((s) => s.patients);
  const c = useMemo(() => pendingCounts(encounters, patients), [encounters, patients]);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const kpis = [
    { label: "Internados", value: c["internados"] ?? 0, hint: "Encaminhados à internação", icon: BedDouble, tone: "text-clinical" },
    { label: "Aguardando triagem", value: c["triagem"] ?? 0, hint: "Todas as portas", icon: Ambulance, tone: "text-maternal" },
    { label: "Farmácia", value: c["/farmacia"] ?? 0, hint: "Prescrições a dispensar", icon: Pill, tone: "text-primary" },
    { label: "SCIRAS / ATB", value: c["/sciras"] ?? 0, hint: "Antimicrobianos a avaliar", icon: ShieldAlert, tone: "text-destructive" },
  ];
  const quick = QUICK.filter((q) => canAccessPage(profile, q.to, areas));
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 to-transparent" />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground first-letter:uppercase">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold">{greeting()}, {professionalName(profile)}</h1>
          <p className="text-sm text-muted-foreground">Perfil: {profile} · Pressione <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px]">Ctrl K</kbd> para buscar qualquer paciente ou tela.</p>
        </div>
        <img src={logo.url} alt="Hospital Materno Infantil Santa Catarina – Santa Casa São Bernardo do Campo" className="h-24 w-auto object-contain" />
      </div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => <div key={k.label} className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}<k.icon className={`h-4 w-4 ${k.tone}`} /></div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{k.value}</div>
        <div className="text-xs text-muted-foreground">{k.hint}</div>
      </div>)}
    </section>
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Ações rápidas do plantão</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quick.map((q) => <Link key={q.to} to={q.to} className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><q.icon className="h-5 w-5" /></span>
          <span className="flex-1 font-medium group-hover:text-primary">{q.label}</span>
          {(c[q.to] ?? 0) > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{c[q.to]}</span>}
        </Link>)}
      </div>
    </section>
  </div>;
}
