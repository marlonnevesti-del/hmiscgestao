import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Letterhead } from "@/components/DischargePrint";
import { printProcedure } from "@/components/ProcedurePrint";
import { useStore } from "@/lib/hospital-store";
import type { Patient } from "@/lib/hospital-data";

export interface SbarTransferData {
  originSector: string; destSector: string; wristband: string; companion: string;
  reason: string; comorbidities: string;
  pa: string; fr: string; fc: string; tax: string; spo2: string; hgt: string; hgtNa: boolean;
  allergy: string; allergyText: string;
  devices: string[]; feeding: string[];
  dressing: string; dressingLocal: string;
  precaution: string;
  skinLesion: string; skinLesionLocal: string;
  transport: string;
  events: string[];
  deliveryWay: string; apgar: string; vaccineCard: string;
  risks: string[];
  exams: string[]; examsDetail: string;
  recommendations: string[]; fastingFrom: string;
  personalMeds: string;
  observations: string;
}

const DEVICES = ["Acesso Venoso", "SVD", "Dreno", "Traqueostomia", "TOT", "Ostomia", "Cateter Nasal", "BIPAP", "CPAP", "PICC", "AVC", "AVP", "Outros", "Não se aplica"];
const FEEDING = ["Via Oral", "SNG", "SNE", "NPT", "Seio Materno", "NPO", "Gastrostomia", "Outros"];
const EVENTS = ["Hipotermia", "Hipertermia", "Hipoglicemia", "Hiperglicemia", "Hemorragia Puerperal", "Hipotensão", "Hipertensão", "Broncoaspiração", "PCR", "Outros", "Não se aplica"];
const RISKS = ["Queda", "Lesão por Pressão", "Flebite", "Broncoaspiração", "Evasão", "Outros", "Não se aplica"];
const EXAMS = ["Programado", "Aguardando resultado", "Não se aplica"];
const RECS = ["Repouso absoluto no leito", "Estimular deambulação", "Jejum a partir de", "Outros"];

export function formatSbarTransferText(d: SbarTransferData): string {
  const vitals = [`PA ${d.pa || "—"}`, `FR ${d.fr || "—"}`, `FC ${d.fc || "—"}`, `TAX ${d.tax || "—"}`, `SpO2 ${d.spo2 || "—"}`, d.hgtNa ? "HGT N/A" : `HGT ${d.hgt || "—"}`].join(" · ");
  return [
    `SBAR – TRANSFERÊNCIA INTRA-SETORIAL (${d.originSector || "—"} → ${d.destSector || "—"})`,
    `Pulseira: ${d.wristband} · Acompanhante: ${d.companion}`,
    `S – Situação: Motivo: ${d.reason || "—"} | Comorbidades: ${d.comorbidities || "Nega"} | Sinais: ${vitals} | Alergia: ${d.allergy}${d.allergy === "Sim" && d.allergyText ? ` (${d.allergyText})` : ""}`,
    `Dispositivos: ${d.devices.join(", ") || "Não se aplica"} | Alimentação: ${d.feeding.join(", ") || "—"} | Curativos: ${d.dressing}${d.dressing === "Sim" && d.dressingLocal ? ` (${d.dressingLocal})` : ""} | Precaução: ${d.precaution} | Lesões: ${d.skinLesion}${d.skinLesion === "Sim" && d.skinLesionLocal ? ` (${d.skinLesionLocal})` : ""} | Transporte: ${d.transport}`,
    `B – Histórico: Intercorrências: ${d.events.join(", ") || "Não se aplica"} | Via parto: ${d.deliveryWay}${d.apgar ? ` | APGAR: ${d.apgar}` : ""} | Caderneta vacinação: ${d.vaccineCard}`,
    `A – Riscos: ${d.risks.join(", ") || "Não se aplica"}`,
    `R – Recomendações: Exames: ${d.exams.join(", ") || "Não se aplica"}${d.examsDetail ? ` (${d.examsDetail})` : ""} | Condutas: ${d.recommendations.join(", ") || "—"}${d.fastingFrom ? ` (Jejum ${d.fastingFrom})` : ""} | Med. uso pessoal: ${d.personalMeds}`,
    d.observations ? `Observações: ${d.observations}` : "",
  ].filter(Boolean).join("\n");
}

function toggleList(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function SbarTransferForm({ patient, defaultOrigin, disabled, onSave }: {
  patient?: Patient | undefined; defaultOrigin: string; disabled?: boolean; onSave: (text: string) => void;
}) {
  const author = useStore((s) => s.employeeName);
  const v = patient?.vitals.at(-1);
  const [printing, setPrinting] = useState(false);
  const [d, setD] = useState<SbarTransferData>(() => ({
    originSector: defaultOrigin, destSector: "", wristband: "Sim", companion: "Sim",
    reason: patient?.diagnosis || "", comorbidities: "Nega",
    pa: v ? `${v.pas} x ${v.pad}` : "", fr: v ? String(v.fr) : "", fc: v ? String(v.fc) : "",
    tax: v ? String(v.tax) : "", spo2: v ? String(v.sat) : "", hgt: "", hgtNa: true,
    allergy: patient?.allergies.length ? "Sim" : "Não", allergyText: patient?.allergies.join(", ") ?? "",
    devices: [], feeding: [],
    dressing: "Não", dressingLocal: "", precaution: "Padrão",
    skinLesion: "Não", skinLesionLocal: "", transport: "Maca",
    events: ["Não se aplica"], deliveryWay: "Não se aplica", apgar: "", vaccineCard: "Não se aplica",
    risks: [], exams: ["Não se aplica"], examsDetail: "",
    recommendations: [], fastingFrom: "", personalMeds: "Não se aplica", observations: "",
  }));

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    printProcedure();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const set = <K extends keyof SbarTransferData>(k: K, val: SbarTransferData[K]) => setD((c) => ({ ...c, [k]: val }));
  const Checks = ({ items, val, field }: { items: string[]; val: string[]; field: "devices" | "feeding" | "events" | "risks" | "exams" | "recommendations" }) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1">{items.map((it) => (
      <label key={it} className="flex cursor-pointer items-center gap-1 text-xs">
        <input type="checkbox" checked={val.includes(it)} onChange={() => set(field, toggleList(val, it))} />{it}
      </label>
    ))}</div>
  );
  const Radios = ({ opts, val, field }: { opts: string[]; val: string; field: keyof SbarTransferData }) => (
    <div className="flex flex-wrap gap-3">{opts.map((o) => (
      <label key={o} className="flex cursor-pointer items-center gap-1 text-xs">
        <input type="radio" checked={val === o} onChange={() => set(field, o as never)} />{o}
      </label>
    ))}</div>
  );

  return <div className="space-y-3 rounded-md border bg-background p-3 text-xs">
    <div className="font-semibold text-sm">SBAR – Transferência Intra-Setorial</div>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1">Setor de Origem<Input className="h-8 text-xs" value={d.originSector} onChange={(e) => set("originSector", e.target.value)} /></label>
      <label className="grid gap-1">Setor de Destino<Input className="h-8 text-xs" placeholder="Ex.: Internação Pediátrica, UTI..." value={d.destSector} onChange={(e) => set("destSector", e.target.value)} /></label>
      <div className="flex items-center gap-2"><span className="font-medium">Pulseira de identificação:</span><Radios opts={["Sim", "Não"]} val={d.wristband} field="wristband" /></div>
      <div className="flex items-center gap-2"><span className="font-medium">Possui acompanhante:</span><Radios opts={["Sim", "Não"]} val={d.companion} field="companion" /></div>
    </div>

    <div className="border-t pt-2 font-semibold">S – Situação Clínica</div>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1">01. Motivo da internação<Input className="h-8 text-xs" value={d.reason} onChange={(e) => set("reason", e.target.value)} /></label>
      <label className="grid gap-1">02. Comorbidades<Input className="h-8 text-xs" value={d.comorbidities} onChange={(e) => set("comorbidities", e.target.value)} /></label>
    </div>
    <div>
      <div className="mb-1 font-medium">03. Sinais Vitais</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Input className="h-8 text-xs" placeholder="PA" value={d.pa} onChange={(e) => set("pa", e.target.value)} />
        <Input className="h-8 text-xs" placeholder="FR" value={d.fr} onChange={(e) => set("fr", e.target.value)} />
        <Input className="h-8 text-xs" placeholder="FC" value={d.fc} onChange={(e) => set("fc", e.target.value)} />
        <Input className="h-8 text-xs" placeholder="TAX" value={d.tax} onChange={(e) => set("tax", e.target.value)} />
        <Input className="h-8 text-xs" placeholder="SpO2" value={d.spo2} onChange={(e) => set("spo2", e.target.value)} />
        <Input className="h-8 text-xs" placeholder="HGT" disabled={d.hgtNa} value={d.hgt} onChange={(e) => set("hgt", e.target.value)} />
      </div>
      <label className="mt-1 inline-flex cursor-pointer items-center gap-1"><input type="checkbox" checked={d.hgtNa} onChange={(e) => set("hgtNa", e.target.checked)} />HGT não se aplica</label>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium">04. Alergia:</span><Radios opts={["Sim", "Não"]} val={d.allergy} field="allergy" />
      {d.allergy === "Sim" && <Input className="h-7 w-48 text-xs" placeholder="Quais alergias?" value={d.allergyText} onChange={(e) => set("allergyText", e.target.value)} />}
    </div>
    <div><div className="mb-1 font-medium">05. Dispositivos</div><Checks items={DEVICES} val={d.devices} field="devices" /></div>
    <div><div className="mb-1 font-medium">06. Via de alimentação</div><Checks items={FEEDING} val={d.feeding} field="feeding" /></div>
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="space-y-1"><span className="font-medium">07. Curativos:</span><Radios opts={["Sim", "Não"]} val={d.dressing} field="dressing" />{d.dressing === "Sim" && <Input className="h-7 text-xs" placeholder="Local" value={d.dressingLocal} onChange={(e) => set("dressingLocal", e.target.value)} />}</div>
      <label className="grid gap-1">08. Precauções/Isolamento<select className="h-8 rounded border bg-background px-2 text-xs" value={d.precaution} onChange={(e) => set("precaution", e.target.value)}>{["Padrão", "Contato", "Gotículas", "Aerossóis"].map((p) => <option key={p}>{p}</option>)}</select></label>
      <div className="space-y-1"><span className="font-medium">09. Lesões cutâneas:</span><Radios opts={["Sim", "Não"]} val={d.skinLesion} field="skinLesion" />{d.skinLesion === "Sim" && <Input className="h-7 text-xs" placeholder="Local" value={d.skinLesionLocal} onChange={(e) => set("skinLesionLocal", e.target.value)} />}</div>
    </div>
    <label className="grid gap-1 sm:max-w-xs">10. Transporte<select className="h-8 rounded border bg-background px-2 text-xs" value={d.transport} onChange={(e) => set("transport", e.target.value)}>{["Maca", "Cadeira de rodas", "Deambulando", "Berço/Berço Aquecido", "Incubadora de Transporte"].map((t) => <option key={t}>{t}</option>)}</select></label>

    <div className="border-t pt-2 font-semibold">B – Breve Histórico</div>
    <div><div className="mb-1 font-medium">10. Intercorrências clínicas</div><Checks items={EVENTS} val={d.events} field="events" /></div>
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="space-y-1"><span className="font-medium">11. Via de parto:</span><Radios opts={["Vaginal", "Cesárea", "Não se aplica"]} val={d.deliveryWay} field="deliveryWay" /></div>
      <label className="grid gap-1">12. APGAR<Input className="h-8 text-xs" placeholder="Se aplicável" value={d.apgar} onChange={(e) => set("apgar", e.target.value)} /></label>
      <div className="space-y-1"><span className="font-medium">13. Caderneta de vacinação:</span><Radios opts={["Sim", "Não", "Não se aplica"]} val={d.vaccineCard} field="vaccineCard" /></div>
    </div>

    <div className="border-t pt-2 font-semibold">A – Avaliação / Riscos</div>
    <div><div className="mb-1 font-medium">14. Riscos</div><Checks items={RISKS} val={d.risks} field="risks" /></div>

    <div className="border-t pt-2 font-semibold">R – Recomendações</div>
    <div className="space-y-1">
      <div className="font-medium">15. Exames</div><Checks items={EXAMS} val={d.exams} field="exams" />
      <Input className="h-8 text-xs" placeholder="Quais exames / horários?" value={d.examsDetail} onChange={(e) => set("examsDetail", e.target.value)} />
    </div>
    <div className="space-y-1">
      <div className="font-medium">16. Recomenda-se</div><Checks items={RECS} val={d.recommendations} field="recommendations" />
      {d.recommendations.includes("Jejum a partir de") && <Input className="h-8 max-w-xs text-xs" placeholder="Jejum a partir de (ex.: 08:00)" value={d.fastingFrom} onChange={(e) => set("fastingFrom", e.target.value)} />}
    </div>
    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">17. Medicações de uso pessoal entregues ao paciente/responsável:</span><Radios opts={["Não", "Sim", "Não se aplica"]} val={d.personalMeds} field="personalMeds" /></div>
    <label className="grid gap-1">Observações<Textarea className="min-h-16 text-xs" placeholder="Ex.: HEV, antibióticos, NPO..." value={d.observations} onChange={(e) => set("observations", e.target.value)} /></label>

    <div className="flex flex-wrap gap-2 pt-1">
      <Button type="button" size="sm" disabled={disabled} onClick={() => onSave(formatSbarTransferText(d))}>Salvar SBAR</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setPrinting(true)}><Printer className="mr-1 h-4 w-4" />Imprimir / PDF</Button>
    </div>

    {printing && typeof document !== "undefined" ? createPortal(<div className="print-doc-root proc-root">
      <section className="doc-page space-y-2 text-xs">
        <Letterhead title="SBAR – TRANSFERÊNCIA INTRA-SETORIAL" />
        <div className="grid grid-cols-2 gap-1 rounded border p-2">
          <div><b>Paciente:</b> {patient?.name || "—"}</div>
          <div><b>Data de Nascimento:</b> {patient?.registration?.birthDate || "—"}</div>
          <div><b>Nome da Mãe:</b> {patient?.motherName || "—"}</div>
          <div><b>Setor de Origem:</b> {d.originSector || "—"}</div>
          <div><b>Setor de Destino:</b> {d.destSector || "—"}</div>
          <div><b>Pulseira:</b> {d.wristband} · <b>Acompanhante:</b> {d.companion}</div>
        </div>
        <div className="font-bold uppercase">S – Situação Clínica</div>
        <p><b>01. Motivo da internação:</b> {d.reason || "—"} · <b>02. Comorbidades:</b> {d.comorbidities || "Nega"}</p>
        <p><b>03. Sinais Vitais:</b> PA {d.pa || "—"} · FR {d.fr || "—"} · FC {d.fc || "—"} · TAX {d.tax || "—"} · SpO2 {d.spo2 || "—"} · HGT {d.hgtNa ? "Não se aplica" : d.hgt || "—"}</p>
        <p><b>04. Alergia:</b> {d.allergy}{d.allergy === "Sim" && d.allergyText ? ` (${d.allergyText})` : ""}</p>
        <p><b>05. Dispositivos:</b> {d.devices.join(", ") || "Não se aplica"}</p>
        <p><b>06. Via de alimentação:</b> {d.feeding.join(", ") || "—"}</p>
        <p><b>07. Curativos:</b> {d.dressing}{d.dressing === "Sim" && d.dressingLocal ? ` (${d.dressingLocal})` : ""} · <b>08. Precauções/Isolamento:</b> {d.precaution} · <b>09. Lesões cutâneas:</b> {d.skinLesion}{d.skinLesion === "Sim" && d.skinLesionLocal ? ` (${d.skinLesionLocal})` : ""} · <b>10. Transporte:</b> {d.transport}</p>
        <div className="font-bold uppercase">B – Breve Histórico</div>
        <p><b>10. Intercorrências clínicas:</b> {d.events.join(", ") || "Não se aplica"}</p>
        <p><b>11. Via de parto:</b> {d.deliveryWay} · <b>12. APGAR:</b> {d.apgar || "—"} · <b>13. Caderneta de vacinação:</b> {d.vaccineCard}</p>
        <div className="font-bold uppercase">A – Avaliação</div>
        <p><b>14. Riscos:</b> {d.risks.join(", ") || "Não se aplica"}</p>
        <div className="font-bold uppercase">R – Recomendações</div>
        <p><b>15. Exames:</b> {d.exams.join(", ") || "Não se aplica"}{d.examsDetail ? ` · Quais: ${d.examsDetail}` : ""}</p>
        <p><b>16. Recomenda-se:</b> {d.recommendations.join(", ") || "—"}{d.fastingFrom ? ` (Jejum a partir de ${d.fastingFrom})` : ""}</p>
        <p><b>17. Medicações de uso pessoal entregues ao paciente/responsável:</b> {d.personalMeds}</p>
        {d.observations && <p className="whitespace-pre-wrap"><b>Observações:</b> {d.observations}</p>}
        <div className="mt-8 flex justify-between pt-4 text-center">
          <div>Criciúma, {new Date().toLocaleDateString("pt-BR")}</div>
          <div className="border-t px-8 pt-1">{author}</div>
        </div>
      </section>
    </div>, document.body) : null}
  </div>;
}