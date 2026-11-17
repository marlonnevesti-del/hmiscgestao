import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/hospital-data";
import { answerSupplyRequest, createDepotProduct, createSupplyRequest, receiveStock, registerLoan, settleLoan, type EntryLine, registerBreakage, returnStock, transferStock, useStore } from "@/lib/hospital-store";
import { DEPOT_LABEL, loanReturnedQty, type Depot, type MovementKind } from "@/lib/supply-flow";
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

const NEW = "__novo__";
/** Linha de entrada: escolhe lote existente (por validade) ou cadastra lote novo com validade. */
const F = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => <label className={cn("grid gap-1 text-xs font-medium text-muted-foreground", className)}>{label}{children}</label>;
function EntryLinePicker({ items, onAdd, allowNew, label, depot }: { items: StockMedication[]; onAdd: (l: EntryLine) => void; allowNew: boolean; label: string; depot?: Depot }) {
  const [q, setQ] = useState(""); const [id, setId] = useState(""); const [lot, setLot] = useState(""); const [nl, setNl] = useState({ lot: "", expiry: "" }); const [qty, setQty] = useState("");
  const [np, setNp] = useState<null | { name: string; code: string; unit: string; minimum: string }>(null);
  const t = q.trim().toLocaleLowerCase("pt-BR");
  const found = (t ? items.filter((i) => i.name.toLocaleLowerCase("pt-BR").includes(t) || i.code?.includes(t)) : items).slice(0, 80);
  const item = items.find((i) => i.id === id);
  const lots = (item?.lots ?? []).filter((l) => allowNew || l.quantity > 0).slice().sort((a, b) => (a.expiry || "9").localeCompare(b.expiry || "9"));
  const isNew = lot === NEW || (allowNew && !!item && !lots.length);
  const add = () => { const n = Number(qty); const ln = isNew ? nl.lot.trim() : lot; const ex = isNew ? nl.expiry : lots.find((l) => l.lot === lot)?.expiry ?? ""; if (!id || !ln || !(n > 0)) { toast.error("Escolha produto, lote e quantidade."); return; } if (isNew && !nl.expiry) { toast.error("Informe a validade do novo lote."); return; } onAdd({ id, lot: ln, expiry: ex, qty: n }); setLot(""); setNl({ lot: "", expiry: "" }); setQty(""); };
  const saveProduct = () => { if (!np || !depot) return; let nid = ""; if (run(() => { nid = createDepotProduct(depot, { name: np.name, code: np.code, unit: np.unit, minimum: Number(np.minimum || 0) }); }, "Produto cadastrado")) { setId(nid); setLot(NEW); setQ(""); setNp(null); } };
  return <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens da nota</p>
      {allowNew && depot && !np && <Button type="button" size="sm" variant="outline" onClick={() => setNp({ name: q, code: "", unit: "UN", minimum: "0" })}>+ Cadastrar novo produto</Button>}</div>
    {np && <div className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[2fr_1fr_100px_100px_auto_auto] md:items-end">
      <F label="Nome / concentração do novo produto"><Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="Ex.: DIPIRONA 500MG/ML AMP 2ML" /></F>
      <F label="Código (opcional)"><Input value={np.code} onChange={(e) => setNp({ ...np, code: e.target.value })} /></F>
      <F label="Unidade"><Input value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} /></F>
      <F label="Estoque mín."><Input type="number" min="0" value={np.minimum} onChange={(e) => setNp({ ...np, minimum: e.target.value })} /></F>
      <Button type="button" onClick={saveProduct}>Salvar produto</Button><Button type="button" variant="ghost" onClick={() => setNp(null)}>Cancelar</Button></div>}
    <div className="grid gap-2 md:grid-cols-[1fr_2fr] md:items-end">
      <F label="1. Buscar produto"><Input aria-label="Buscar produto" placeholder="Nome ou código" value={q} onChange={(e) => setQ(e.target.value)} /></F>
      <F label={`2. Produto (${found.length} encontrados)`}><select aria-label="Produto" className={sel} value={id} onChange={(e) => { setId(e.target.value); setLot(""); }}><option value="">Selecione o produto</option>{found.map((i) => <option key={i.id} value={i.id}>{i.code ? `${i.code} · ` : ""}{i.name} ({i.quantity} {i.unit})</option>)}</select></F>
    </div>
    {allowNew && t && !found.length && depot && !np && <p className="text-xs text-muted-foreground">Produto não encontrado. <button type="button" className="font-medium text-primary underline" onClick={() => setNp({ name: q, code: "", unit: "UN", minimum: "0" })}>Cadastrar "{q}" como novo produto</button></p>}
    <div className="grid gap-2 md:grid-cols-[2fr_1.2fr_1fr_110px_auto] md:items-end">
      <F label="3. Lote">{(!allowNew || lots.length > 0) ? <select aria-label="Lote" className={sel} value={lot} disabled={!item} onChange={(e) => setLot(e.target.value)}><option value="">{item ? "Selecione o lote (vence primeiro no topo)" : "Escolha o produto antes"}</option>{lots.map((l) => <option key={l.lot + l.expiry} value={l.lot}>{`Lote ${l.lot} · val. ${l.expiry ? fmtExpiry(l.expiry) : "?"} · ${l.quantity}`}</option>)}{allowNew && <option value={NEW}>+ Novo lote</option>}</select> : <div className="flex h-9 items-center rounded-md border border-dashed px-2 text-xs text-muted-foreground">{item ? "Sem lotes — informe um novo lote" : "Escolha o produto antes"}</div>}</F>
      <F label="Nº do novo lote"><Input aria-label="Número do novo lote" placeholder={isNew ? "Ex.: B26E0650" : "—"} disabled={!isNew} value={nl.lot} onChange={(e) => setNl({ ...nl, lot: e.target.value })} /></F>
      <F label="Validade"><Input aria-label="Validade do novo lote" type="date" disabled={!isNew} value={nl.expiry} onChange={(e) => setNl({ ...nl, expiry: e.target.value })} /></F>
      <F label={`4. Quantidade${item ? ` (${item.unit})` : ""}`}><Input aria-label="Quantidade" type="number" min="1" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} /></F>
      <Button type="button" onClick={add}>{label}</Button>
    </div>
  </div>;
}
function Lines({ items, lines, onRemove }: { items: StockMedication[]; lines: EntryLine[]; onRemove: (i: number) => void }) {
  if (!lines.length) return <p className="text-xs text-muted-foreground">Nenhum produto adicionado.</p>;
  return <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Qtde.</th><th /></tr></thead><tbody>{lines.map((l, i) => { const it = items.find((x) => x.id === l.id); return <tr key={i} className="border-t"><td className="py-1">{it?.code ? `${it.code} · ` : ""}{it?.name}</td><td className="font-mono text-xs">{l.lot}</td><td className="text-xs">{l.expiry ? fmtExpiry(l.expiry) : "—"}</td><td className="font-mono">{l.qty} {it?.unit}</td><td><Button type="button" size="sm" variant="ghost" onClick={() => onRemove(i)}>Remover</Button></td></tr>; })}</tbody></table>;
}

/** Entrada de produtos por nota fiscal (lote existente ou novo). */
export function EntryForm({ depot }: { depot: Depot }) {
  const items = useDepot(depot); const profile = useStore((s) => s.profile);
  const [nf, setNf] = useState({ number: "", supplier: "" }); const [lines, setLines] = useState<EntryLine[]>([]);
  return <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (run(() => receiveStock(depot, nf, lines), "Entrada registrada e estoque atualizado")) { setLines([]); setNf({ number: "", supplier: "" }); } }}>
    <h3 className="text-sm font-semibold">Entrada de nota fiscal · {DEPOT_LABEL[depot]}</h3>
    <div className="grid gap-2 md:grid-cols-[220px_1fr]"><F label="Nº / Série da nota fiscal"><Input aria-label="Número da NF" placeholder="Ex.: 001234 / 1" value={nf.number} onChange={(e) => setNf({ ...nf, number: e.target.value })} /></F><F label="Fornecedor"><Input aria-label="Fornecedor" placeholder="Razão social do fornecedor" value={nf.supplier} onChange={(e) => setNf({ ...nf, supplier: e.target.value })} /></F></div>
    <EntryLinePicker depot={depot} items={items} allowNew label="Adicionar item" onAdd={(l) => setLines((c) => [...c, l])} />
    <Lines items={items} lines={lines} onRemove={(i) => setLines((c) => c.filter((_, j) => j !== i))} />
    <Button type="submit" disabled={!can(profile, depotPerm(depot)) || !lines.length}>Dar entrada no estoque</Button>
  </form>;
}
const depotPerm = (d: Depot) => (d === "farmacia" ? "farmacia" : "almoxarifado") as "farmacia" | "almoxarifado";

/** Empréstimo de produtos: saída (emprestamos) ou entrada (pegamos emprestado). */
export function LoanPanel({ depot }: { depot: Depot }) {
  const items = useDepot(depot); const profile = useStore((s) => s.profile); const movements = useStore((s) => s.movements);
  const [dir, setDir] = useState<"saida" | "entrada">("saida");
  const due0 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const [f, setF] = useState({ partner: "", due: due0 }); const [lines, setLines] = useState<EntryLine[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const name = DEPOT_LABEL[depot]; const allowed = can(profile, depotPerm(depot));
  const loans = movements.filter((m) => m.kind.startsWith("emprestimo") && (m.from === name || m.to === name));
  return <div className="space-y-3"><form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (run(() => registerLoan(depot, dir, f.partner, f.due, lines), dir === "saida" ? "Saída por empréstimo registrada" : "Entrada por empréstimo registrada")) { setLines([]); setF({ partner: "", due: due0 }); } }}>
    <div className="flex gap-2"><Button type="button" size="sm" variant={dir === "saida" ? "default" : "outline"} onClick={() => { setDir("saida"); setLines([]); }}>Saída via empréstimo</Button><Button type="button" size="sm" variant={dir === "entrada" ? "default" : "outline"} onClick={() => { setDir("entrada"); setLines([]); }}>Entrada via empréstimo</Button></div>
    <div className="grid gap-2 md:grid-cols-[1fr_200px]"><Input aria-label={dir === "saida" ? "Emprestado para" : "Emprestado por"} placeholder={dir === "saida" ? "Emprestado para (instituição / setor)" : "Emprestado por (instituição / setor)"} value={f.partner} onChange={(e) => setF({ ...f, partner: e.target.value })} /><Input aria-label="Data de devolução" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
    <EntryLinePicker key={dir} items={items} allowNew={dir === "entrada"} label="Adicionar item" onAdd={(l) => setLines((c) => [...c, l])} />
    <Lines items={items} lines={lines} onRemove={(i) => setLines((c) => c.filter((_, j) => j !== i))} />
    <Button type="submit" disabled={!allowed || !lines.length}>{dir === "saida" ? "Registrar saída (baixa no estoque)" : "Registrar entrada (soma no estoque)"}</Button>
  </form>
  <h3 className="text-sm font-semibold">Empréstimos</h3>
  {loans.length ? <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Nº</th><th className="p-2">Tipo</th><th className="p-2">Produto</th><th className="p-2">Lote</th><th className="p-2">Qtde.</th><th className="p-2">Devolvida</th><th className="p-2">Pendente</th><th className="p-2">Com</th><th className="p-2">Devolução</th><th className="p-2">Situação</th></tr></thead><tbody>{loans.map((m) => {
    const out = m.kind === "emprestimo_saida"; const returned = loanReturnedQty(m); const pending = m.qty - returned;
    const late = pending > 0 && m.due && m.due < new Date().toISOString().slice(0, 10);
    return <tr key={m.id} className="border-t"><td className="p-2 text-xs">{m.doc}</td><td className="p-2 text-xs">{out ? "Saída" : "Entrada"}</td><td className="p-2">{m.item}</td><td className="p-2 font-mono text-xs">{m.lot}</td><td className="p-2 font-mono">{m.qty}</td><td className="p-2 font-mono">{returned}</td><td className="p-2 font-mono">{pending}</td><td className="p-2 text-xs">{out ? m.to : m.from}</td><td className={cn("p-2 text-xs", late && "font-semibold text-destructive")}>{m.due ? fmtExpiry(m.due) : "—"}</td><td className="p-2 text-xs">
      {pending === 0 ? `Devolvido ${m.settledAt ? new Date(m.settledAt).toLocaleDateString("pt-BR") : ""}` : <form className="flex min-w-52 flex-wrap items-end gap-2" onSubmit={(e) => {
        e.preventDefault(); const qty = Number(returnQty[m.id] ?? "");
        if (!(qty > 0) || !Number.isInteger(qty) || qty > pending) { toast.error(`Informe uma quantidade inteira entre 1 e ${pending}.`); return; }
        if (window.confirm(out ? `Confirmar recebimento de ${qty}? Será somado ao estoque.` : `Confirmar devolução de ${qty}? Será baixado do estoque.`)) {
          if (run(() => settleLoan(depot, m.id, qty), "Quantidade devolvida registrada e estoque atualizado")) setReturnQty((c) => ({ ...c, [m.id]: "" }));
        }
      }}><label className="space-y-1">Quantidade devolvida<Input aria-label={`Quantidade devolvida de ${m.item}, lote ${m.lot}`} type="number" min="1" max={pending} step="1" required disabled={!allowed} className="w-28" value={returnQty[m.id] ?? ""} onChange={(e) => setReturnQty((c) => ({ ...c, [m.id]: e.target.value }))} /></label><Button type="submit" size="sm" variant="outline" disabled={!allowed}>{out ? "Recebi de volta" : "Devolvi"}</Button></form>}
      {m.returns?.map((r, i) => <div key={i} className="mt-1 text-muted-foreground">{r.qty} devolvida(s) · {new Date(r.at).toLocaleString("pt-BR")} · {r.by}</div>)}
    </td></tr>;
  })}</tbody></table></div> : <p className="text-sm text-muted-foreground">Nenhum empréstimo registrado.</p>}
  </div>;
}
