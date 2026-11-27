import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoPermission } from "@/components/AppShell";
import { Letterhead, LetterFooter } from "@/components/DischargePrint";
import { printProcedure } from "@/components/ProcedurePrint";
import { can, type Patient } from "@/lib/hospital-data";
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
import { trainingSearch } from '@/lib/icu-examples';
import { IcuTrainingPatients } from '@/components/IcuTrainingPanel';
import { IcuExamples } from '@/components/IcuExamples';
import { InstitutionForm } from '@/components/InstitutionForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { aihFileName, aihTextBytes, aihZip } from '@/lib/aih-export';

export const Route = createFileRoute("/_authenticated/faturamento-sus")({
  validateSearch: trainingSearch,
  head: () => ({ meta: [
    { title: "Faturamento SUS – BPA e AIH – HMI Gestão" },
    { name: "description", content: "Competência mensal com conferência, pendências e remessas BPA e SISAIH01." },
    { property: "og:title", content: "Faturamento SUS – HMI Gestão" },
    { property: "og:description", content: "Relatórios e remessas BPA e AIH por competência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BillingPage,
});

function BillingPage() {
  const { treinamento, caso } = Route.useSearch();
  return <Tabs key={`${treinamento}-${caso}`} defaultValue={treinamento ? 'treinamento' : 'real'} className="space-y-4">
    <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="real">Faturamento real</TabsTrigger><TabsTrigger value="instituicao">Dados do Hospital</TabsTrigger><TabsTrigger value="treinamento">TESTE / Treinamento (3)</TabsTrigger></TabsList>
    <TabsContent value="real"><SusBilling /></TabsContent>
    <TabsContent value="instituicao"><div className="space-y-4"><div><h1 className="text-xl font-semibold">Dados da Instituição / Hospital</h1><p className="text-sm text-muted-foreground">Identificação oficial usada nos cabeçalhos e remessas BPA, SISAIH01 e CIHA-01 enviadas ao Estado.</p></div><InstitutionForm /></div></TabsContent>
    <TabsContent value="treinamento"><div className="space-y-4"><h1 className="text-xl font-semibold">Faturamento SUS · AIH de treinamento</h1><IcuTrainingPatients /><IcuExamples initialUnit={caso} initialView="billing" /></div></TabsContent>
  </Tabs>;
}

type Tab = "BPA" | "AIH" | "CIHA";
type Doc = { title: string; rows?: SusRow[]; laudo?: SusRow } | null;
const PROF_KEY = "hmisc-sus-prof";
const fmt = (d: string) => d ? d.split("-").reverse().join("/") : "—";

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=windows-1252" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

function downloadAih(name: string, bytes: Uint8Array, zipped: boolean) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type: zipped ? 'application/zip' : 'text/plain;charset=iso-8859-1' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function SusBilling() {
  const encounters = useStore((s) => s.encounters);
  const patients = useStore((s) => s.patients);
  const profile = useStore((s) => s.profile);
  const institution = useStore((s) => s.institution);
  const activeCnes = institution.cnes || CNES;
  const [comp, setComp] = useState(() => competenceOf(new Date().toISOString()));
  const [day, setDay] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("BPA");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [prof, setProf] = useState<Professional>({ name: "", cns: "", cbo: "225125" });
  const [doc, setDoc] = useState<Doc>(null);
  const [edit, setEdit] = useState<SusRow | null>(null);
  const [detail, setDetail] = useState<SusRow | null>(null);
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
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const list = sem.filter((r) => (!onlyIssues || r.issues.length) && (!day || r.date === day) && (!q || r.name.toLocaleLowerCase("pt-BR").includes(q) || r.encounter.number.toLocaleLowerCase("pt-BR").includes(q)));
  const okCount = all.filter((r) => !r.issues.length).length;
  const allowed = can(profile, "faturar");
  const print = (d: NonNullable<Doc>) => { setDoc(d); printProcedure(); };
  const month = `${comp.slice(4)}/${comp.slice(0, 4)}`;
  const exportAih = (zipped: boolean) => {
    if (!allowed || !okCount) return;
    try {
      const content = aihFile(rows, comp, prof, institution);
      const name = aihFileName(comp, activeCnes);
      downloadAih(zipped ? name.replace(/\.txt$/, '.Zip') : name, zipped ? aihZip(content, comp, activeCnes) : aihTextBytes(content), zipped);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a remessa AIH.'); }
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Faturamento SUS</h1><p className="text-sm text-muted-foreground">BPA (BAAs), SISAIH01 (FIAs) e CIHA-01 · CNES {activeCnes} · CNPJ {institution.cnpj} · Gestão {institution.esferaGestao === "M" ? "Municipal" : "Estadual"}</p></div>
      {!allowed && <NoPermission action="gerar relatórios e remessas SUS (perfil Faturamento)" />}
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[150px_165px_1fr_160px_110px]">
        <label className="text-xs font-medium">Competência<Input type="month" value={`${comp.slice(0, 4)}-${comp.slice(4)}`} onChange={(e) => { if (e.target.value) { setComp(e.target.value.replace("-", "")); if (day && !day.startsWith(e.target.value)) setDay(""); } }} /></label>
        <label className="text-xs font-medium">Buscar por dia
          <div className="flex gap-1">
            <Input type="date" aria-label="Buscar por dia" value={day} onChange={(e) => { const v = e.target.value; setDay(v); if (v) setComp(v.slice(0, 7).replace("-", "")); }} />
            {day && <Button type="button" size="sm" variant="ghost" className="px-2" onClick={() => setDay("")} title="Limpar dia">×</Button>}
          </div>
        </label>
        <label className="text-xs font-medium">Profissional responsável<Input value={prof.name} onChange={(e) => saveProf({ ...prof, name: e.target.value })} placeholder="Nome do médico" /></label>
        <label className="text-xs font-medium">CNS do profissional<Input value={prof.cns} onChange={(e) => saveProf({ ...prof, cns: e.target.value })} placeholder="15 dígitos" /></label>
        <label className="text-xs font-medium">CBO<Input value={prof.cbo} onChange={(e) => saveProf({ ...prof, cbo: e.target.value })} placeholder="225125" /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["BPA", "AIH", "CIHA"] as const).map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t === "BPA" ? "BPA · Ambulatorial (BAA)" : t === "AIH" ? "AIH · Internações (FIA)" : "CIHA-01 · Hospitalar e Ambulatorial"}</Button>)}
      </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm"><b>{list.length}</b>{list.length !== all.length ? ` de ${all.length}` : ""} atendimento(s) em {day ? fmt(day) : month} · <span className="text-clinical">{okCount} prontos</span> · <span className="text-destructive">{all.length - okCount} com pendência</span></div>
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Buscar paciente ou número" placeholder="Buscar paciente ou Nº..." className="h-8 w-48 text-xs" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Só pendências</label>
              <Button size="sm" variant="outline" disabled={!all.length} onClick={() => print({ title: `RELATÓRIO DE CONFERÊNCIA ${tab === "BPA" ? "BPA-I" : tab === "AIH" ? "AIH" : "CIHA-01"} – COMPETÊNCIA ${month}`, rows: all })}>Imprimir conferência</Button>
              <Button size="sm" disabled={!allowed || !okCount} onClick={() => tab === "BPA" ? download(`PA${activeCnes}.${comp.slice(4)}`, bpaFile(rows, comp, prof, institution)) : tab === "AIH" ? exportAih(false) : download(cihaFileName(comp, activeCnes), cihaFile(rows, comp, institution))}>Baixar arquivo {tab === "BPA" ? "BPA" : tab === "AIH" ? "SISAIH01 TXT" : "CIHA-01"} ({okCount})</Button>
              {tab === 'AIH' && <Button size="sm" variant="outline" disabled={!allowed || !okCount} onClick={() => exportAih(true)}>Baixar ZIP SISAIH01</Button>}
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
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th><span className="sr-only">Semáforo</span></th><th>Data</th><th>Tipo</th><th>Nº</th><th>Paciente</th><th>Situação</th></tr></thead>
            <tbody>{list.map((r) => {
              const docType = r.kind === "AIH" ? "FIA" : "BAA";
              return <tr key={`${r.encounter.id}-${r.origin ?? "main"}-${r.procedure}`} className="border-t hover:bg-muted/40">
                <td className="py-2 pr-2"><span role="img" aria-label={r.level === "green" ? "Pronto" : r.level === "yellow" ? "Risco de glosa" : "Bloqueado"} className={cn("inline-block size-2.5 rounded-full", r.level === "green" ? "bg-clinical" : r.level === "yellow" ? "bg-mt-yellow" : "bg-maternal")} /></td>
                <td className="py-2 whitespace-nowrap">{fmt(r.date)}</td>
                <td className="py-2"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">{tab === "CIHA" ? `CIHA-01 · ${docType}` : docType}</span></td>
                <td className="py-2 font-mono text-xs">{r.encounter.number}</td>
                <td className="py-2"><button type="button" className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => setDetail(r)}>{r.name}</button></td>
                <td className={cn("py-2 text-xs", r.issues.length ? "text-destructive" : "text-clinical")}>{r.issues.length ? `${r.issues.length} pendência(s)` : "OK"}</td>
              </tr>;
            })}
            {!list.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum atendimento encontrado{day ? ` em ${fmt(day)}` : " nesta competência"}.</td></tr>}</tbody>
          </table></div>
          <p className="mt-2 text-[11px] text-muted-foreground">Clique no nome do paciente para ver CNS, CID, SIGTAP, pendências e ações. O arquivo inclui só os atendimentos sem pendência.</p>
        </div>
      <DocumentGapsPanel />
      {detail && <SusRowDetailDialog
        row={list.find((x) => x.encounter.id === detail.encounter.id && x.procedure === detail.procedure && x.origin === detail.origin) ?? detail}
        tab={tab}
        allowed={allowed}
        patient={patients.find((x) => x.id === detail.encounter.patientId)}
        onClose={() => setDetail(null)}
        onEditAih={(r) => { setDetail(null); setEdit(r); }}
        onPrintLaudo={(r) => print({ title: "LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR (AIH)", laudo: r })}
      />}
      {edit && <AihDataDialog row={edit} onClose={() => setEdit(null)} />}
      {doc && <PrintDoc doc={doc} prof={prof} month={month} />}
    </div>
  );
}

function SusRowDetailDialog({ row, tab, allowed, patient, onClose, onEditAih, onPrintLaudo }: {
  row: SusRow;
  tab: Tab;
  allowed: boolean;
  patient: Patient | undefined;
  onClose: () => void;
  onEditAih: (r: SusRow) => void;
  onPrintLaudo: (r: SusRow) => void;
}) {
  const docType = row.kind === "AIH" ? "FIA (AIH)" : "BAA (BPA)";
  return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-xl">
    <DialogHeader>
      <DialogTitle>{row.name}</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-3">
        <div><span className="text-muted-foreground">Tipo:</span> <b>{docType}</b></div>
        <div><span className="text-muted-foreground">Nº:</span> <b className="font-mono">{row.encounter.number}</b></div>
        <div><span className="text-muted-foreground">Data:</span> <b>{fmt(row.date)}</b></div>
        <div><span className="text-muted-foreground">CNS:</span> <b className="font-mono">{row.cns || "—"}</b></div>
        <div><span className="text-muted-foreground">CPF:</span> <b className="font-mono">{row.cpf || "—"}</b></div>
        <div><span className="text-muted-foreground">Nascimento:</span> <b>{fmt(row.birthDate)}</b></div>
        <div><span className="text-muted-foreground">Sexo:</span> <b>{row.sex || "—"}</b></div>
        <div><span className="text-muted-foreground">IBGE:</span> <b className="font-mono">{row.cityCode || "—"}</b></div>
        <div><span className="text-muted-foreground">CID-10:</span> <b className="font-mono">{row.cid || "—"}</b></div>
        {row.motherName && <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Mãe:</span> <b>{row.motherName}</b></div>}
        {row.kind === "AIH" && <>
          <div><span className="text-muted-foreground">Nº AIH:</span> <b className="font-mono">{row.aihNumber || "—"}</b></div>
          <div className="col-span-2"><span className="text-muted-foreground">Motivo saída:</span> <b>{EXIT_REASONS.find(([c]) => c === row.exitReason)?.join(" – ") || "—"}</b></div>
        </>}
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Procedimento SIGTAP</div>
        <div className="font-mono text-xs">
          {row.origin === "triage" ? `${row.procedure} · Acolhimento com classificação de risco`
            : row.origin === "procedure" ? `${row.procedure}${row.procedureName ? ` · ${row.procedureName}` : ""}`
            : tab === "BPA" && allowed ? <select aria-label="Código SIGTAP HMISC" className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs" value={row.procedure} onChange={(ev) => { saveSigtapCode(row.encounter.id, ev.target.value); toast.success("Código SIGTAP atualizado"); }}>
                {!HMISC_BPA_CODES.some((c) => c.code === row.procedure) && <option value={row.procedure}>{row.procedure}</option>}
                {HMISC_BPA_CODES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
              </select>
            : row.procedure}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">Situação para remessa</div>
        {row.issues.length ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive space-y-1">
          {row.issues.map((i) => <div key={i}>• {i}</div>)}
        </div> : <div className="rounded-md border border-clinical/30 bg-clinical-soft px-3 py-2 text-xs font-medium text-clinical">Pronto para remessa (sem pendências)</div>}
      </div>
    </div>
    <DialogFooter className="flex flex-wrap gap-2">
      {patient && <AmendDocumentButton p={patient} e={row.encounter} size="sm" label="Trocar código" />}
      {row.kind === "AIH" && allowed && <Button size="sm" variant="outline" onClick={() => onEditAih(row)}>Dados AIH</Button>}
      {row.kind === "AIH" && <Button size="sm" variant="outline" onClick={() => onPrintLaudo(row)}>Imprimir laudo</Button>}
      <Button size="sm" onClick={onClose}>Fechar</Button>
    </DialogFooter>
  </DialogContent></Dialog>;
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
  const institution = useStore((s) => s.institution);
  const activeCnes = institution.cnes || CNES;
  const field = (k: string, v: string) => <div key={k} style={{ border: "1px solid #000", padding: 4 }}><div style={{ fontSize: "8pt" }}>{k}</div><div style={{ fontWeight: 600 }}>{v || "—"}</div></div>;
  const grid = (items: [string, string][]) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 8 }}>{items.map(([k, v]) => field(k, v))}</div>;
  const sign = <div style={{ marginTop: 40, textAlign: "center" }}>______________________________________<br />{prof.name || "Profissional responsável"} · CNS {prof.cns || "—"} · CBO {prof.cbo || "—"}</div>;
  return createPortal(<div className="proc-root">
    <Letterhead title={doc.title} />
    {doc.rows && <>
      <p>Estabelecimento: {institution.nomeFantasia} · CNPJ {institution.cnpj} · CNES {activeCnes} · Competência {month} · Emitido em {new Date().toLocaleString("pt-BR")}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}><thead><tr>{["Data", "Nº", "Paciente", "CNS", "Nasc.", "Sexo", "IBGE", "CID", "SIGTAP", "Pendências"].map((h) => <th key={h} style={{ border: "1px solid #000", padding: 2, textAlign: "left" }}>{h}</th>)}</tr></thead>
        <tbody>{doc.rows.map((r) => <tr key={`${r.encounter.id}-${r.origin ?? "main"}`}>{[fmt(r.date), r.encounter.number, r.name, r.cns, fmt(r.birthDate), r.sex, r.cityCode, r.cid, r.procedure, r.issues.join("; ") || "OK"].map((v, i) => <td key={i} style={{ border: "1px solid #000", padding: 2 }}>{v || "—"}</td>)}</tr>)}</tbody></table>
      <p>Total: {doc.rows.length} · Prontos: {doc.rows.filter((r) => !r.issues.length).length} · Com pendência: {doc.rows.filter((r) => r.issues.length).length}</p>
    </>}
    {doc.laudo && <>
      <h3>Identificação do estabelecimento</h3>{grid([["Estabelecimento solicitante", institution.nomeFantasia], ["CNPJ", institution.cnpj], ["CNES", activeCnes], ["Diretor Clínico", `${institution.diretorClinico.nome} · CRM ${institution.diretorClinico.crm}/${institution.diretorClinico.uf} · CNS ${institution.diretorClinico.cns}`], ["Nº FIA / atendimento", doc.laudo.encounter.number], ["Nº AIH autorizada", doc.laudo.aihNumber], ["Data de autorização", fmt(doc.laudo.aihAuthorizedAt)], ["Motivo de saída", EXIT_REASONS.find(([c]) => c === doc.laudo?.exitReason)?.join(" – ") ?? ""]])}
      <h3>Identificação do paciente</h3>{grid([["Nome", doc.laudo.name], ["CNS", doc.laudo.cns], ["CPF", doc.laudo.cpf], ["Data de nascimento", fmt(doc.laudo.birthDate)], ["Sexo", doc.laudo.sex], ["Nome da mãe", doc.laudo.motherName], ["Município (IBGE)", doc.laudo.cityCode], ["Data de internação", fmt(doc.laudo.date)], ["Caráter", "Urgência"]])}
      <h3>Justificativa da internação</h3>{grid([["Diagnóstico", doc.laudo.encounter.medical?.diagnosis ?? ""], ["CID-10 principal", doc.laudo.cid], ["Procedimento solicitado (SIGTAP)", doc.laudo.procedure]])}
      <div style={{ border: "1px solid #000", padding: 4, minHeight: 80 }}><div style={{ fontSize: "8pt" }}>Principais sinais, sintomas e condições</div>{doc.laudo.encounter.medical?.anamnesis} {doc.laudo.encounter.medical?.exam}</div>
      {sign}
      <div style={{ marginTop: 24, border: "1px solid #000", padding: 4, minHeight: 60 }}><div style={{ fontSize: "8pt" }}>Autorização (uso do gestor) · Nº AIH · Data · Assinatura</div></div>
    </>}
    <LetterFooter />
  </div>, document.body);
}
