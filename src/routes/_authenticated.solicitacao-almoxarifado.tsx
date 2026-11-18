import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSectorRequest, useStore } from "@/lib/hospital-store";
import { REQUEST_SECTORS } from "@/lib/sector-request";
import { WAREHOUSE_CATEGORIES, allowedRequestCategories, categoryLabel, type WarehouseCategory } from "@/lib/warehouse-categories";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/solicitacao-almoxarifado")({
  head: () => ({ meta: [
    { title: "Solicitação ao Almoxarifado – HMI Gestão" },
    { name: "description", content: "Pedido de produtos do almoxarifado por setor, separados em assistencial e administrativo." },
    { property: "og:title", content: "Solicitação ao Almoxarifado – HMI Gestão" },
    { property: "og:description", content: "Pedidos de produtos ao almoxarifado por setor." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SectorRequest,
});

const sel = "h-9 rounded-md border bg-background px-2 text-sm";

function SectorRequest() {
  const items = useStore((s) => s.warehouse);
  const requests = useStore((s) => s.requests);
  const [sector, setSector] = useState("");
  const profile = useStore((s) => s.profile); const accessAreas = useStore((s) => s.accessAreas);
  const allowed = useMemo(() => new Set<string>(allowedRequestCategories(profile, accessAreas)), [profile, accessAreas]);
  const [area, setArea] = useState<"Todos" | WarehouseCategory>("Todos");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLocaleLowerCase("pt-BR");
    return items.filter((i) => allowed.has(i.category ?? "") && (area === "Todos" || i.category === area) && (!t || i.name.toLocaleLowerCase("pt-BR").includes(t) || i.code?.includes(t)));
  }, [items, area, q, allowed]);
  const chosen = items.filter((i) => (cart[i.id] ?? 0) > 0 && allowed.has(i.category ?? ""));
  const setQty = (id: string, n: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.floor(n) || 0) }));
  const send = () => {
    try {
      createSectorRequest(sector, chosen.map((i) => `${cart[i.id]} ${i.unit} · ${i.code ? i.code + " · " : ""}${i.name}`).join("\n"), note);
      toast.success("Solicitação enviada ao almoxarifado"); setCart({}); setNote("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não enviado"); }
  };
  const mine = requests.filter((r) => r.target === "almoxarifado" && (!sector || r.sector === sector)).slice(0, 15);
  return <div className="space-y-4">
    <div><h1 className="text-xl font-semibold">Solicitação ao Almoxarifado</h1><p className="text-sm text-muted-foreground">Escolha o setor, filtre os produtos e envie o pedido.</p></div>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Setor" className={sel} value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Setor solicitante…</option>{REQUEST_SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
      <Button size="sm" variant={area === "Todos" ? "default" : "outline"} onClick={() => setArea("Todos")}>Todas liberadas</Button>
      {WAREHOUSE_CATEGORIES.map((c) => allowed.has(c.id)
        ? <Button key={c.id} size="sm" variant={area === c.id ? "default" : "outline"} onClick={() => setArea(c.id)}>{c.label}</Button>
        : <Button key={c.id} size="sm" variant="outline" disabled title="Categoria bloqueada para o seu perfil. Peça liberação ao Administrador."><Lock />{c.label}</Button>)}
      <Input aria-label="Buscar produto" placeholder="Buscar nome ou código" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Código</th><th className="p-2">Produto</th><th className="p-2">Categoria</th><th className="p-2">Saldo</th><th className="p-2">Qtde.</th></tr></thead>
        <tbody>{list.map((i) => <tr key={i.id} className={cn("border-t", (cart[i.id] ?? 0) > 0 && "bg-primary/5")}><td className="p-2 font-mono text-xs">{i.code}</td><td className="p-2">{i.name}</td><td className="p-2 text-xs">{categoryLabel(i.category)}</td><td className="p-2 font-mono">{i.quantity} {i.unit}</td><td className="p-2"><Input aria-label={`Quantidade de ${i.name}`} type="number" min="0" className="h-8 w-20" value={cart[i.id] || ""} onChange={(e) => setQty(i.id, Number(e.target.value))} /></td></tr>)}
        {!list.length && <tr><td colSpan={5} className="p-4 text-muted-foreground">Nenhum produto nesta área.</td></tr>}</tbody></table></div>
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border bg-card p-4"><h3 className="text-sm font-semibold">Itens a solicitar ({chosen.length})</h3>
          {chosen.map((i) => <div key={i.id} className="flex justify-between gap-2 text-sm"><span>{cart[i.id]} × {i.name}</span><button className="text-xs text-destructive" onClick={() => setQty(i.id, 0)}>remover</button></div>)}
          <Input aria-label="Observação" placeholder="Observação / urgência" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" disabled={!sector || !chosen.length} onClick={send}>Enviar solicitação</Button></div>
        <div className="space-y-1 rounded-xl border bg-card p-4"><h3 className="text-sm font-semibold">Últimos pedidos{sector && ` · ${sector}`}</h3>
          {mine.length ? mine.map((r) => <div key={r.id} className="border-b py-1 text-xs"><b>{r.sector}</b> · {new Date(r.at).toLocaleString("pt-BR")} · <b>{r.status}</b>{r.answer && ` (${r.answer})`}<div className="text-muted-foreground">{r.items.split("\n").length} item(ns)</div></div>) : <p className="text-xs text-muted-foreground">Nenhum pedido.</p>}</div>
      </div>
    </div>
  </div>;
}
