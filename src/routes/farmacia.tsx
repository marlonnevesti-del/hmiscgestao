import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { NoPermission } from "@/components/AppShell";
import { can, type Prescription } from "@/lib/hospital-data";
import { nowHM, professionalName, setState, updatePatient, useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/farmacia")({
  head: () => ({ meta: [
    { title: "Farmácia e Checagem Beira-Leito – HMI Gestão" },
    { name: "description", content: "Triagem farmacêutica, dispensação por kit e aprazamento com checagem de medicações." },
    { property: "og:title", content: "Farmácia e Checagem Beira-Leito – HMI Gestão" },
    { property: "og:description", content: "Triagem farmacêutica, dispensação e checagem de medicações." },
  ] }),
  component: Farmacia,
});

function Farmacia() {
  const profile = useStore((s) => s.profile);
  const [view, setView] = useState<"farmacia" | "enfermagem">(profile === "Enfermeiro" ? "enfermagem" : "farmacia");
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Farmácia hospitalar & checagem beira-leito</h1></div>
      <div className="flex gap-1 border-b">{([["farmacia", "Visão da Farmácia"], ["enfermagem", "Aprazamento & Checagem"]] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", view === k ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>{l}</button>)}</div>
      {view === "farmacia" ? <Pharmacy /> : <Nursing />}
    </div>
  );
}

function Pharmacy() {
  const patients = useStore((s) => s.patients);
  const profile = useStore((s) => s.profile);
  const allowed = can(profile, "farmacia");
  const withMeds = patients.filter((p) => p.prescriptions.some((r) => r.pharmacy));
  const set = (pid: string, rid: string, st: Prescription["pharmacy"]) => updatePatient(pid, (p) => ({ prescriptions: p.prescriptions.map((r) => (r.id === rid ? { ...r, pharmacy: st } : r)) }));
  const pending = withMeds.flatMap((p) => p.prescriptions.filter((r) => r.pharmacy === "Pendente")).length;
  return (
    <div className="space-y-3">
      {!allowed && <NoPermission action="validar ou dispensar (perfil Farmacêutico)" />}
      <div className="text-sm text-muted-foreground"><b className="text-maternal">{pending}</b> itens aguardando triagem farmacêutica</div>
      <div className="grid gap-3 lg:grid-cols-2">
        {withMeds.sort((a, b) => b.prescriptions.filter((r) => r.pharmacy === "Pendente").length - a.prescriptions.filter((r) => r.pharmacy === "Pendente").length).map((p) => {
          const meds = p.prescriptions.filter((r) => r.pharmacy);
          return (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between"><div><Link to="/pacientes/$id" params={{ id: p.id }} className="font-semibold hover:text-clinical">{p.name}</Link><div className="text-xs text-muted-foreground">{p.bed} · {p.weight} kg{p.allergies.length ? ` · Alergias: ${p.allergies.join(", ")}` : ""}</div></div>
                {allowed && meds.some((m) => m.pharmacy === "Validada") && <button onClick={() => { meds.filter((m) => m.pharmacy === "Validada").forEach((m) => set(p.id, m.id, "Dispensada")); toast.success(`Kit individualizado dispensado – ${p.bed}`); }} className="rounded-md bg-clinical px-3 py-1.5 text-xs font-medium text-accent-foreground">Dispensar kit</button>}</div>
              {meds.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 border-t py-1.5 text-sm">
                  <div><div className="font-medium">{m.item}</div><div className="text-xs text-muted-foreground">{m.posologia}</div></div>
                  {m.pharmacy === "Pendente" && allowed ? <div className="flex gap-1"><button onClick={() => { set(p.id, m.id, "Validada"); toast.success("Item validado"); }} className="rounded border border-clinical px-2 py-0.5 text-xs text-clinical">Validar</button></div>
                    : <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold", m.pharmacy === "Pendente" ? "bg-mt-yellow" : m.pharmacy === "Validada" ? "bg-secondary text-secondary-foreground" : "bg-clinical-soft text-clinical")}>{m.pharmacy}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Nursing() {
  const patients = useStore((s) => s.patients);
  const admins = useStore((s) => s.admins);
  const profile = useStore((s) => s.profile);
  const allowed = can(profile, "checar");
  const [just, setJust] = useState<string | null>(null);
  const [reason, setReason] = useState("Paciente em jejum");
  const record = (key: string, status: "checado" | "nao" | "adiado", r?: string) => {
    setState((s) => ({ admins: { ...s.admins, [key]: { status, by: professionalName(profile), at: nowHM(), reason: r } } }));
    toast.success(status === "checado" ? "Administração checada" : status === "adiado" ? "Dose adiada" : "Não-administração justificada");
  };
  return (
    <div className="space-y-3">
      {!allowed && <NoPermission action="checar administrações (perfil Enfermeiro)" />}
      {patients.filter((p) => p.prescriptions.some((r) => r.times)).map((p) => (
        <div key={p.id} className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">{p.bed} · {p.name}</div>
          <table className="w-full text-xs"><tbody>
            {p.prescriptions.filter((r) => r.times).map((r) => (
              <tr key={r.id} className="border-t align-top"><td className="w-1/3 py-2 pr-2"><div className="font-medium">{r.item}</div><div className="text-muted-foreground">{r.posologia}</div>{r.pharmacy !== "Dispensada" && <div className="text-[10px] text-maternal">Aguardando farmácia ({r.pharmacy})</div>}</td>
                <td className="py-2"><div className="flex flex-wrap gap-2">{r.times!.map((t) => {
                  const key = `${p.id}|${r.id}|${t}`; const a = admins[key];
                  return (
                    <div key={t} className={cn("min-w-[130px] rounded-md border p-1.5", a?.status === "checado" && "border-clinical bg-clinical-soft", a?.status === "nao" && "border-maternal bg-maternal-soft", a?.status === "adiado" && "bg-mt-yellow/30")}>
                      <div className="font-mono font-semibold">{t}</div>
                      {a ? <div className="text-[10px]">{a.status === "checado" ? "✓ Administrado" : a.status === "adiado" ? "Adiado" : `Não adm.: ${a.reason}`} · {a.at} · {a.by}</div>
                        : allowed && r.pharmacy === "Dispensada" ? <div className="mt-1 flex gap-1">
                          <button onClick={() => record(key, "checado")} className="rounded bg-clinical px-1.5 py-0.5 text-[10px] text-accent-foreground">Checar</button>
                          <button onClick={() => setJust(key)} className="rounded border px-1.5 py-0.5 text-[10px]">Justificar</button>
                          <button onClick={() => record(key, "adiado")} className="rounded border px-1.5 py-0.5 text-[10px]">Adiar</button>
                        </div> : <div className="text-[10px] text-muted-foreground">Pendente</div>}
                      {just === key && <div className="mt-1 space-y-1"><select value={reason} onChange={(e) => setReason(e.target.value)} className="h-6 w-full rounded border bg-background text-[10px]">{["Paciente em jejum", "Recusa do paciente", "Paciente fora do leito", "Medicação em falta", "Suspenso pelo médico"].map((x) => <option key={x}>{x}</option>)}</select><button onClick={() => { record(key, "nao", reason); setJust(null); }} className="w-full rounded bg-maternal py-0.5 text-[10px] text-primary-foreground">Confirmar</button></div>}
                    </div>
                  );
                })}</div></td></tr>
            ))}
          </tbody></table>
        </div>
      ))}
    </div>
  );
}
