import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CallPanelButton } from "./CallPanelButton";
import { canAct, type Patient } from "@/lib/hospital-data";
import { completeAmbulatoryNursing, useStore } from "@/lib/hospital-store";
import type { Encounter } from "@/lib/care-flow";
import { needsNursingPreConsult } from "@/lib/ambulatorio";

const FIELDS = [["pas", "PAS"], ["pad", "PAD"], ["fc", "FC"], ["fr", "FR"], ["tax", "Temp."], ["sat", "SpO₂"], ["peso", "Peso (kg)"], ["altura", "Altura (cm)"]] as const;

/** Ambulatório: pré-consulta de enfermagem com sinais vitais e evolução registrada no PEP. */
export function AmbulatoryNursing() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const list = encounters.filter((e) => needsNursingPreConsult(e) && e.status_fluxo !== "ALTA_HOSPITALAR" && !String(e.status_fluxo).startsWith("INTERNA"));
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Pré-consulta de enfermagem · {list.length} paciente(s) · atendimentos obstétricos ou marcados para pré-consulta no cadastro/agenda</p>
    {list.length === 0 ? <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum paciente aguardando.</p>
      : list.map((e) => { const p = patients.find((x) => x.id === e.patientId); return p ? <NursingCard key={e.id} encounter={e} patient={p} /> : null; })}
  </div>;
}

function NursingCard({ encounter, patient }: { encounter: Encounter; patient: Patient }) {
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  const allowed = canAct(profile, "checar", areas) || canAct(profile, "triagem", areas);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const done = patient.evolutions.some((x) => x.cat === "Enfermagem" && x.text.startsWith(`Pré-consulta ${encounter.number}`));
  const save = () => {
    if (!text.trim()) { toast.error("Digite a evolução de enfermagem."); return; }
    if (!window.confirm(`Confirmar registro da pré-consulta de ${patient.name}?`)) return;
    const n = (k: string) => Number((v[k] ?? "").replace(",", ".")) || 0;
    const sv = FIELDS.filter(([k]) => v[k]).map(([k, l]) => `${l}: ${v[k]}`).join(" · ");
    try {
      completeAmbulatoryNursing(encounter.id, {
        ...(sv ? { vitals: { pas: n("pas"), pad: n("pad"), fc: n("fc"), fr: n("fr"), tax: n("tax"), sat: n("sat") }, summary: sv } : {}),
        ...(n("peso") > 0 ? { weight: n("peso") } : {}),
        ...(n("altura") > 0 ? { height: n("altura") } : {}),
        text,
      });
      setText(""); setV({}); setOpen(false);
      toast.success("Pré-consulta finalizada e paciente liberado para o consultório médico");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível finalizar a pré-consulta");
    }
  };
  return <div className="rounded-xl border bg-card p-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1"><div className="font-medium">{patient.name} <span className="text-xs text-muted-foreground">{patient.age}</span></div><div className="text-xs text-muted-foreground">{encounter.number} · {encounter.complaint}{encounter.status_fluxo === "AGUARDANDO_TRIAGEM" ? " · aguardando enfermagem (médico ainda não alertado)" : done ? " · encaminhado ao consultório" : ""}</div></div>
      {allowed && <CallPanelButton patientId={patient.id} fixedRoom="Enfermagem" />}
      <Button size="sm" disabled={!allowed} onClick={() => setOpen((o) => !o)}>{open ? "Fechar" : "Pré-consulta"}</Button>
    </div>
    {open && <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{FIELDS.map(([k, l]) => <Input key={k} aria-label={l} placeholder={l} inputMode="decimal" value={v[k] ?? ""} onChange={(ev) => setV({ ...v, [k]: ev.target.value })} />)}</div>
      <textarea aria-label="Evolução de enfermagem" rows={6} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Evolução de enfermagem: queixa, antecedentes, orientações…" className="w-full rounded-md border bg-background p-2 text-sm" />
      <Button onClick={save} disabled={!text.trim()}>Finalizar pré-consulta e liberar para médico</Button>
    </div>}
  </div>;
}
