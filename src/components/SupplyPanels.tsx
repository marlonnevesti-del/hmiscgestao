import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/hospital-data";
import { answerSupplyRequest, createSupplyRequest, registerBreakage, returnStock, transferStock, useStore } from "@/lib/hospital-store";
import { DEPOT_LABEL, type Depot, type MovementKind } from "@/lib/supply-flow";
import { fmtExpiry, lotsByExpiry, type StockMedication } from "@/lib/pharmacy-stock";
import { cn } from "@/lib/utils";

function run(fn: () => void, ok: string) { try { fn(); toast.success(ok); return true; } catch (e) { toast.error(e instanceof Error ? e.message : "Ação não concluída"); return false; } }
const sel = "h-9 rounded-md border bg-background px-2 text-sm";
const useDepot = (d: Depot) => useStore((s) => (d === "farmacia" ? s.stock : s.warehouse));

/** Busca de item + seleção de lote, usada em transferência, devolução e quebra. */
function ItemLotPicker({ items, value, onChange }: { items: StockMedication[]; value: { id: string; lot: string }; onChange: (v: { id: string; lot: string }) => void }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLocaleLowerCase("pt-BR");
  const found = (t ? items.filter((i) => i.name.toLocaleLowerCase("pt-BR").includes(t) || i.code?.includes(t)) : items).slice(0, 80);
  const item = items.find((i) => i.id === value.id);
  return <div className="grid gap-2 md:grid-cols-[1fr_2fr_1fr]">
    <Input aria-label="Buscar produto" placeholder="Buscar nome ou código" value={q} onChange={(e) => setQ(e.target.value)} />
    <select aria-label="Produto" className={sel} value={value.id} onChange={(e) => { const it = items.find((i) => i.id === e.target.value); const ls = lotsByExpiry(it); onChange({ id: e.target.value, lot: ls.length === 1 ? ls[0]!.lot : "" }); }}><option value="">Selecione o produto</option>{found.map((i) => <option key={i.id} value={i.id}>{i.code ? `${i.code} · ` : ""}{i.name} ({i.quantity} {i.unit})</option>)}</select>
    {item?.lots?.length ? <select aria-label="Lote" className={sel} value={value.lot} onChange={(e) => onChange({ ...value, lot: e.target.value })}><option value="">Escolha o lote (vence primeiro no topo)</option>{lotsByExpiry(item).map((l) => <option key={l.lot + l.expiry} value={l.lot}>{`Lote ${l.lot} · val. ${fmtExpiry(l.expiry)} · ${l.quantity} ${item.unit}`}</option>)}</select> : <Input aria-label="Lote" placeholder="Lote" value={value.lot} onChange={(e) => onChange({ ...value, lot: e.target.value })} />}
  </div>;
}

export function TransferForm({ from }: { from: Depot }) {
  const items = useDepot(from); const profile = useStore((s) => s.profile);
  const to: Depot = from === "farmacia" ? "almoxarifado" : "farmacia";
  const [v, setV] = useState({ id: "", lot: "" }); const [qty, setQty] = useState("");
  return <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (run(() => transferStock(from, v.id, Number(qty), v.lot), `Transferido para ${DEPOT_LABEL[to]}`)) { setV({ id: "", lot: "" }); setQty(""); } }}>
    <h3 className="text-sm font-semibold">Transferir de {DEPOT_LABEL[from]} para {DEPOT_LABEL[to]}</h3>
    <ItemLotPicker items={items} value={v} onChange={setV} />
    <div className="flex gap-2"><Input aria-label="Quantidade" type="number" min="1" placeholder="Quantidade" className="max-w-40" value={qty} onChange={(e) => setQty(e.target.value)} required /><Button type="submit" disabled={!can(profile, from === "farmacia" ? "farmacia" : "almoxarifado") || !v.id}>Transferir</Button></div>
  </form>;
}

export function ReturnForm({ depot }: { depot: Depot }) {
  const items = useDepot(depot); const profile = useStore((s) => s.profile);
  const [v, setV] = useState({ id: "", lot: "" }); const [f, setF] = useState({ qty: "", origin: "", reason: "" });
  return <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (run(() => returnStock(depot, v.id, Number(f.qty), v.lot, f.origin, f.reason), "Devolução registrada e saldo atualizado")) { setV({ id: "", lot: "" }); setF({ qty: "", origin: "", reason: "" }); } }}>
    <h3 className="text-sm font-semibold">Devolução de produto não utilizado</h3>
    <ItemLotPicker items={items} value={v} onChange={setV} />
    <div className="grid gap-2 md:grid-cols-[120px_1fr_1fr_auto]"><Input aria-label="Quantidade devolvida" type="number" min="1" placeholder="Qtde." value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} required /><Input aria-label="Origem da devolução" placeholder="Setor / paciente / leito" value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /><Input aria-label="Motivo da devolução" placeholder="Motivo (alta, suspensão...)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /><Button type="submit" disabled={!can(profile, depot === "farmacia" ? "farmacia" : "almoxarifado") || !v.id}>Registrar devolução</Button></div>
  </form>;
}

export function BreakageForm() {
  const items = useStore((s) => s.stock); const profile = useStore((s) => s.profile);
  const [v, setV] = useState({ id: "", lot: "" }); const [f, setF] = useState({ qty: "", reason: "" });
  return <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (run(() => registerBreakage(v.id, Number(f.qty), v.lot, f.reason), "Quebra/extravio registrado")) { setV({ id: "", lot: "" }); setF({ qty: "", reason: "" }); } }}>
    <h3 className="text-sm font-semibold">Registro de quebra / extravio</h3>
    <ItemLotPicker items={items} value={v} onChange={setV} />
    <div className="grid gap-2 md:grid-cols-[120px_1fr_auto]"><Input aria-label="Quantidade quebrada ou extraviada" type="number" min="1" placeholder="Qtde." value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} required /><Input aria-label="Relato da quebra ou extravio" placeholder="Relato: como, onde e quem" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /><Button type="submit" variant="destructive" disabled={!can(profile, "farmacia") || !v.id}>Registrar quebra/extravio</Button></div>
  </form>;
}

export function MovementLog({ kinds, depot }: { kinds: MovementKind[]; depot?: Depot }) {
  const all = useStore((s) => s.movements);
  const name = depot ? DEPOT_LABEL[depot] : "";
  const list = all.filter((m) => kinds.includes(m.kind) && (!name || m.from === name || m.to === name));
  if (!list.length) return <p className="py-4 text-sm text-muted-foreground">Nenhum registro ainda.</p>;
  return <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Produto</th><th className="p-2">Lote</th><th className="p-2">Qtde.</th><th className="p-2">De → Para</th><th className="p-2">Motivo</th><th className="p-2">Por</th></tr></thead><tbody>{list.map((m) => <tr key={m.id} className="border-t"><td className="p-2 text-xs">{new Date(m.at).toLocaleString("pt-BR")}</td><td className="p-2">{m.code ? `${m.code} · ` : ""}{m.item}</td><td className="p-2 font-mono text-xs">{m.lot}</td><td className="p-2 font-mono">{m.qty}</td><td className="p-2 text-xs">{m.from} → {m.to}</td><td className="p-2 text-xs">{m.reason}</td><td className="p-2 text-xs">{m.by}</td></tr>)}</tbody></table></div>;
}

export function RequestInbox({ target }: { target: Depot }) {
  const all = useStore((s) => s.requests); const profile = useStore((s) => s.profile);
  const list = all.filter((r) => r.target === target);
  const allowed = can(profile, target === "farmacia" ? "farmacia" : "almoxarifado");
  if (!list.length) return <p className="py-4 text-sm text-muted-foreground">Nenhum pedido do posto de enfermagem.</p>;
  return <div className="space-y-2">{list.map((r) => <div key={r.id} className={cn("rounded-lg border p-3 text-sm", r.status === "Pendente" && "border-primary bg-primary/5")}>
    <div className="flex flex-wrap justify-between gap-2"><b>{r.sector}{r.patient && ` · ${r.patient}`}</b><span className="text-xs">{new Date(r.at).toLocaleString("pt-BR")} · {r.by} · <b>{r.status}</b></span></div>
    <div className="whitespace-pre-wrap">{r.items}</div>{r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
    {r.handledBy && <div className="text-xs text-muted-foreground">{r.status} por {r.handledBy}{r.answer && `: ${r.answer}`}</div>}
    {r.status === "Pendente" && <div className="mt-2 flex gap-2"><Button size="sm" disabled={!allowed} onClick={() => run(() => answerSupplyRequest(r.id, "Atendido"), "Pedido atendido")}>Marcar atendido</Button><Button size="sm" variant="outline" disabled={!allowed} onClick={() => { const why = window.prompt("Motivo da recusa"); if (why != null) run(() => answerSupplyRequest(r.id, "Recusado", why), "Pedido recusado"); }}>Recusar</Button></div>}
  </div>)}</div>;
}

export function NursingRequestForm() {
  const profile = useStore((s) => s.profile); const all = useStore((s) => s.requests);
  const [f, setF] = useState({ target: "farmacia" as Depot, items: "", sector: "Posto de Enfermagem", patient: "", note: "" });
  return <div className="space-y-3"><form className="space-y-2 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (run(() => createSupplyRequest(f), `Pedido enviado para ${DEPOT_LABEL[f.target]}`)) setF({ ...f, items: "", patient: "", note: "" }); }}>
    <h3 className="text-sm font-semibold">Pedido de produtos</h3>
    <div className="grid gap-2 md:grid-cols-3"><select aria-label="Enviar pedido para" className={sel} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value as Depot })}><option value="farmacia">Farmácia</option><option value="almoxarifado">Almoxarifado</option></select><Input aria-label="Setor solicitante" placeholder="Setor" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })} /><Input aria-label="Paciente ou leito" placeholder="Paciente / leito (opcional)" value={f.patient} onChange={(e) => setF({ ...f, patient: e.target.value })} /></div>
    <textarea aria-label="Produtos e quantidades" className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" placeholder={"Ex.: 4 agulhas 30x8\n2 seringas 10 mL"} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} />
    <div className="flex gap-2"><Input aria-label="Observação do pedido" placeholder="Observação" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /><Button type="submit" disabled={!can(profile, "checar")}>Enviar pedido</Button></div>
  </form>
  <h3 className="text-sm font-semibold">Meus pedidos</h3>{all.length ? all.slice(0, 20).map((r) => <div key={r.id} className="flex justify-between border-b py-1 text-sm"><span>{DEPOT_LABEL[r.target]} · {r.items.split("\n")[0]}</span><span className="text-xs">{new Date(r.at).toLocaleString("pt-BR")} · <b>{r.status}</b>{r.answer && ` (${r.answer})`}</span></div>) : <p className="text-sm text-muted-foreground">Nenhum pedido enviado.</p>}</div>;
}
