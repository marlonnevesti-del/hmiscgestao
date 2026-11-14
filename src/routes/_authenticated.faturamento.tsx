import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoPermission } from "@/components/AppShell";
import { buildBill, can } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/faturamento")({
  head: () => ({ meta: [
    { title: "Faturamento Hospitalar TISS – HMI Gestão" },
    { name: "description", content: "Pré-faturamento por internação com diárias, taxas, materiais, medicamentos e guias TISS." },
    { property: "og:title", content: "Faturamento Hospitalar TISS – HMI Gestão" },
    { property: "og:description", content: "Pré-faturamento por internação e guias TISS." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Fat,
});
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Fat() {
  const patients = useStore((s) => s.patients);
  const surgeries = useStore((s) => s.surgeries);
  const admins = useStore((s) => s.admins);
  const profile = useStore((s) => s.profile);
  const [selId, setSelId] = useState(patients[0]!.id);
  const [guide, setGuide] = useState<"SP/SADT" | "Resumo de Internação" | null>(null);
  const bills = patients.map((p) => ({ p, ...buildBill(p, surgeries, admins) }));
  const sel = bills.find((b) => b.p.id === selId) ?? bills[0]!;
  const groups = [...new Set(sel.lines.map((l) => l.group))];
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Faturamento hospitalar (padrão TISS)</h1><p className="text-sm text-muted-foreground">Pré-faturamento consolidado · total em aberto {brl(bills.reduce((s, b) => s + b.total, 0))} · {bills.filter((b) => b.pend.length).length} contas com pendência</p></div>
      {!can(profile, "faturar") && <NoPermission action="fechar contas ou gerar guias (perfil Recepção/Faturamento)" />}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-1 rounded-lg border bg-card p-2">
          {bills.map((b) => (
            <button key={b.p.id} onClick={() => setSelId(b.p.id)} className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted", selId === b.p.id && "bg-secondary")}>
              <div className="min-w-0"><div className="truncate font-medium">{b.p.name}</div><div className="text-xs text-muted-foreground">{b.p.insurance} · {b.p.guia ?? "sem guia"}</div></div>
              <div className="text-right"><div className="font-mono text-xs">{brl(b.total)}</div>{b.pend.length > 0 ? <span className="rounded bg-maternal-soft px-1.5 text-[10px] font-semibold text-maternal">{b.pend.length} pendência(s)</span> : <span className="text-[10px] text-clinical">OK</span>}</div>
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><div className="font-semibold">{sel.p.name}</div><div className="text-xs text-muted-foreground">Atendimento {sel.p.prontuario} · {sel.p.insurance} · Admissão {sel.p.admission} · {sel.p.days} diária(s)</div></div>
              <div className="flex gap-2">{(["SP/SADT", "Resumo de Internação"] as const).map((g) => <button key={g} disabled={!can(profile, "faturar")} onClick={() => setGuide(g)} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">Guia {g}</button>)}</div>
            </div>
            {sel.pend.length > 0 && <div className="mb-3 rounded-md bg-maternal-soft p-3 text-xs text-maternal"><div className="font-semibold">Pendências de auditoria</div>{sel.pend.map((x) => <div key={x}>• {x}</div>)}</div>}
            <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th>TUSS</th><th>Descrição</th><th className="text-right">Qtd</th><th className="text-right">Unit.</th><th className="text-right">Total</th></tr></thead>
              <tbody>{groups.flatMap((g) => [<tr key={g}><td colSpan={5} className="pt-3 text-xs font-semibold uppercase text-primary">{g}</td></tr>, ...sel.lines.filter((l) => l.group === g).map((l, i) => <tr key={g + i} className="border-t"><td className="py-1 font-mono text-xs">{l.tuss}</td><td>{l.desc}</td><td className="text-right font-mono">{l.qty}</td><td className="text-right font-mono">{brl(l.unit)}</td><td className="text-right font-mono">{brl(l.qty * l.unit)}</td></tr>)])}</tbody>
            </table>
            <div className="mt-3 border-t pt-2 text-right text-lg font-semibold">Total: <span className="font-mono text-primary">{brl(sel.total)}</span></div>
            <p className="mt-1 text-[11px] text-muted-foreground">Medicamentos entram na conta quando a enfermagem checa a administração.</p>
          </div>
        </div>
      </div>
      <Dialog open={!!guide} onOpenChange={(o) => !o && setGuide(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Guia TISS – {guide}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-px border bg-border text-xs">
            {[["1 - Registro ANS", sel.p.insurance === "SUS" ? "—" : "326305"], ["2 - Nº guia prestador", sel.p.guia ?? "PENDENTE"], ["7 - Beneficiário", sel.p.name], ["8 - Nº carteira", sel.p.cpf], ["13 - Contratado", "Hospital Materno-Infantil HMISC"], ["15 - CNES", "2077485"], ["21 - Caráter atendimento", "Urgência"], ["23 - Indicação clínica", sel.p.diagnosis], ["Data admissão", sel.p.admission], ["Diárias", String(sel.p.days)], ["Autorização", sel.p.authorized ? "Autorizada" : "AGUARDANDO"], ["Valor total", brl(sel.total)]].map(([k, v]) => <div key={k} className="bg-card p-2"><div className="text-[10px] text-muted-foreground">{k}</div><div className={cn("font-medium", (v === "PENDENTE" || v === "AGUARDANDO") && "text-maternal")}>{v}</div></div>)}
          </div>
          <button onClick={() => window.print()} className="rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">Imprimir guia</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
