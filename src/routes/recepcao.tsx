import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { NoPermission } from "@/components/AppShell";
import { BASE_BEDS, WARDS, can, type Patient, type Ward } from "@/lib/hospital-data";
import { setState, useStore, nowHM } from "@/lib/hospital-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recepcao")({
  head: () => ({ meta: [
    { title: "Recepção e Cadastro de Pacientes – HMI Gestão" },
    { name: "description", content: "Cadastro de gestantes e crianças, abertura de atendimento e encaminhamento para triagem ou internação." },
    { property: "og:title", content: "Recepção e Cadastro – HMI Gestão" },
    { property: "og:description", content: "Cadastro de pacientes e abertura de atendimento." },
  ] }),
  component: Recepcao,
});

const INSURANCES = ["SUS", "Unimed", "Bradesco Saúde", "Amil", "SulAmérica", "Particular"];
const empty = { tipo: "gestante" as "gestante" | "pediatria", nome: "", cpf: "", nasc: "", mae: "", resp: "", tel: "", endereco: "", convenio: "SUS", carteira: "", guia: "", ig: "", dum: "", peso: "", queixa: "", alergias: "" };

function Recepcao() {
  const profile = useStore((s) => s.profile);
  const patients = useStore((s) => s.patients);
  const queue = useStore((s) => s.queue);
  const navigate = useNavigate();
  const [f, setF] = useState(empty);
  const [destino, setDestino] = useState<"fila" | "internar">("fila");
  const [ward, setWard] = useState<Ward>("PSO");
  const ob = f.tipo === "gestante";
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const dup = f.cpf.length >= 11 ? patients.find((p) => p.cpf.replace(/\D/g, "") === f.cpf.replace(/\D/g, "")) : undefined;
  const peso = parseFloat(f.peso.replace(",", "."));
  const missing = [!f.nome && "nome", !ob && !f.resp && "responsável legal", !ob && !(peso > 0) && "peso", f.convenio !== "SUS" && f.convenio !== "Particular" && !f.carteira && "nº da carteirinha"].filter(Boolean) as string[];
  const freeBeds = BASE_BEDS.filter((b) => b.ward === ward && b.status === "livre" && !patients.some((p) => p.bed === b.id));

  const salvar = () => {
    if (missing.length) { toast.error(`Preencha: ${missing.join(", ")}`); return; }
    const pront = `2026-${String(5000 + patients.length + queue.length)}`;
    if (destino === "fila") {
      setState((s) => ({ queue: [...s.queue, { id: `q-${Date.now()}`, name: f.nome, group: ob ? "obstetrica" : "pediatria", complaint: f.queixa || "Sem queixa informada", arrivedMinAgo: 0, detail: ob ? `IG ${f.ig || "?"}` : f.nasc || "criança", ...(peso > 0 ? { weight: peso } : {}) }] }));
      toast.success(`${f.nome} cadastrado(a) – prontuário ${pront} – enviado(a) para a fila de triagem`);
      setF(empty); navigate({ to: "/acolhimento" });
    } else {
      const bed = freeBeds[0]; if (!bed) { toast.error("Sem leito livre nesta unidade"); return; }
      const id = `cad-${Date.now()}`;
      const p: Patient = {
        id, prontuario: pront, name: f.nome, cpf: f.cpf || "—", ...(f.mae ? { motherName: f.mae } : {}), ...(f.resp ? { guardian: f.resp } : {}),
        type: ob ? "gestante" : "pediatria", age: f.nasc || "—", ...(f.ig ? { ig: f.ig } : {}), ...(f.dum ? { dum: f.dum } : {}), weight: peso || 0,
        allergies: f.alergias ? f.alergias.split(",").map((x) => x.trim()).filter(Boolean) : [], risks: f.alergias ? ["Alergia"] : [],
        ward, bed: bed.id, insurance: f.convenio, ...(f.guia ? { guia: f.guia } : {}), authorized: f.convenio === "SUS" || f.convenio === "Particular" || !!f.guia,
        diagnosis: f.queixa || "Em avaliação", admission: `14/11 ${nowHM()}`, days: 1, evolutions: [], vitals: [], prescriptions: [], ...(ob ? { partograma: [] } : {}),
      };
      setState((s) => ({ patients: [...s.patients, p] }));
      toast.success(`${f.nome} internado(a) no leito ${bed.id}`);
      setF(empty); navigate({ to: "/pacientes/$id", params: { id } });
    }
  };

  const In = ({ k, l, ph, req, cls }: { k: keyof typeof empty; l: string; ph?: string; req?: boolean; cls?: string }) => (
    <label className={cn("text-xs font-medium text-muted-foreground", cls)}>{l}{req && <span className="text-maternal"> *</span>}
      <input value={f[k]} onChange={set(k)} placeholder={ph} className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground" /></label>
  );

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Recepção e cadastro</h1><p className="text-sm text-muted-foreground">Cadastro do paciente, abertura do atendimento e encaminhamento</p></div>
      {!can(profile, "triagem") || profile === "Farmacêutico" ? <NoPermission action="cadastrar pacientes (perfil Recepção, Médico ou Enfermeiro)" /> : null}
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex gap-1">{([["gestante", "Gestante / Puérpera"], ["pediatria", "Criança / RN"]] as const).map(([k, l]) => <button key={k} onClick={() => setF({ ...f, tipo: k })} className={cn("rounded-md border px-4 py-1.5 text-sm font-medium", f.tipo === k && (k === "gestante" ? "border-maternal bg-maternal text-primary-foreground" : "bg-primary text-primary-foreground"))}>{l}</button>)}</div>
          <section><div className="mb-2 text-xs font-semibold uppercase text-primary">Identificação</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {In({ k: "nome", l: "Nome completo", req: true, cls: "col-span-2" })}{In({ k: "cpf", l: "CPF", ph: "000.000.000-00" })}{In({ k: "nasc", l: "Data de nascimento", ph: "dd/mm/aaaa" })}
              {In({ k: "mae", l: "Nome da mãe", cls: "col-span-2" })}{In({ k: "tel", l: "Telefone", ph: "(00) 00000-0000" })}{In({ k: "endereco", l: "Endereço / bairro" })}
              {!ob && In({ k: "resp", l: "Responsável legal", req: true, cls: "col-span-2" })}
            </div>
            {dup && <div className="mt-2 rounded-md bg-mt-yellow/40 p-2 text-xs">CPF já cadastrado: <Link to="/pacientes/$id" params={{ id: dup.id }} className="font-semibold text-primary underline">{dup.name} ({dup.prontuario})</Link></div>}
          </section>
          <section><div className="mb-2 text-xs font-semibold uppercase text-primary">Convênio</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <label className="text-xs font-medium text-muted-foreground">Convênio<select value={f.convenio} onChange={set("convenio")} className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground">{INSURANCES.map((i) => <option key={i}>{i}</option>)}</select></label>
              {f.convenio === "SUS" ? In({ k: "carteira", l: "Cartão SUS (CNS)" }) : In({ k: "carteira", l: "Nº carteirinha", req: f.convenio !== "Particular" })}
              {In({ k: "guia", l: f.convenio === "SUS" ? "Nº AIH" : "Senha / guia de autorização", cls: "col-span-2" })}
            </div>
          </section>
          <section><div className={cn("mb-2 text-xs font-semibold uppercase", ob ? "text-maternal" : "text-primary")}>{ob ? "Dados obstétricos" : "Dados pediátricos"}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {ob ? <>{In({ k: "ig", l: "Idade gestacional", ph: "38s 2d" })}{In({ k: "dum", l: "DUM", ph: "dd/mm/aaaa" })}</> : In({ k: "peso", l: "Peso (kg)", ph: "12,5", req: true })}
              {In({ k: "alergias", l: "Alergias (separe por vírgula)", cls: ob ? "col-span-2" : "col-span-3" })}
              {In({ k: "queixa", l: "Motivo do atendimento / queixa", cls: "col-span-2 md:col-span-4" })}
            </div>
          </section>
          <section className="flex flex-wrap items-end gap-3 border-t pt-3">
            <div className="flex gap-1">{([["fila", "Enviar para triagem"], ["internar", "Internar direto"]] as const).map(([k, l]) => <button key={k} onClick={() => setDestino(k)} className={cn("rounded-md border px-3 py-1.5 text-xs font-medium", destino === k && "bg-secondary text-secondary-foreground ring-1 ring-primary")}>{l}</button>)}</div>
            {destino === "internar" && <label className="text-xs text-muted-foreground">Unidade<select value={ward} onChange={(e) => setWard(e.target.value as Ward)} className="ml-2 h-8 rounded-md border bg-background px-2 text-sm text-foreground">{WARDS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select><span className="ml-2">{freeBeds[0] ? `Leito ${freeBeds[0].id}` : "Sem leito livre"}</span></label>}
            <button onClick={salvar} className="ml-auto rounded-md bg-clinical px-5 py-2 text-sm font-medium text-accent-foreground">Cadastrar e abrir atendimento</button>
          </section>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Atendimentos abertos hoje ({queue.length})</h3>
            {queue.slice().reverse().map((q) => <div key={q.id} className="flex justify-between border-t py-1.5 text-xs"><span className="font-medium">{q.name}</span><span className="text-muted-foreground">{q.group === "obstetrica" ? "Obstetrícia" : "Pediatria"} · {q.risk ? "Classificado" : "Aguard. triagem"}</span></div>)}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Internados ({patients.length})</h3>
            {patients.slice(-6).reverse().map((p) => <Link key={p.id} to="/pacientes/$id" params={{ id: p.id }} className="flex justify-between border-t py-1.5 text-xs hover:text-clinical"><span className="font-medium">{p.name}</span><span className="font-mono text-muted-foreground">{p.bed}</span></Link>)}
          </div>
        </div>
      </div>
    </div>
  );
}
