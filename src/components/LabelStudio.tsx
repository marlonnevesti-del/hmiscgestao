import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WARDS } from "@/lib/hospital-data";
import { internalBarcode } from "@/lib/barcode";
import { fmtExpiry, lotsByExpiry } from "@/lib/pharmacy-stock";
import { linkBarcode, useStore } from "@/lib/hospital-store";
import { LabelBody, LabelPrint, printLabels, type Label } from "./LabelPrint";

const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const now = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Área da Farmácia para montar, pré-visualizar e imprimir etiquetas avulsas. */
export function LabelStudio() {
  const stock = useStore((s) => s.stock);
  const patients = useStore((s) => s.patients);
  const employee = useStore((s) => s.employeeName);
  const [kind, setKind] = useState<"dose" | "unit">("dose");
  const [printed, setPrinted] = useState<Label | null>(null);
  const [search, setSearch] = useState("");
  const [itemId, setItemId] = useState("");
  const [lot, setLot] = useState("");
  const [copies, setCopies] = useState("1");
  const [patientId, setPatientId] = useState("");
  const [d, setD] = useState({ patient: "", bed: "", sector: "", drug: "", quantity: "", route: "VO", time: now(), validity: "24H", diluent: "" });
  const set = (k: keyof typeof d, v: string) => setD((c) => ({ ...c, [k]: v }));

  const matches = useMemo(() => { const q = search.trim().toLowerCase(); return (q ? stock.filter((i) => i.name.toLowerCase().includes(q) || (i.code ?? "").includes(q)) : stock).slice(0, 80); }, [stock, search]);
  const item = stock.find((i) => i.id === itemId);
  const lots = lotsByExpiry(item);
  const chosenLot = item?.lots?.find((l) => l.lot === lot);

  const pickItem = (id: string) => { setItemId(id); const it = stock.find((i) => i.id === id); const ls = lotsByExpiry(it); setLot(ls.length === 1 ? ls[0]!.lot : ""); if (it) set("drug", it.name); };
  const pickPatient = (id: string) => { setPatientId(id); const p = patients.find((x) => x.id === id); if (p) setD((c) => ({ ...c, patient: p.name, bed: p.bed ?? "", sector: WARDS.find((w) => w.id === p.ward)?.name ?? String(p.ward ?? "") })); };

  const n = Math.max(1, Math.min(200, Number(copies) || 1));
  const preview: Label = kind === "dose"
    ? { kind: "dose", ...d, copies: n }
    : { kind: "unit", name: item?.name ?? "", lot: chosenLot?.lot ?? lot, expiry: chosenLot ? fmtExpiry(chosenLot.expiry) : "", barcode: chosenLot?.barcode ?? item?.barcodes?.[0] ?? "", pharmacist: employee, copies: n };

  const print = () => {
    let label = preview;
    if (label.kind === "dose") { if (!d.patient || !d.drug || !d.quantity) { toast.error("Preencha paciente, medicamento e quantidade"); return; } }
    else {
      if (!item) { toast.error("Escolha o produto"); return; }
      if (lots.length > 1 && !lot) { toast.error("Escolha o lote"); return; }
      if (!label.barcode) { const code = internalBarcode(item.code ?? "", Date.now() % 100000); try { linkBarcode("stock", item.id, code, chosenLot?.lot); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); return; } label = { ...label, barcode: code }; }
    }
    setPrinted(label); printLabels();
  };

  const productPicker = <div className="grid gap-2 sm:grid-cols-2">
    <label className="grid gap-1 text-xs">Buscar produto<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou código" /></label>
    <label className="grid gap-1 text-xs">Produto<select className={sel} value={itemId} onChange={(e) => pickItem(e.target.value)}><option value="">Selecione…</option>{matches.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
  </div>;

  return <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
    <section className="space-y-4">
      <div className="flex gap-2"><Button variant={kind === "dose" ? "default" : "outline"} onClick={() => setKind("dose")}>Dose oral / gotas / seringa</Button><Button variant={kind === "unit" ? "default" : "outline"} onClick={() => setKind("unit")}>Frasco / ampola (código de barras)</Button></div>
      {kind === "dose" ? <div className="space-y-3">
        <label className="grid gap-1 text-xs">Paciente internado (opcional)<select className={sel} value={patientId} onChange={(e) => pickPatient(e.target.value)}><option value="">Digitar manualmente…</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.bed ? ` · ${p.bed}` : ""}</option>)}</select></label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs sm:col-span-3">Nome do paciente *<Input value={d.patient} onChange={(e) => set("patient", e.target.value)} /></label>
          <label className="grid gap-1 text-xs">Leito<Input value={d.bed} onChange={(e) => set("bed", e.target.value)} /></label>
          <label className="grid gap-1 text-xs sm:col-span-2">Setor<Input value={d.sector} onChange={(e) => set("sector", e.target.value)} /></label>
        </div>
        {productPicker}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs sm:col-span-3">Medicamento *<Input value={d.drug} onChange={(e) => set("drug", e.target.value)} /></label>
          <label className="grid gap-1 text-xs">Quantidade * (mL ou gotas)<Input value={d.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="1,1 ML / 10 GTS" /></label>
          <label className="grid gap-1 text-xs">Via<select className={sel} value={d.route} onChange={(e) => set("route", e.target.value)}>{["VO", "SNG", "SL", "EV", "IM", "SC", "INAL", "TÓPICA"].map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Validade<Input value={d.validity} onChange={(e) => set("validity", e.target.value)} /></label>
          <label className="grid gap-1 text-xs">Horário<Input value={d.time} onChange={(e) => set("time", e.target.value)} /></label>
          <label className="grid gap-1 text-xs">Diluente (vazio se não houver)<Input value={d.diluent} onChange={(e) => set("diluent", e.target.value)} placeholder="0,5 ML AD" /></label>
          <label className="grid gap-1 text-xs">Nº de etiquetas<Input type="number" min={1} value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
        </div>
      </div> : <div className="space-y-3">
        {productPicker}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">Lote{lots.length ? <select className={sel} value={lot} onChange={(e) => setLot(e.target.value)}><option value="">Selecione (vence primeiro no topo)</option>{lots.map((l) => <option key={l.lot + l.expiry} value={l.lot}>{`${l.lot} · val. ${fmtExpiry(l.expiry)} · ${l.quantity}`}</option>)}</select> : <Input value={lot} onChange={(e) => setLot(e.target.value)} />}</label>
          <label className="grid gap-1 text-xs">Nº de etiquetas<Input type="number" min={1} value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Se o produto ainda não tiver código de barras, o sistema cria um código interno ao imprimir.</p>
      </div>}
      <Button onClick={print}>Imprimir {n} etiqueta{n > 1 ? "s" : ""}</Button>
    </section>
    <aside className="space-y-2">
      <h3 className="text-sm font-semibold">Pré-visualização (50 × 30 mm)</h3>
      <div aria-label="Pré-visualização da etiqueta" className="overflow-hidden rounded border bg-card p-2 text-card-foreground shadow-sm [&_svg]:mt-1 [&_svg]:h-12 [&_svg]:max-w-full" style={{ width: "50mm", height: "30mm", fontSize: "7pt", lineHeight: 1.25, fontFamily: "Arial, sans-serif", transform: "scale(1.6)", transformOrigin: "top left", marginBottom: "18mm", marginRight: "30mm" }}><LabelBody label={preview} /></div>
    </aside>
    <LabelPrint label={printed} />
  </div>;
}
