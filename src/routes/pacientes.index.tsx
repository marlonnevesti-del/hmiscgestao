import { createFileRoute, Link } from "@tanstack/react-router";
import { PATIENTS, WARDS } from "@/lib/hospital-data";

export const Route = createFileRoute("/pacientes/")({
  head: () => ({ meta: [
    { title: "Pacientes internados – HMI Gestão" },
    { name: "description", content: "Lista de pacientes internados com acesso ao prontuário eletrônico." },
    { property: "og:title", content: "Pacientes internados – HMI Gestão" },
    { property: "og:description", content: "Lista de pacientes internados com acesso ao prontuário eletrônico." },
  ] }),
  component: () => (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pacientes internados</h1>
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{["Leito", "Paciente", "Idade/IG", "Diagnóstico", "Unidade", "Convênio", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {PATIENTS.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/50">
                <td className="px-3 py-2 font-mono text-xs">{p.bed}</td>
                <td className="px-3 py-2 font-medium">{p.name}{p.allergies.length > 0 && <span className="ml-2 rounded bg-maternal-soft px-1.5 text-[10px] text-maternal">ALERGIA</span>}</td>
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
  ),
});
