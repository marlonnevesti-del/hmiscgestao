import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AmendDocumentButton } from "@/components/DocumentAmend";
import { correctEncounter, deleteEncounter, reopenEncounter, revertAdmission, useStore } from "@/lib/hospital-store";
import { ATTENDANCE_TYPES, type Encounter } from "@/lib/care-flow";
import { BASE_BEDS } from "@/lib/hospital-data";
import { releaseHotelariaBed } from "@/lib/hotelaria-beds.functions";
import { employeeHead } from "@/lib/employee-rules";

export const Route = createFileRoute("/_authenticated/gestao-atendimentos")({
  head: () => employeeHead("BAAs e FIAs abertas – Administração", "Painel do administrador para visualizar, corrigir e apagar BAAs e FIAs do HMISC."),
  component: AdminEncounters,
});

const fmt = (d?: string) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

function AdminEncounters() {
  const profile = useStore((s) => s.profile);
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"abertos" | "baa" | "fia" | "todos">("abertos");
  const [edit, setEdit] = useState<Encounter | null>(null);
  if (profile !== "Administrador") return <p className="text-muted-foreground">Área exclusiva do administrador.</p>;
  const open = (e: Encounter) => e.status_fluxo !== "ALTA_HOSPITALAR";
  const list = encounters.filter((e) => {
    if (filter === "abertos" && !open(e)) return false;
    if (filter === "baa" && (!open(e) || e.fia)) return false;
    if (filter === "fia" && (!open(e) || !e.fia)) return false;
    const p = patients.find((x) => x.id === e.patientId);
    const t = q.trim().toLowerCase();
    return !t || [e.number, e.fia?.number ?? "", p?.name ?? "", p?.prontuario ?? "", e.specialty].some((v) => v.toLowerCase().includes(t));
  }).slice().reverse();
  const act = (fn: () => void, ok: string) => { try { fn(); toast.success(ok); } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível concluir"); } };
  const remove = (e: Encounter, name: string) => {
    if (!window.confirm(`Apagar ${e.fia ? `${e.number} / ${e.fia.number}` : e.number} de ${name}? Esta ação não pode ser desfeita.`)) return;
    act(() => deleteEncounter(e.id), "Atendimento apagado");
  };
  const reopen = (e: Encounter) => { const r = window.prompt("Justificativa para desfazer a alta:"); if (r) act(() => reopenEncounter(e.id, r), "Alta desfeita"); };
  const revert = (e: Encounter, name: string) => {
    if (!window.confirm(`Desfazer a internação de ${name}? A ${e.fia?.number} será cancelada, a ${e.number} reaberta e o leito liberado.`)) return;
    const r = window.prompt("Justificativa para desfazer a internação (obrigatória):"); if (!r) return;
    act(() => { const bed = revertAdmission(e.id, r); if (bed && !BASE_BEDS.some((b) => b.id === bed)) void releaseHotelariaBed({ data: { codigo: bed } }).then((x) => x.ok ? toast.success(x.message) : toast.warning(x.message)).catch(() => toast.warning("Sem comunicação com a Hotelaria.")); }, "Internação desfeita · BAA reaberta");
  };
  const counts = { abertos: encounters.filter(open).length, baa: encounters.filter((e) => open(e) && !e.fia).length, fia: encounters.filter((e) => open(e) && e.fia).length, todos: encounters.length };
  return <div className="space-y-4">
    <div><h1 className="text-xl font-semibold">BAAs e FIAs abertas</h1><p className="text-sm text-muted-foreground">Visualize todos os atendimentos, corrija dados de abertura e documentos, desfaça altas ou apague registros lançados por engano.</p></div>
    <div className="flex flex-wrap items-center gap-2">
      {(["abertos", "baa", "fia", "todos"] as const).map((k) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{{ abertos: "Todos abertos", baa: "BAAs abertas", fia: "FIAs abertas", todos: "Histórico completo" }[k]} ({counts[k]})</Button>)}
      <Input className="max-w-xs" placeholder="Buscar por nº, paciente ou prontuário" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="p-2">BAA</th><th>FIA</th><th>Paciente</th><th>Unidade</th><th>Especialidade</th><th>Situação</th><th>Aberto em</th><th className="p-2 text-right">Ações</th></tr></thead>
        <tbody>
          {list.map((e) => { const p = patients.find((x) => x.id === e.patientId); const name = p?.name ?? "Paciente"; return <tr key={e.id} className="border-b align-top">
            <td className="p-2 font-mono text-xs">{e.number}</td>
            <td className="font-mono text-xs">{e.fia?.number ?? "—"}{e.fia && <div className="text-muted-foreground">{e.fia.ward} {e.fia.bed}</div>}</td>
            <td>{p ? <Link className="text-primary hover:underline" to="/pacientes/$id" params={{ id: p.id }}>{name}</Link> : name}<div className="text-xs text-muted-foreground">{p?.prontuario}</div></td>
            <td>{e.type}{e.nursingPreConsult && <div className="text-xs text-primary">Pré-consulta</div>}</td>
            <td>{e.specialty}</td>
            <td className="text-xs">{e.status_fluxo.replaceAll("_", " ").toLowerCase()}</td>
            <td className="text-xs">{fmt(e.openedAt)}</td>
            <td className="space-x-1 whitespace-nowrap p-2 text-right">
              <Button size="sm" variant="outline" onClick={() => setEdit(e)}>Corrigir</Button>
              {p && <AmendDocumentButton p={p} e={e} label="Documentos" />}
              {e.status_fluxo === "ALTA_HOSPITALAR" && <Button size="sm" variant="outline" onClick={() => reopen(e)}>Desfazer alta</Button>}
              {e.fia && e.status_fluxo === "ENCAMINHADO_INTERNACAO" && <Button size="sm" variant="outline" onClick={() => revert(e, name)}>Desfazer internação</Button>}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(e, name)}>Apagar</Button>
            </td>
          </tr>; })}
          {!list.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum atendimento encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
    <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
      <DialogContent>{edit && <EditForm e={edit} onDone={() => setEdit(null)} />}</DialogContent>
    </Dialog>
  </div>;
}

function EditForm({ e, onDone }: { e: Encounter; onDone: () => void }) {
  const [f, setF] = useState({ type: e.type, specialty: e.specialty, complaint: e.complaint, nursingPreConsult: !!e.nursingPreConsult });
  const [reason, setReason] = useState("");
  const save = () => {
    if (!window.confirm(`Confirmar a correção de ${e.number}?`)) return;
    try { correctEncounter(e.id, f, reason); toast.success("Atendimento corrigido"); onDone(); } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível corrigir"); }
  };
  return <>
    <DialogHeader><DialogTitle>Corrigir {e.number}{e.fia ? ` / ${e.fia.number}` : ""}</DialogTitle></DialogHeader>
    <div className="grid gap-3">
      <label className="grid gap-1 text-xs">Unidade<select className="h-9 rounded-md border bg-background px-2" value={f.type} onChange={(x) => setF({ ...f, type: x.target.value })}>{ATTENDANCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Especialidade<Input value={f.specialty} onChange={(x) => setF({ ...f, specialty: x.target.value })} /></label>
      <label className="grid gap-1 text-xs">Queixa / motivo<Input value={f.complaint} onChange={(x) => setF({ ...f, complaint: x.target.value })} /></label>
      {f.type === "Ambulatório" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.nursingPreConsult} onChange={(x) => setF({ ...f, nursingPreConsult: x.target.checked })} />Encaminhar para pré-consulta de enfermagem</label>}
      <label className="grid gap-1 text-xs">Justificativa (obrigatória)<Input value={reason} onChange={(x) => setReason(x.target.value)} /></label>
      <Button onClick={save} disabled={!reason.trim()}>Salvar correção</Button>
    </div>
  </>;
}
