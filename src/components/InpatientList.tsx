import { Link } from "@tanstack/react-router";
import { useStore } from "@/lib/hospital-store";
import { WARDS } from "@/lib/hospital-data";
import { InpatientDocsButtons } from "./InpatientDocsPrint";

/** Patients of one care unit currently admitted (FIA open, no discharge). */
export function InpatientList({ unit }: { unit: string }) {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const list = encounters.filter((e) => e.type === unit && e.status_fluxo === "ENCAMINHADO_INTERNACAO");
  if (!list.length) return <p className="py-6 text-sm text-muted-foreground">Nenhum paciente internado por esta unidade.</p>;
  return <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm">
    <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Leito", "Paciente", "FIA", "Internado em", "Diagnóstico", "Documentos", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
    <tbody>{list.map((e) => { const p = patients.find((x) => x.id === e.patientId); if (!p) return null;
      return <tr key={e.id} className="border-t">
        <td className="px-3 py-2 font-mono text-xs">{p.bed || e.fia?.bed}<div className="text-muted-foreground">{WARDS.find((w) => w.id === p.ward)?.name}</div></td>
        <td className="px-3 py-2 font-medium">{p.name}<div className="text-xs text-muted-foreground">Pront. {p.prontuario}</div></td>
        <td className="px-3 py-2 text-xs">{e.fia?.number ?? "—"}</td>
        <td className="px-3 py-2 text-xs">{e.fia?.openedAt ? new Date(e.fia.openedAt).toLocaleString("pt-BR") : "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{e.fia?.cid ?? p.diagnosis}</td>
        <td className="px-3 py-2"><InpatientDocsButtons p={p} e={e} /></td>
        <td className="px-3 py-2"><Link to="/pacientes/$id" params={{ id: p.id }} className="font-medium text-clinical">Abrir PEP →</Link></td>
      </tr>; })}</tbody>
  </table></div>;
}
