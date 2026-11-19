import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KIT_GROUPS, kitGroup, kitTotal, searchKits, type KitGroup, type SurgicalKit } from "@/lib/surgical-kits";
import { Letterhead } from "./DischargePrint";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SurgicalKits() {
  const [q, setQ] = useState(""); const [group, setGroup] = useState<KitGroup | "">("");
  const [open, setOpen] = useState(""); const [print, setPrint] = useState<SurgicalKit | null>(null);
  const list = searchKits(q, group);
  const doPrint = (k: SurgicalKit) => { setPrint(k); setTimeout(() => window.print(), 50); };
  return <section className="space-y-3">
    <div className="flex flex-wrap gap-2 print:hidden">
      <Input autoFocus aria-label="Buscar kit" className="max-w-md" placeholder="Bipar código de barras ou buscar kit / item" value={q} onChange={(e) => setQ(e.target.value)} />
      <select aria-label="Especialidade" className="h-9 rounded-md border bg-background px-2 text-sm" value={group} onChange={(e) => setGroup(e.target.value as KitGroup | "")}>
        <option value="">Todas as especialidades</option>{KIT_GROUPS.map((g) => <option key={g}>{g}</option>)}
      </select>
      <span className="self-center text-sm text-muted-foreground">{list.length} kits</span>
    </div>
    <div className="grid gap-2 print:hidden">{list.map((k) => <div key={k.code} className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><span className="mr-2 rounded bg-muted px-2 py-0.5 font-mono font-semibold">{k.code}</span><b>{k.name}</b>
          <div className="text-xs text-muted-foreground">{kitGroup(k.name)} · {k.items.length} itens · custo médio {brl(kitTotal(k))}</div></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setOpen(open === k.code ? "" : k.code)}>{open === k.code ? "Fechar" : "Ver composição"}</Button><Button size="sm" variant="outline" onClick={() => doPrint(k)}>Imprimir</Button></div>
      </div>
      {open === k.code && <KitTable kit={k} />}
    </div>)}</div>
    {print && <div className="hidden print:block"><Letterhead title={`${print.name} · Cód. ${print.code}`} /><KitTable kit={print} /></div>}
  </section>;
}

function KitTable({ kit }: { kit: SurgicalKit }) {
  return <table className="mt-2 w-full text-xs"><thead><tr className="border-b text-left"><th className="py-1">Cód.</th><th>Produto</th><th className="text-right">Qtde</th><th>Un.</th><th className="text-right">Custo médio</th></tr></thead>
    <tbody>{kit.items.map((i, n) => <tr key={i.code + n} className="border-b"><td className="py-1 font-mono">{i.code}</td><td>{i.name}</td><td className="text-right">{i.qty}</td><td>{i.unit}</td><td className="text-right">{brl(i.qty * i.cost)}</td></tr>)}</tbody>
    <tfoot><tr><td colSpan={4} className="py-1 text-right font-semibold">Total do kit</td><td className="text-right font-semibold">{brl(kitTotal(kit))}</td></tr></tfoot></table>;
}
