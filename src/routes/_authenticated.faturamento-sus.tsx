import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoPermission } from "@/components/AppShell";
import { Letterhead, LetterFooter } from "@/components/DischargePrint";
import { printProcedure } from "@/components/ProcedurePrint";
import { can } from "@/lib/hospital-data";
import { saveAihAuthorization, saveSigtapCode, useStore } from "@/lib/hospital-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AmendDocumentButton, DocumentGapsPanel } from "@/components/DocumentAmend";
import { documentGaps } from "@/lib/document-amend";
import { semaphoreOf, semaphoreSummary } from "@/lib/billing-semaphore";
import { loadSigtap, type SigtapProc } from "@/lib/sigtap";
import { loadSigtapRules, sigtapGlosas, type SigtapRules } from "@/lib/sigtap-compat";
import { aihFile, bpaFile, cihaFile, cihaFileName, buildSusRows, EXIT_REASONS, isObstetricExit, CNES, competenceOf, SIGTAP_DEFAULT, HMISC_BPA_CODES, type Professional, type SusRow } from "@/lib/sus-billing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/faturamento-sus")({
  head: () => ({ meta: [
    { title: "Faturamento SUS – BPA e AIH – HMI Gestão" },
    { name: "description", content: "Competência mensal com conferência, pendências e remessas BPA e SISAIH01." },
    { property: "og:title", content: "Faturamento SUS – HMI Gestão" },
    { property: "og:description", content: "Relatórios e remessas BPA e AIH por competência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SusBilling,
});

type Tab = "BPA" | "AIH" | "CIHA";
type Doc = { title: string; rows?: SusRow[]; laudo?: SusRow } | null;
const PROF_KEY = "hmisc-sus-prof";
const fmt = (d: string) => d ? d.split("-").reverse().join("/") : "—";

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=windows-1252" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function SusBilling() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const profile = useStore((s) => s.profile);
  const [comp, setComp] = useState(() => competenceOf(new Date().toISOString()));
  const [tab, setTab] = useState<Tab>("BPA");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [prof, setProf] = useState<Professional>({ name: "", cns: "", cbo: "225125" });
  const [doc, setDoc] = useState<Doc>(null);
  const [edit, setEdit] = useState<SusRow | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(PROF_KEY); if (v) { const p = JSON.parse(v) as Professional; setProf({ ...p, cbo: p.cbo || "225125" }); } } catch { /* ignore */ } }, []);
  const saveProf = (p: Professional) => { setProf(p); localStorage.setItem(PROF_KEY, JSON.stringify(p)); };
  const [sig, setSig] = useState<{ list: SigtapProc[]; rules: SigtapRules } | null>(null);
  useEffect(() => { Promise.all([loadSigtap(), loadSigtapRules()]).then(([list, rules]) => setSig({ list, rules })); }, []);
  const rows = useMemo(() => buildSusRows(encounters, patients, comp, prof).map((r) => {
    if (!sig) return r;
    const g = sigtapGlosas(sig.rules, sig.list.find((x) => x.c === r.procedure), r);
    return g.length ? { ...r, issues: [...r.issues, ...g] } : r;
  }), [encounters, patients, comp, prof, sig]);
  const all = tab === "CIHA" ? rows : rows.filter((r) => r.kind === tab);
  const sem = all.map((r) => ({ ...r, level: semaphoreOf(r.issues, { defaultProcedure: r.procedure === SIGTAP_DEFAULT[r.kind], gaps: r.patient ? documentGaps(r.patient, r.encounter) : [] }) }));
  const summary = semaphoreSummary(sem);
  const list = sem.filter((r) => !onlyIssues || r.issues.length);
  const okCount = all.filter((r) => !r.issues.length).length;
  const allowed = can(profile, "faturar");
  const print = (d: NonNullable<Doc>) => { setDoc(d); printProcedure(); };
  const month = `${comp.slice(4)}/${comp.slice(0, 4)}`;

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Faturamento SUS</h1><p className="text-sm text-muted-foreground">BPA (BAAs), SISAIH01 (FIAs) e CIHA-01 · CNES {CNES}</p></div>
      {!allowed && <NoPermission action="gerar relatórios e remessas SUS (perfil Faturamento)" />}
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[160px_1fr_160px_120px]">
        <label className="text-xs font-medium">Competência<Input type="month" value={`${comp.slice(0, 4)}-${comp.slice(4)}`} onChange={(e) => e.target.value && setComp(e.target.value.replace("-", ""))} /></label>
        <label className="text-xs font-medium">Profissional responsável<Input value={prof.name} onChange={(e) => saveProf({ ...prof, name: e.target.value })} placeholder="Nome do médico" /></label>
        <label className="text-xs font-medium">CNS do profissional<Input value={prof.cns} onChange={(e) => saveProf({ ...prof, cns: e.target.value })} placeholder="15 dígitos" /></label>
        <label className="text-xs font-medium">CBO<Input value={prof.cbo} onChange={(e) => saveProf({ ...prof, cbo: e.target.value })} placeholder="225125" /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["BPA", "AIH", "CIHA"] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t === "BPA" ? "BPA · Ambulatorial (BAA)" : t === "AIH" ? "AIH · Internações (FIA)" : "CIHA-01 · Hospitalar e Ambulatorial"}</Button>)}
      </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm"><b>{all.length}</b> atendimento(s) em {month} · <span className="text-clinical">{okCount} prontos</span> · <span className="text-destructive">{all.length - okCount} com pendência</span></div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Só pendências</label>
              <Button size="sm" variant="outline" disabled={!all.length} onClick={() => print({ title: `RELATÓRIO DE CONFERÊNCIA ${tab === "BPA" ? "BPA-I" : tab === "AIH" ? "AIH" : "CIHA-01"} – COMPETÊNCIA ${month}`, rows: all })}>Imprimir conferência</Button>
              <Button size="sm" disabled={!allowed || !okCount} onClick={() => tab === "BPA" ? download(`PA${CNES}.${comp.slice(4)}`, bpaFile(rows, comp, prof)) : tab === "AIH" ? download(`AIH${CNES}_${comp}.txt`, aihFile(rows, comp, prof)) : download(cihaFileName(comp), cihaFile(rows, comp))}>Baixar arquivo {tab === "BPA" ? "BPA" : tab === "AIH" ? "SISAIH01" : "CIHA-01"} ({okCount})</Button>
            </div>
          </div>
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap gap-2" aria-label="Semáforo pré-faturamento">
              <span className="rounded-full bg-clinical-soft px-3 py-1 text-sm text-clinical">{summary.green} Prontos</span>
              <span className="rounded-full bg-mt-yellow px-3 py-1 text-sm text-foreground">{summary.yellow} Risco de glosa</span>
              <span className="rounded-full bg-maternal-soft px-3 py-1 text-sm text-maternal">{summary.red} Bloqueados</span>
            </div>
            <p className="text-xs text-muted-foreground">Vermelho = dados do paciente incompletos; amarelo = CNS/CBO do profissional, código SIGTAP padrão ou pendência de documento; verde = pronto para remessa.</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th><span className="sr-only">Semáforo</span></th><th>Data</th><th>Nº</th><th>Paciente</th><th>CNS</th><th>CID</th><th>SIGTAP</th><th>Situação</th><th></th></tr></thead>
            <tbody>{list.map((r) => <tr key={r.encounter.id} className="border-t align-top"><td className="py-1 pr-2"><span role="img" aria-label={r.level === "green" ? "Pronto" : r.level === "yellow" ? "Risco de glosa" : "Bloqueado"} className={cn("inline-block size-2.5 rounded-full", r.level === "green" ? "bg-clinical" : r.level === "yellow" ? "bg-mt-yellow" : "bg-maternal")} /></td>
              <td className="py-1">{fmt(r.date)}</td><td className="font-mono text-xs">{r.encounter.number}</td><td>{r.name}</td>
              <td className="font-mono text-xs">{r.cns || "—"}</td><td>{r.cid || "—"}</td><td className="font-mono text-xs">{tab === "BPA" && allowed ? <select aria-label="Código SIGTAP HMISC" className="rounded border bg-background px-1 py-0.5 font-mono text-xs" value={r.procedure} onChange={(ev) => { saveSigtapCode(r.encounter.id, ev.target.value); toast.success("Código SIGTAP atualizado"); }}>{!HMISC_BPA_CODES.some((c) => c.code === r.procedure) && <option value={r.procedure}>{r.procedure}</option>}{HMISC_BPA_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select> : r.procedure}</td>
              <td className={cn("text-xs", r.issues.length ? "text-destructive" : "text-clinical")}>{r.issues.length ? r.issues.map((i) => <div key={i}>• {i}</div>) : "OK"}</td>
              <td className="flex gap-1">{(() => { const pt = patients.find((x) => x.id === r.encounter.patientId); return pt ? <AmendDocumentButton p={pt} e={r.encounter} size="sm" label="Trocar código" /> : null; })()}{tab === "AIH" && allowed && <Button size="sm" variant="outline" onClick={() => setEdit(r)}>Dados AIH</Button>}{tab === "AIH" && <Button size="sm" variant="outline" onClick={() => print({ title: "LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR (AIH)", laudo: r })}>Imprimir laudo</Button>}</td>
            </tr>)}
            {!list.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum atendimento nesta competência.</td></tr>}</tbody>
          </table></div>
          <p className="mt-2 text-[11px] text-muted-foreground">O arquivo inclui só os atendimentos sem pendência. Corrija o cadastro do paciente (CNS, nascimento, sexo, município) e o CID no atendimento médico.</p>
        </div>
      <DocumentGapsPanel />
      {edit && <AihDataDialog row={edit} onClose={() => setEdit(null)} />}
      {doc && <PrintDoc doc={doc} prof={prof} month={month} />}
    </div>
  );
}

function AihDataDialog({ row, onClose }: { row: SusRow; onClose: () => void }) {
  const l = row.encounter.aihLaudo ?? {};
  const [f, setF] = useState<Record<string, string>>(() => ({ aihNumero: l['aihNumero'] ?? "", aihData: l['aihData'] ?? "", motivoSaida: l['motivoSaida'] ?? "", ...Object.fromEntries(row.births.flatMap((b) => [[`dnv_${b.rnId}`, b.dnv], [`rnObito_${b.rnId}`, b.alive ? "" : "1"]])) }));
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!window.confirm("Confirmar gravação dos dados oficiais desta AIH?")) return;
    try { saveAihAuthorization(row.encounter.id, { ...f, aihNumero: (f['aihNumero'] ?? "").replace(/\D/g, "") }); toast.success("Dados da AIH gravados"); onClose(); } catch (e) { toast.error((e as Error).message); }
  };
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-lg">
    <DialogHeader><DialogTitle>Dados oficiais da AIH · {row.name}</DialogTitle></DialogHeader>
    <div className="grid gap-3">
      <label className="text-xs font-medium">Nº da AIH autorizada (13 dígitos)<Input inputMode="numeric" maxLength={13} value={f['aihNumero']} onChange={(e) => set("aihNumero", e.target.value.replace(/\D/g, ""))} placeholder="42…" /></label>
      <label className="text-xs font-medium">Data de autorização<Input type="date" value={f['aihData']} onChange={(e) => set("aihData", e.target.value)} /></label>
      <label className="text-xs font-medium">Motivo de saída / permanência (Tabela SUS)
        <select className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" value={f['motivoSaida']} onChange={(e) => set("motivoSaida", e.target.value)}>
          <option value="">Selecione…</option>{EXIT_REASONS.map(([c, n]) => <option key={c} value={c}>{c} – {n}</option>)}
        </select></label>
      {(isObstetricExit(f['motivoSaida'] ?? "") || row.births.length > 0) && <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-semibold">Recém-nascidos (da Maternidade)</div>
        {!row.births.length && <p className="text-xs text-destructive">Nenhum RN vinculado a esta paciente. Registre o parto na Maternidade.</p>}
        {row.births.map((b) => <div key={b.rnId} className="grid gap-2 border-t pt-2 sm:grid-cols-2">
          <div className="text-xs sm:col-span-2"><b>{b.name}</b> · Peso {b.weight || "—"} g · IG {b.weeks || "—"} semanas</div>
          <label className="text-xs font-medium">Nº da DNV<Input inputMode="numeric" maxLength={11} value={f[`dnv_${b.rnId}`] ?? ""} onChange={(e) => set(`dnv_${b.rnId}`, e.target.value.replace(/\D/g, ""))} /></label>
          <label className="flex items-end gap-2 text-xs"><input type="checkbox" checked={f[`rnObito_${b.rnId}`] === "1"} onChange={(e) => set(`rnObito_${b.rnId}`, e.target.checked ? "1" : "")} /> Natimorto / óbito do RN</label>
        </div>)}
      </div>}
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function PrintDoc({ doc, prof, month }: { doc: NonNullable<Doc>; prof: Professional; month: string }) {
  const field = (k: string, v: string) => <div key={k} style={{ border: "1px solid #000", padding: 4 }}><div style={{ fontSize: "8pt" }}>{k}</div><div style={{ fontWeight: 600 }}>{v || "—"}</div></div>;
  const grid = (items: [string, string][]) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 8 }}>{items.map(([k, v]) => field(k, v))}</div>;
  const sign = <div style={{ marginTop: 40, textAlign: "center" }}>______________________________________<br />{prof.name || "Profissional responsável"} · CNS {prof.cns || "—"} · CBO {prof.cbo || "—"}</div>;
  return createPortal(<div className="proc-root">
    <Letterhead title={doc.title} />
    {doc.rows && <>
      <p>Estabelecimento: HMISC · CNES {CNES} · Competência {month} · Emitido em {new Date().toLocaleString("pt-BR")}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}><thead><tr>{["Data", "Nº", "Paciente", "CNS", "Nasc.", "Sexo", "IBGE", "CID", "SIGTAP", "Pendências"].map((h) => <th key={h} style={{ border: "1px solid #000", padding: 2, textAlign: "left" }}>{h}</th>)}</tr></thead>
        <tbody>{doc.rows.map((r) => <tr key={r.encounter.id}>{[fmt(r.date), r.encounter.number, r.name, r.cns, fmt(r.birthDate), r.sex, r.cityCode, r.cid, r.procedure, r.issues.join("; ") || "OK"].map((v, i) => <td key={i} style={{ border: "1px solid #000", padding: 2 }}>{v || "—"}</td>)}</tr>)}</tbody></table>
      <p>Total: {doc.rows.length} · Prontos: {doc.rows.filter((r) => !r.issues.length).length} · Com pendência: {doc.rows.filter((r) => r.issues.length).length}</p>
    </>}
    {doc.laudo && <>
      <h3>Identificação do estabelecimento</h3>{grid([["Estabelecimento solicitante", "HMISC"], ["CNES", CNES], ["Nº FIA / atendimento", doc.laudo.encounter.number], ["Nº AIH autorizada", doc.laudo.aihNumber], ["Data de autorização", fmt(doc.laudo.aihAuthorizedAt)], ["Motivo de saída", EXIT_REASONS.find(([c]) => c === doc.laudo?.exitReason)?.join(" – ") ?? ""]])}
      <h3>Identificação do paciente</h3>{grid([["Nome", doc.laudo.name], ["CNS", doc.laudo.cns], ["CPF", doc.laudo.cpf], ["Data de nascimento", fmt(doc.laudo.birthDate)], ["Sexo", doc.laudo.sex], ["Nome da mãe", doc.laudo.motherName], ["Município (IBGE)", doc.laudo.cityCode], ["Data de internação", fmt(doc.laudo.date)], ["Caráter", "Urgência"]])}
      <h3>Justificativa da internação</h3>{grid([["Diagnóstico", doc.laudo.encounter.medical?.diagnosis ?? ""], ["CID-10 principal", doc.laudo.cid], ["Procedimento solicitado (SIGTAP)", doc.laudo.procedure]])}
      <div style={{ border: "1px solid #000", padding: 4, minHeight: 80 }}><div style={{ fontSize: "8pt" }}>Principais sinais, sintomas e condições</div>{doc.laudo.encounter.medical?.anamnesis} {doc.laudo.encounter.medical?.exam}</div>
      {sign}
      <div style={{ marginTop: 24, border: "1px solid #000", padding: 4, minHeight: 60 }}><div style={{ fontSize: "8pt" }}>Autorização (uso do gestor) · Nº AIH · Data · Assinatura</div></div>
    </>}
    <LetterFooter />
  </div>, document.body);
}
