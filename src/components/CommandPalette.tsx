import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { canAccessPage } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";

const PAGES = [
  ["/", "Painel inicial"], ["/ambulatorio", "Ambulatório"], ["/pronto-socorro", "Pronto Socorro"], ["/maternidade", "Maternidade"],
  ["/uti-uci", "UTI Ped · UCI · UTI Neo"], ["/pacientes", "Pacientes / PEP"], ["/nir", "NIR – Leitos"],
  ["/internacoes", "Censo · Internações"], ["/centro-cirurgico", "Centro Cirúrgico"], ["/gestao-cirurgica", "SRPA · CO · Indicadores"], ["/cme", "CME"],
  ["/sciras", "SCIRAS / CCIH"], ["/farmacia", "Farmácia"], ["/enfermagem", "Posto de Enfermagem"], ["/almoxarifado", "Almoxarifado"],
  ["/solicitacao-almoxarifado", "Solicitação ao Almoxarifado"], ["/solicitacao-farmacia", "Solicitação à Farmácia"], ["/faturamento", "Faturamento TISS"], ["/faturamento-sus", "Faturamento SUS"], ["/prestacao-contas", "Prestação de contas OS"], ["/centro-de-custos", "Centro de custos"],
] as const;

/** Ctrl+K global search: patients and screens the user can open. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const patients = useStore((s) => s.patients); const profile = useStore((s) => s.profile); const areas = useStore((s) => s.accessAreas);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (fn: () => void) => { setOpen(false); fn(); };
  const pages = PAGES.filter(([to]) => to === "/" || canAccessPage(profile, to, areas));
  return <>
    <button onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted lg:flex" aria-label="Busca rápida">
      <Search className="h-3.5 w-3.5" /> Ir para… <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Ctrl K</kbd>
    </button>
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Paciente (nome, CPF, prontuário) ou tela…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {canAccessPage(profile, "/pacientes", areas) && <CommandGroup heading="Pacientes">
          {patients.slice(0, 200).map((p) => <CommandItem key={p.id} value={`${p.name} ${p.cpf} ${p.prontuario} ${p.motherName ?? ""}`} onSelect={() => go(() => navigate({ to: "/pacientes/$id", params: { id: p.id } }))}>
            <span className="font-medium">{p.name}</span><span className="ml-auto font-mono text-xs text-muted-foreground">{p.bed} · {p.prontuario}</span>
          </CommandItem>)}
        </CommandGroup>}
        <CommandGroup heading="Telas">
          {pages.map(([to, label]) => <CommandItem key={to} value={label} onSelect={() => go(() => navigate({ to }))}>{label}</CommandItem>)}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  </>;
}
