import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Body, type Doc } from "@/components/InpatientDocsPrint";
import { canAccessPage, type Patient } from "@/lib/hospital-data";
import { useStore } from "@/lib/hospital-store";
import { NoPermission } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/documentos-recepcao")({
  head: () => ({ meta: [
    { title: "Documentos da Recepção – SIShmisc" },
    { name: "description", content: "Central de termos e declarações da recepção, preenchidos ou em branco, no papel timbrado do HMISC." },
    { property: "og:title", content: "Documentos da Recepção – SIShmisc" },
    { property: "og:description", content: "Termos e declarações da recepção prontos para impressão." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

const DOCS: { id: Doc; label: string; companion?: boolean }[] = [
  { id: "termo", label: "Termo de responsabilidade de internação" },
  { id: "acompanhante", label: "Declaração de acompanhante", companion: true },
  { id: "comparecimento", label: "Declaração de atendimento / comparecimento", companion: true },
  { id: "internado", label: "Declaração de paciente internado", companion: true },
  { id: "pertences", label: "Termo de guarda e retirada de pertences" },
  { id: "recusa", label: "Termo de recusa / desistência de atendimento" },
  { id: "altaEnf", label: "Orientação de alta da enfermagem – Alojamento Conjunto" },
  { id: "altaCir", label: "Orientação de alta da enfermagem – Clínica Cirúrgica" },
  { id: "altaPed", label: "Orientação de alta da enfermagem – Internação Pediátrica" },
  { id: "notaAlta", label: "Nota de alta (médica)" },
];
const BLANK = { id: "", name: "", prontuario: "", cpf: "", age: "", bed: "", ward: "" } as unknown as Patient;

function Page() {
  const profile = useStore((s) => s.profile);
  const areas = useStore((s) => s.accessAreas);
  const patients = useStore((s) => s.patients);
  const encounters = useStore((s) => s.encounters);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [job, setJob] = useState<{ doc: Doc; blank: boolean; companion: string } | null>(null);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return patients.filter((p) => [p.name, p.cpf, p.prontuario, p.registration?.cns ?? ""].some((v) => (v ?? "").toLowerCase().includes(t))).slice(0, 8);
  }, [q, patients]);
  const recent = useMemo(() => encounters.slice(-10).reverse(), [encounters]);
  if (!canAccessPage(profile, "/documentos-recepcao", areas)) return <NoPermission action="imprimir documentos da recepção" />;
  const patient = patients.find((p) => p.id === sel);
  const enc = patient ? encounters.filter((e) => e.patientId === patient.id).at(-1) : undefined;

  const print = (doc: Doc, blank: boolean, needsCompanion?: boolean) => {
    let companion = "";
    if (!blank && needsCompanion) {
      const c = window.prompt("Nome do acompanhante (deixe em branco se não houver):", patient?.guardian || "");
      if (c === null) return;
      companion = c.trim();
    }
    setJob({ doc, blank, companion });
    document.body.classList.add("print-doc", "print-term");
    const done = () => { document.body.classList.remove("print-doc", "print-term"); setJob(null); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 150);
  };

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Documentos da Recepção</h1>
    <Card><CardHeader><CardTitle className="text-base">Documentos preenchidos do paciente</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input aria-label="Buscar paciente" placeholder="Buscar por nome, CPF, CNS ou prontuário" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && <div className="flex flex-wrap gap-2">{results.map((p) => <Button key={p.id} size="sm" variant={sel === p.id ? "default" : "outline"} onClick={() => { setSel(p.id); setQ(""); }}>{p.name} · {p.prontuario}</Button>)}</div>}
        {patient ? <>
          <p className="text-sm"><b>{patient.name}</b> · {patient.prontuario} · {enc ? `${enc.number} (${enc.type})` : "sem atendimento"}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{DOCS.map((d) => <Button key={d.id} variant="outline" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => print(d.id, false, d.companion)}><Printer className="mr-2 h-4 w-4 shrink-0" />{d.label}</Button>)}</div>
        </> : <p className="text-sm text-muted-foreground">Busque um paciente ou escolha um dos atendimentos recentes abaixo.</p>}
      </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Modelos em branco (preenchimento à mão)</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{DOCS.map((d) => <Button key={d.id} variant="secondary" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => print(d.id, true)}><FileText className="mr-2 h-4 w-4 shrink-0" />{d.label}</Button>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Últimos atendimentos</CardTitle></CardHeader>
      <CardContent className="divide-y">{recent.map((e) => { const p = patients.find((x) => x.id === e.patientId); return p && <button key={e.id} onClick={() => setSel(p.id)} className="flex w-full justify-between py-2 text-left text-sm hover:bg-muted"><span>{p.name}</span><span className="text-xs text-muted-foreground">{e.number} · {e.type}</span></button>; })}
        {!recent.length && <p className="text-sm text-muted-foreground">Nenhum atendimento ainda.</p>}</CardContent></Card>
    {job && createPortal(<div className="print-doc-root term-root"><Body doc={job.doc} p={job.blank || !patient ? BLANK : patient} e={job.blank ? undefined : enc} companion={job.companion} /></div>, document.body)}
  </div>;
}
