import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PatientIcon, TYPE_LABEL } from "@/components/PatientIcon";
import { WARDS, type PatientType } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pacientes/")({
  head: () => ({ meta: [
    { title: "Pacientes internados – HMI Gestão" },
    { name: "description", content: "Lista de pacientes internados com acesso ao prontuário eletrônico." },
    { property: "og:title", content: "Pacientes internados – HMI Gestão" },
    { property: "og:description", content: "Lista de pacientes internados com acesso ao prontuário eletrônico." },
  ] }),
  component: List,
});

function List() {
  const patients = useStore((s) => s.patients);
  const [f, setF] = useState<PatientType | "todos">("todos");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold">Pacientes internados ({patients.length})</h1>
        <div className="flex gap-1">{(["todos", "gestante", "puerpera", "neonato", "pediatria"] as const).map((t) => <button key={t} onClick={() => setF(t)} className={cn("rounded-full border px-3 py-1 text-xs", f === t && "bg-primary text-primary-foreground")}>{t === "todos" ? "Todos" : TYPE_LABEL[t]}</button>)}</div></div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Leito", "Paciente", "Idade/IG", "Diagnóstico", "Unidade", "Convênio", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {patients.filter((p) => f === "todos" || p.type === f).map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">{p.bed}</td>
                <td className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><PatientIcon type={p.type} className="h-3.5 w-3.5 text-primary" />{p.name}</span>{p.allergies.length > 0 && <span className="ml-2 rounded bg-maternal-soft px-1.5 text-[10px] text-maternal">ALERGIA</span>}</td>
                <td className="px-3 py-2">{p.ig ?? p.age}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.diagnosis}</td>
                <td className="px-3 py-2">{WARDS.find((w) => w.id === p.ward)?.name}</td>
                <td className="px-3 py-2">{p.insurance}</td>
                <td className="px-3 py-2"><Link to="/pacientes/$id" params={{ id: p.id }} className="font-medium text-clinical">Abrir PEP →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
