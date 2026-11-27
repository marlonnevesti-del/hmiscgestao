import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSectorRequest, useStore } from "@/lib/hospital-store";
import { isControlled } from "@/lib/controlled";
import type { StockMedication } from "@/lib/pharmacy-stock";
import { REQUEST_SECTORS } from "@/lib/sector-request";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/solicitacao-farmacia")({
  head: () => ({ meta: [
    { title: "Solicitação à Farmácia – HMI Gestão" },
    { name: "description", content: "Pedido de materiais e medicamentos da farmácia por setor." },
    { property: "og:title", content: "Solicitação à Farmácia – HMI Gestão" },
    { property: "og:description", content: "Pedidos de itens da farmácia por setor." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PharmacySectorRequest,
});

const sel = "h-9 rounded-md border bg-background px-2 text-sm";

type PharmCategory = "todos" | "medicamento" | "controlados" | "armario-controlados" | "materiais";

const PHARM_CATEGORIES: { id: PharmCategory; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "medicamento", label: "Medicamento" },
  { id: "controlados", label: "Medicamentos controlados" },
  { id: "armario-controlados", label: "Armários controlados" },
  { id: "materiais", label: "Materiais médicos" },
];

const MATERIAL_RE = /\b(seringa|agulha|equipo|cateter|sonda|gaze|luva|atadura|esparadrapo|micropore|curativo|scalp|jelco|abocath|fralda|algod[aã]o|compressa|l[aâ]mina|bisturi|fio\s+cir|m[aá]scara|avental|touca|prop[eé]|tubo\s+endotraq|c[aâ]nula|coletor|frasco\s+coletor|eletrodo|material|insumo)\b/i;
const CONTROLLED_RE = /\b(controlad|psicotr[oó]pic|entorpecent|morfina|fentanil|midazolam|diazepam|clonazepam|fenobarbital|tramadol|code[ií]na|petidina|cetamina|propofol|haloperidol|clorpromazina|alprazolam|lorazepam|zolpidem)\b/i;

function matchesPharmCategory(item: StockMedication, cat: PharmCategory): boolean {
  if (cat === "todos") return true;
  const text = `${item.name} ${item.category ?? ""} ${item.presentation ?? ""} ${item.location ?? ""}`;
  const inCabinet = isControlled(item);
  const isMat = /material|m[ée]dic|hospitalar|insumo/i.test(item.category ?? "") || MATERIAL_RE.test(text);
  const isCtrl = inCabinet || CONTROLLED_RE.test(text);
  if (cat === "armario-controlados") return inCabinet;
  if (cat === "controlados") return isCtrl;
  if (cat === "materiais") return isMat && !isCtrl;
  return !isMat && !isCtrl;
}

function PharmacySectorRequest() {
  const items = useStore((s) => s.stock);
  const requests = useStore((s) => s.requests);
  const [sector, setSector] = useState("");
  const [category, setCategory] = useState<PharmCategory>("todos");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const catCounts = useMemo(
    () => Object.fromEntries(PHARM_CATEGORIES.map((c) => [c.id, items.filter((i) => matchesPharmCategory(i, c.id)).length])) as Record<PharmCategory, number>,
    [items],
  );

  const list = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("pt-BR");
    return items.filter(
      (i) => matchesPharmCategory(i, category) && (!t || i.name.toLocaleLowerCase("pt-BR").includes(t) || i.code?.toLocaleLowerCase("pt-BR").includes(t) || i.presentation?.toLocaleLowerCase("pt-BR").includes(t)),
    );
  }, [items, category, q]);

  const chosen = items.filter((i) => (cart[i.id] ?? 0) > 0);
  const setQty = (id: string, n: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.floor(n) || 0) }));
  const send = () => {
    try {
      createSectorRequest(
        sector,
        chosen.map((i) => `${cart[i.id]} ${i.unit} · ${i.code ? i.code + " · " : ""}${i.name}`).join("\n"),
        note,
        "farmacia",
      );
      toast.success("Solicitação enviada à farmácia");
      setCart({});
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não enviado");
    }
  };

  const mine = requests.filter((r) => r.target === "farmacia" && (!sector || r.sector === sector)).slice(0, 15);

  return <div className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold">Solicitação à Farmácia</h1>
      <p className="text-sm text-muted-foreground">Escolha o setor, filtre os itens disponíveis na farmácia e envie o pedido.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Setor" className={sel} value={sector} onChange={(e) => setSector(e.target.value)}>
        <option value="">Setor solicitante…</option>
        {REQUEST_SECTORS.map((s) => <option key={s}>{s}</option>)}
      </select>
      <Input aria-label="Buscar item da farmácia" placeholder="Buscar nome, código ou apresentação" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categorias da farmácia">
      {PHARM_CATEGORIES.map((c) => (
        <Button key={c.id} size="sm" variant={category === c.id ? "default" : "outline"} onClick={() => setCategory(c.id)}>
          {c.label} ({catCounts[c.id]})
        </Button>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-2">Código</th><th className="p-2">Item</th><th className="p-2">Apresentação</th><th className="p-2">Saldo</th><th className="p-2">Qtde.</th></tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} className={cn("border-t", (cart[i.id] ?? 0) > 0 && "bg-primary/5")}>
                <td className="p-2 font-mono text-xs">{i.code || "—"}</td>
                <td className="p-2">{i.name}</td>
                <td className="p-2 text-xs text-muted-foreground">{i.presentation || "—"}</td>
                <td className="p-2 font-mono">{i.quantity} {i.unit}</td>
                <td className="p-2">
                  <Input aria-label={`Quantidade de ${i.name}`} type="number" min="0" className="h-8 w-20" value={cart[i.id] || ""} onChange={(e) => setQty(i.id, Number(e.target.value))} />
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="p-4 text-muted-foreground">Nenhum item encontrado na farmácia.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Itens a solicitar ({chosen.length})</h3>
          {chosen.map((i) => (
            <div key={i.id} className="flex justify-between gap-2 text-sm">
              <span>{cart[i.id]} × {i.name}</span>
              <button className="text-xs text-destructive" onClick={() => setQty(i.id, 0)}>remover</button>
            </div>
          ))}
          <Input aria-label="Observação" placeholder="Observação / urgência" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" disabled={!sector || !chosen.length} onClick={send}>Enviar solicitação</Button>
        </div>
        <div className="space-y-1 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Últimos pedidos{sector && ` · ${sector}`}</h3>
          {mine.length ? mine.map((r) => (
            <div key={r.id} className="border-b py-1 text-xs">
              <b>{r.sector}</b> · {new Date(r.at).toLocaleString("pt-BR")} · <b>{r.status}</b>{r.answer && ` (${r.answer})`}
              <div className="text-muted-foreground">{r.items.split("\n").length} item(ns)</div>
            </div>
          )) : <p className="text-xs text-muted-foreground">Nenhum pedido.</p>}
        </div>
      </div>
    </div>
  </div>;
}