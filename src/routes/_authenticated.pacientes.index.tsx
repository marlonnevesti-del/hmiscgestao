import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PatientIcon, TYPE_LABEL } from "@/components/PatientIcon";
import { realAllergies, WARDS, type PatientType } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { IcuTrainingPatients } from '@/components/IcuTrainingPanel';
import { trainingSearch } from '@/lib/icu-examples';

export const Route = createFileRoute("/_authenticated/pacientes/")({
  validateSearch: trainingSearch,
  head: () => ({ meta: [
    { title: "Pacientes e Boletins de Atendimento – HMISC" },
    { name: "description", content: "Pacientes cadastrados, atendimentos ativos e prontuários do HMISC." },
    { property: "og:title", content: "Pacientes e Boletins de Atendimento – HMISC" },
    { property: "og:description", content: "Pacientes cadastrados, atendimentos ativos e prontuários do HMISC." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: List,
});

function List() {
  const { treinamento } = Route.useSearch();
  const navigate = Route.useNavigate();
  const patients = useStore((s) => s.patients);
  const [f, setF] = useState<PatientType | "todos">("todos");
  const [scope, setScope] = useState<"internados" | "todos">("internados");
  const [q, setQ] = useState("");

  const inpatientCount = useMemo(() => patients.filter((p) => p.bed.trim() !== "").length, [patients]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const searching = term.length >= 2;
    return patients.filter((p) => {
      if (f !== "todos" && p.type !== f) return false;
      if (searching) {
        return [p.name, p.cpf, p.prontuario, p.bed, p.motherName ?? ""].some((v) => v.toLowerCase().includes(term));
      }
      if (scope === "internados") return p.bed.trim() !== "";
      return true;
    });
  }, [patients, f, scope, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Pacientes / PEP ({treinamento ? 3 : filtered.length})</h1>
        <Button size="sm" variant={treinamento ? 'default' : 'outline'} onClick={() => navigate({ search: (prev) => ({ ...prev, treinamento: !treinamento }) })}>{treinamento ? 'Voltar aos pacientes reais' : 'TESTE / Treinamento (3)'}</Button>
        {!treinamento && <>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-card p-0.5 text-xs">
            <button onClick={() => setScope("internados")} className={cn("rounded px-2.5 py-1 font-medium transition", scope === "internados" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              Internados ({inpatientCount})
            </button>
            <button onClick={() => setScope("todos")} className={cn("rounded px-2.5 py-1 font-medium transition", scope === "todos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              Todos os cadastros ({patients.length})
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["todos", "gestante", "puerpera", "neonato", "pediatria"] as const).map((t) => (
              <button key={t} onClick={() => setF(t)} className={cn("rounded-full border px-3 py-1 text-xs", f === t && "bg-primary text-primary-foreground")}>
                {t === "todos" ? "Todos" : TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        </>}
      </div>
      {treinamento ? <IcuTrainingPatients /> : <>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, prontuário, CPF ou leito (busca no histórico completo)..."
          className="h-9 w-full rounded-md border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Leito", "Paciente", "Idade/IG", "Diagnóstico", "Unidade", "Convênio", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">{p.bed || "—"}</td>
                <td className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><PatientIcon type={p.type} className="h-3.5 w-3.5 text-primary" />{p.name}</span>{realAllergies(p.allergies).length > 0 && <span className="ml-2 rounded bg-maternal-soft px-1.5 text-[10px] text-maternal">ALERGIA</span>}</td>
                <td className="px-3 py-2">{p.ig ?? p.age}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.diagnosis}</td>
                <td className="px-3 py-2">{WARDS.find((w) => w.id === p.ward)?.name}</td>
                <td className="px-3 py-2">{p.insurance}</td>
                <td className="px-3 py-2"><Link to="/pacientes/$id" params={{ id: p.id }} className="font-medium text-clinical">Abrir PEP →</Link></td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {q.trim().length >= 2 ? "Nenhum paciente encontrado para esta busca." : "Nenhum paciente internado no momento."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}
