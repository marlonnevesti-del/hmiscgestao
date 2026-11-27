import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, HelpCircle, Printer, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HELP_SECTORS, type HelpSector } from "@/lib/help-tutorials";
import { canAccessPage } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";
import { HelpSectorVideo } from "@/components/HelpSectorVideo";

export const Route = createFileRoute("/_authenticated/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de Ajuda e Tutoriais · HMISC" },
      { name: "description", content: "Manual operacional e tutoriais passo a passo por setor do sistema hospitalar HMISC." },
      { property: "og:title", content: "Central de Ajuda e Tutoriais · HMISC" },
      { property: "og:description", content: "Manual operacional e tutoriais passo a passo por setor do sistema hospitalar HMISC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const GROUPS: HelpSector["group"][] = ["Recepção", "Assistência", "Apoio", "Administrativo"];

function HelpPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(HELP_SECTORS[0]?.id ?? "recepcao");
  const profile = useStore((s) => s.profile);
  const accessAreas = useStore((s) => s.accessAreas);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_SECTORS;
    return HELP_SECTORS.filter((s) =>
      [
        s.title,
        s.group,
        s.summary,
        ...s.steps.flatMap((st) => [st.title, st.detail]),
        ...s.rules,
        ...s.faq.flatMap((f) => [f.q, f.a]),
      ].some((text) => text.toLowerCase().includes(q)),
    );
  }, [query]);

  const active = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BookOpen className="h-6 w-6 text-clinical" /> Central de Ajuda por Setor
          </h1>
          <p className="text-sm text-muted-foreground">
            Tutoriais passo a passo, regras SUS e dúvidas frequentes para todas as equipes do HMISC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tutorial, código SIGTAP, regra..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir guia
          </Button>
        </div>
      </div>

      <div className="space-y-2 lg:hidden print:hidden">
        <label htmlFor="help-sector" className="text-sm font-medium">Setor do tutorial</label>
        <select
          id="help-sector"
          value={active?.id ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
          className="h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {filtered.filter((sector) => sector.group === group).map((sector) => (
                <option key={sector.id} value={sector.id}>{sector.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        <aside className="hidden space-y-4 print:hidden lg:block">
          {GROUPS.map((group) => {
            const items = filtered.filter((s) => s.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="space-y-1">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                {items.map((sector) => {
                  const isSelected = active?.id === sector.id;
                  return (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() => setSelectedId(sector.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-primary font-medium text-primary-foreground"
                          : "hover:bg-muted text-foreground",
                      )}
                    >
                      {sector.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhum tutorial encontrado para "{query}".
            </div>
          )}
        </aside>

        <section className="min-w-0 flex flex-col space-y-6">
          {active ? (
            <>
              <div className="order-2 flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-5 lg:order-1">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-clinical">
                    {active.group}
                  </div>
                  <h2 className="text-xl font-bold">{active.title}</h2>
                  <p className="text-sm text-muted-foreground">{active.summary}</p>
                </div>
                {active.route && canAccessPage(profile, active.route, accessAreas) && (
                  <Button asChild size="sm" variant="outline" className="print:hidden">
                    <Link to={active.route as "/"}>
                      Abrir setor <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="order-1 lg:order-2">
                <HelpSectorVideo key={active.id} title={active.title} {...(active.video ? { video: active.video } : {})} />
              </div>

              <div className="order-3 space-y-3">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-clinical" /> Passo a passo operacional
                </h3>
                <div className="space-y-2.5">
                  {active.steps.map((step) => (
                    <div key={step.title} className="rounded-lg border bg-card p-4">
                      <div className="font-semibold text-sm">{step.title}</div>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Regras importantes e validações SUS
                </h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
                  {active.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>

              <div className="order-5 space-y-3">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <HelpCircle className="h-4 w-4 text-clinical" /> Dúvidas frequentes
                </h3>
                <div className="space-y-2.5">
                  {active.faq.map((item) => (
                    <div key={item.q} className="rounded-lg border bg-card p-4">
                      <div className="font-medium text-sm">{item.q}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Selecione um setor ou limpe a busca para visualizar o tutorial.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}