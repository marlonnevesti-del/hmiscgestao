import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AGENDA_FIELDS,
  downloadAgendaTemplate,
  markDuplicates,
  previewAgendaGrid,
  readAgendaPdf,
  readAgendaSpreadsheet,
  type AgendaField,
  type AgendaImportRow,
} from "@/lib/agenda-import";
import { importAppointments, useStore } from "@/lib/hospital-store";

export function AgendaImport() {
  const appointments = useStore((s) => s.appointments);
  const patients = useStore((s) => s.patients);
  const specs = useStore((s) => s.ambSpecialties);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [grid, setGrid] = useState<unknown[][]>([]);
  const [colMap, setColMap] = useState<Partial<Record<AgendaField, number>>>({});
  const [pdfRows, setPdfRows] = useState<AgendaImportRow[]>([]);
  const [fallbackSpec, setFallbackSpec] = useState("");
  const [fallbackDoc, setFallbackDoc] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const rawRows = useMemo(
    () => (grid.length ? previewAgendaGrid(grid, fileName, colMap) : pdfRows),
    [grid, fileName, colMap, pdfRows],
  );
  const rows = useMemo(
    () => markDuplicates(rawRows, appointments, patients, specs),
    [rawRows, appointments, patients, specs],
  );
  const valid = rows.filter((r) => !r.errors.length && !r.duplicate);
  const dups = rows.filter((r) => r.duplicate).length;
  const invalid = rows.filter((r) => r.errors.length).length;
  const headers = (grid[0] ?? []).map((c, i) => String(c ?? "").trim() || `Coluna ${i + 1}`);

  const reset = () => { setGrid([]); setColMap({}); setPdfRows([]); setFileName(""); };

  const loadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); reset();
    try {
      const list = Array.from(files);
      const first = list[0]!;
      if (first.name.toLowerCase().endsWith(".pdf")) {
        const parsed = await Promise.all(list.map((f) => readAgendaPdf(f, fallbackSpec, fallbackDoc)));
        setPdfRows(parsed.flat());
        setFileName(list.map((f) => f.name).join(", "));
      } else {
        const { grid: g, map } = await readAgendaSpreadsheet(first);
        setGrid(g); setColMap(map); setFileName(first.name);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const confirm = () => {
    if (!valid.length) return;
    if (!window.confirm(`Confirmar importação de ${valid.length} agendamento(s)? Pacientes novos serão pré-cadastrados automaticamente.`)) return;
    try {
      const res = importAppointments(valid.map((r) => r.item));
      toast.success(
        `${res.imported} agendamento(s) importado(s)` +
        (res.createdPatients ? ` · ${res.createdPatients} paciente(s) pré-cadastrado(s)` : "") +
        (res.skippedDuplicates ? ` · ${res.skippedDuplicates} duplicado(s) ignorado(s)` : ""),
      );
      reset(); setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar agenda.");
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />Importar agenda
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>Importar agenda do ambulatório (Excel, CSV ou PDF)</DialogTitle></DialogHeader>
          <input ref={input} className="hidden" type="file" accept=".xlsx,.xls,.csv,.tsv,.pdf" multiple onChange={(e) => void loadFiles(e.target.files)} />
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
              <FileSpreadsheet className="h-4 w-4" />{busy ? "Lendo arquivo…" : "Selecionar arquivo(s)"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void downloadAgendaTemplate()}>
              <Download className="h-4 w-4" />Baixar modelo Excel
            </Button>
          </div>
          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-2">
            <label className="grid gap-1">Especialidade padrão (para PDFs sem cabeçalho)
              <Input value={fallbackSpec} onChange={(e) => setFallbackSpec(e.target.value)} placeholder="Ex.: Pediatria" />
            </label>
            <label className="grid gap-1">Médico padrão (opcional para PDFs)
              <Input value={fallbackDoc} onChange={(e) => setFallbackDoc(e.target.value)} placeholder="Ex.: DR. JOÃO SANTOS" />
            </label>
          </div>
          {grid.length > 0 && (
            <div className="grid gap-2 rounded-md border p-3 text-xs sm:grid-cols-3">
              {AGENDA_FIELDS.map((f) => (
                <label key={f.key} className="grid gap-1">
                  <span>{f.label}{f.required ? " *" : ""}</span>
                  <select className="h-8 rounded-md border bg-background px-2 text-xs" value={colMap[f.key] ?? ""} onChange={(e) => setColMap((m) => ({ ...m, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
                    <option value="">Não mapear</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-4 border-y py-2 text-sm">
                <span><b>{rows.length}</b> linha(s) lida(s)</span>
                <span className="text-emerald-700"><b>{valid.length}</b> apto(s)</span>
                {dups > 0 && <span className="text-amber-700"><b>{dups}</b> já existente(s)</span>}
                {invalid > 0 && <span className="text-destructive"><b>{invalid}</b> com pendência</span>}
              </div>
              <div className="max-h-72 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b text-left"><th className="p-2">Linha</th><th>Data</th><th>Hora</th><th>Paciente</th><th>Especialidade</th><th>Profissional</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-mono">{r.row}</td>
                        <td>{r.item.date || "—"}</td>
                        <td className="font-mono">{r.item.time || "—"}</td>
                        <td>{r.item.patientName || "—"}</td>
                        <td>{r.item.specialty || "—"}</td>
                        <td>{r.item.professional || "—"}</td>
                        <td>{r.errors.length ? <span className="text-destructive">{r.errors.join(", ")}</span> : r.duplicate ? <span className="text-amber-700">Duplicado</span> : <span className="text-emerald-700">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 && <p className="text-xs text-muted-foreground">Exibindo as 100 primeiras linhas de {rows.length}.</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={reset}>Limpar</Button>
                <Button type="button" disabled={!valid.length} onClick={confirm}>Confirmar importação ({valid.length})</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}