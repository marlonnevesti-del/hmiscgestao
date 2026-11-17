import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScan } from "@/components/BarcodeScan";
import { LabelPrint, printLabels, type CmeLabel } from "@/components/LabelPrint";
import { AUTOCLAVES, findKit, kitBarcode, type CmeKit, type KitStatus } from "@/lib/cme";
import { createCmeKit, moveCmeKit, runCmeCycle, setCmeBio, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cme")({
  head: () => ({ meta: [
    { title: "CME – Central de Material e Esterilização – HMI Gestão" },
    { name: "description", content: "Arsenal de caixas cirúrgicas, ciclos de autoclave, indicadores e etiquetas com código de barras." },
    { property: "og:title", content: "CME – Esterilização – HMI Gestão" },
    { property: "og:description", content: "Rastreabilidade de caixas e ciclos de autoclave." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Cme,
});

const CLS: Record<KitStatus, string> = { Sujo: "bg-destructive/15 text-destructive", Preparo: "bg-secondary text-secondary-foreground", Esterilizando: "bg-mt-yellow text-foreground", Pronto: "bg-bed-free text-primary-foreground", "Em uso": "bg-maternal text-primary-foreground", Bloqueado: "bg-destructive text-destructive-foreground" };
const d = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const run = (fn: () => void, ok?: string) => { try { fn(); if (ok) toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); } };

function Cme() {
  const kits = useStore((s) => s.cmeKits);
  const cycles = useStore((s) => s.cmeCycles);
  const employee = useStore((s) => s.employeeName);
  const [label, setLabel] = useState<CmeLabel | null>(null);
  const [q, setQ] = useState("");
  const print = (k: CmeKit) => {
    const c = cycles.find((x) => x.id === k.cycleId);
    if (!c || k.status !== "Pronto") { toast.error("Só caixas esterilizadas e prontas geram etiqueta."); return; }
    setLabel({ kind: "cme", name: k.name, autoclave: c.autoclave, cycle: c.number, date: `${d(c.at)} ${new Date(c.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, expiry: d(k.expiresAt), by: c.by || employee, barcode: kitBarcode(k, c), copies: 1 });
    printLabels();
  };
  const shown = kits.filter((k) => !q || `${k.code} ${k.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">CME – Central de Material e Esterilização</h1><p className="text-sm text-muted-foreground">{kits.filter((k) => k.status === "Pronto").length} caixas prontas · {cycles.length} ciclos registrados</p></div>
      <Tabs defaultValue="arsenal">
        <TabsList><TabsTrigger value="arsenal">1. Arsenal de caixas</TabsTrigger><TabsTrigger value="ciclo">2. Novo ciclo / Autoclave</TabsTrigger><TabsTrigger value="bio">3. Indicadores & Biológico</TabsTrigger><TabsTrigger value="rastreio">4. Rastreio por código</TabsTrigger></TabsList>
        <TabsContent value="arsenal" className="space-y-3">
          <div className="flex flex-wrap gap-2"><Input placeholder="Buscar caixa" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" /><NewKit /></div>
          <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs"><tr><th className="p-2">Código</th><th className="p-2">Caixa</th><th className="p-2">Local</th><th className="p-2">Status</th><th className="p-2">Esterilizado</th><th className="p-2">Validade</th><th className="p-2">Ações</th></tr></thead><tbody>
            {shown.map((k) => { const expired = !!k.expiresAt && k.expiresAt < new Date().toISOString(); return <tr key={k.id} className="border-t"><td className="p-2 font-mono text-xs">{k.code}</td><td className="p-2">{k.name}</td><td className="p-2 text-xs">{k.location}</td><td className="p-2"><span className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", CLS[k.status])}>{expired && k.status === "Pronto" ? "VENCIDA" : k.status}</span></td><td className="p-2 text-xs">{d(k.sterilizedAt)}</td><td className={cn("p-2 text-xs", expired && "font-semibold text-destructive")}>{d(k.expiresAt)}</td>
              <td className="flex flex-wrap gap-1 p-2">
                {k.status === "Sujo" && <Button size="sm" variant="outline" onClick={() => run(() => moveCmeKit(k.id, "Preparo", "Preparo CME"), "Enviada ao preparo")}>Lavada → Preparo</Button>}
                {(k.status === "Em uso" || k.status === "Bloqueado" || (k.status === "Pronto" && expired)) && <Button size="sm" variant="outline" onClick={() => run(() => moveCmeKit(k.id, "Sujo", "Expurgo CME"), "Recebida no expurgo")}>Receber no expurgo</Button>}
                {k.status === "Pronto" && !expired && <Button size="sm" variant="outline" onClick={() => print(k)}>Etiqueta</Button>}
              </td></tr>; })}
          </tbody></table></div>
        </TabsContent>
        <TabsContent value="ciclo"><NewCycle kits={kits} /></TabsContent>
        <TabsContent value="bio" className="space-y-2">
          {!cycles.length && <p className="text-sm text-muted-foreground">Nenhum ciclo registrado.</p>}
          {[...cycles].reverse().map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
            <div><b>Ciclo {c.number}</b> · {c.autoclave} · {c.temperature}°C / {c.minutes} min · {new Date(c.at).toLocaleString("pt-BR")}<div className="text-xs text-muted-foreground">Químico: {c.chemical} · Resp.: {c.by} · {c.kitIds.length} caixa(s): {c.kitIds.map((id) => kits.find((k) => k.id === id)?.name ?? id).join(", ")}</div></div>
            <div className="flex items-center gap-1 text-xs">Biológico: {(["Pendente", "Aprovado", "Reprovado"] as const).map((b) => <Button key={b} size="sm" variant={c.bio === b ? (b === "Reprovado" ? "destructive" : "default") : "outline"} onClick={() => run(() => setCmeBio(c.id, b), b === "Reprovado" ? "Caixas do ciclo bloqueadas" : `Biológico: ${b}`)}>{b}</Button>)}</div>
          </div>)}
        </TabsContent>
        <TabsContent value="rastreio"><Trace /></TabsContent>
      </Tabs>
      <LabelPrint label={label} />
    </div>
  );
}

function NewKit() {
  const [f, setF] = useState({ code: "", name: "", items: "", days: "30" });
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>+ Cadastrar caixa</Button>;
  return <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
    <label className="text-xs">Código *<Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CX-LAP-01" className="w-32" /></label>
    <label className="text-xs">Nome *<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-56" /></label>
    <label className="flex-1 text-xs">Peças / instrumental<Input value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} /></label>
    <label className="text-xs">Validade (dias)<Input type="number" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} className="w-24" /></label>
    <Button onClick={() => run(() => { createCmeKit(f.code, f.name, f.items, Number(f.days)); setOpen(false); setF({ code: "", name: "", items: "", days: "30" }); }, "Caixa cadastrada")}>Salvar</Button>
  </div>;
}

function NewCycle({ kits }: { kits: CmeKit[] }) {
  const [f, setF] = useState({ autoclave: AUTOCLAVES[0]!, load: "Instrumental metálico", temperature: "134", minutes: "15", chemical: "Aprovado" as "Aprovado" | "Reprovado" });
  const [sel, setSel] = useState<string[]>([]);
  const avail = kits.filter((k) => k.status === "Preparo" || k.status === "Sujo");
  return <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
    <div className="flex flex-wrap gap-2">
      <label className="text-xs">Autoclave<select className="block h-9 rounded-md border bg-background px-2" value={f.autoclave} onChange={(e) => setF({ ...f, autoclave: e.target.value })}>{AUTOCLAVES.map((a) => <option key={a}>{a}</option>)}</select></label>
      <label className="text-xs">Tipo de carga<Input value={f.load} onChange={(e) => setF({ ...f, load: e.target.value })} className="w-52" /></label>
      <label className="text-xs">Temperatura (°C)<Input type="number" value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })} className="w-24" /></label>
      <label className="text-xs">Exposição (min)<Input type="number" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} className="w-24" /></label>
      <label className="text-xs">Indicador químico<select className="block h-9 rounded-md border bg-background px-2" value={f.chemical} onChange={(e) => setF({ ...f, chemical: e.target.value as "Aprovado" | "Reprovado" })}><option>Aprovado</option><option>Reprovado</option></select></label>
    </div>
    <div><div className="mb-1 text-xs font-semibold uppercase text-primary">Caixas desta carga</div>
      {!avail.length && <p className="text-xs text-muted-foreground">Nenhuma caixa no expurgo/preparo.</p>}
      {avail.map((k) => <label key={k.id} className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={sel.includes(k.id)} onChange={(e) => setSel(e.target.checked ? [...sel, k.id] : sel.filter((x) => x !== k.id))} />{k.name} <span className="text-xs text-muted-foreground">({k.validityDays} dias)</span></label>)}</div>
    <Button onClick={() => run(() => { const c = runCmeCycle({ autoclave: f.autoclave, load: f.load, temperature: Number(f.temperature), minutes: Number(f.minutes), chemical: f.chemical, kitIds: sel }); setSel([]); toast.success(`Ciclo ${c.number} registrado — imprima as etiquetas no Arsenal`); })}>Registrar ciclo</Button>
  </div>;
}

function Trace() {
  const kits = useStore((s) => s.cmeKits);
  const cycles = useStore((s) => s.cmeCycles);
  const patients = useStore((s) => s.patients);
  const [kit, setKit] = useState<CmeKit | null>(null);
  const cycle = cycles.find((c) => c.id === kit?.cycleId);
  return <div className="space-y-3">
    <BarcodeScan className="max-w-md" placeholder="Bipar etiqueta ou digitar código da caixa" onScan={(code) => { const k = findKit(kits, cycles, code); if (!k) toast.error("Código não encontrado"); setKit(k ?? null); }} />
    {kit && <div className="rounded-lg border bg-card p-4 text-sm">
      <b>{kit.name}</b> ({kit.code}) · {kit.status} · {kit.location}
      {cycle && <div className="text-xs">Ciclo {cycle.number} · {cycle.autoclave} · biológico {cycle.bio} · validade {d(kit.expiresAt)}</div>}
      {kit.patientId && <div className="text-xs">Paciente: {patients.find((p) => p.id === kit.patientId)?.name ?? kit.patientId}</div>}
      <div className="mt-2 text-xs font-semibold uppercase text-primary">Histórico</div>
      {[...kit.history].reverse().map((h, i) => <div key={i} className="text-xs">{new Date(h.at).toLocaleString("pt-BR")} · {h.by} · {h.note}</div>)}
    </div>}
  </div>;
}
