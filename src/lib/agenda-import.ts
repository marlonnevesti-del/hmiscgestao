import Papa from "papaparse";
import type { AmbSpecialty, Appointment } from "./ambulatorio";

export interface AgendaImportItem {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  patientName: string;
  cpf: string;
  cns: string;
  prontuario: string;
  specialty: string;
  professional: string;
  note: string;
}

export interface AgendaImportRow {
  source: string;
  row: number;
  item: AgendaImportItem;
  errors: string[];
  duplicate?: boolean;
}

export type AgendaField = keyof AgendaImportItem;

export const AGENDA_FIELDS: { key: AgendaField; label: string; required?: boolean }[] = [
  { key: "date", label: "Data", required: true },
  { key: "time", label: "Horário", required: true },
  { key: "patientName", label: "Paciente", required: true },
  { key: "specialty", label: "Especialidade", required: true },
  { key: "professional", label: "Médico / Profissional" },
  { key: "cpf", label: "CPF" },
  { key: "cns", label: "CNS" },
  { key: "prontuario", label: "Prontuário" },
  { key: "note", label: "Observação" },
];

export const normText = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Remove valores puramente numéricos (ex.: fragmentos de telefone) do campo profissional. */
export const sanitizeProfessional = (raw: unknown): string => {
  const s = String(raw ?? "").trim();
  if (!s || /^[\d\s().-]+$/.test(s)) return "";
  return s;
};

export function normalizeDate(raw: unknown): string {
  if (typeof raw === "number" && raw > 25000 && raw < 80000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
  if (br) {
    const yr = br[3]!.length === 2 ? `20${br[3]}` : br[3]!;
    return `${yr}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}`;
  }
  return "";
}

export function normalizeTime(raw: unknown): string {
  if (typeof raw === "number" && raw >= 0 && raw < 1) {
    const total = Math.round(raw * 24 * 60);
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  const m = /(\d{1,2})[:hH](\d{2})/.exec(String(raw ?? "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function guessColumnMap(header: string[]): Partial<Record<AgendaField, number>> {
  const map: Partial<Record<AgendaField, number>> = {};
  const rules: [AgendaField, RegExp][] = [
    ["date", /^(data|dia|dt|data.*consulta|data.*agend)/],
    ["time", /^(hora|horario|hr|inicio)/],
    ["patientName", /^(paciente|nome|nome.*paciente|usuario)/],
    ["cpf", /^cpf$/],
    ["cns", /^(cns|cartao.*sus)/],
    ["prontuario", /^(prontuario|registro|codigo)/],
    ["specialty", /^(especialidade|tipo.*atendimento|servico|procedimento)/],
    ["professional", /^(medico|profissional|doutor|dr|agenda)/],
    ["note", /^(obs|observacao|motivo|nota|telefone)/],
  ];
  header.forEach((cell, idx) => {
    const h = normText(cell);
    for (const [field, rx] of rules) {
      if (map[field] === undefined && rx.test(h)) map[field] = idx;
    }
  });
  return map;
}

export function validateAgendaItem(item: AgendaImportItem): string[] {
  const errors: string[] = [];
  if (!item.date) errors.push("Data inválida");
  if (!item.time) errors.push("Horário inválido");
  if (!item.patientName.trim()) errors.push("Paciente ausente");
  if (!item.specialty.trim()) errors.push("Especialidade ausente");
  return errors;
}

export function previewAgendaGrid(
  grid: unknown[][],
  source: string,
  colMap: Partial<Record<AgendaField, number>>,
  headerRow = 1,
): AgendaImportRow[] {
  const rows = grid.slice(1);
  return rows.flatMap((cells, i) => {
    if (!cells.some((c) => String(c ?? "").trim())) return [];
    const get = (f: AgendaField) => {
      const idx = colMap[f];
      return idx !== undefined ? cells[idx] : "";
    };
    const item: AgendaImportItem = {
      date: normalizeDate(get("date")),
      time: normalizeTime(get("time")),
      patientName: String(get("patientName") ?? "").trim(),
      cpf: String(get("cpf") ?? "").replace(/\D/g, ""),
      cns: String(get("cns") ?? "").replace(/\D/g, ""),
      prontuario: String(get("prontuario") ?? "").trim(),
      specialty: String(get("specialty") ?? "").trim(),
      professional: sanitizeProfessional(get("professional")),
      note: String(get("note") ?? "").trim(),
    };
    return [{ source, row: headerRow + i + 1, item, errors: validateAgendaItem(item) }];
  });
}

export function parseCsvText(text: string): string[][] {
  const res = Papa.parse<string[]>(text, { dynamicTyping: false });
  const err = res.errors.find((e) => e.code !== "UndetectableDelimiter");
  if (err) throw new Error(err.message);
  return res.data.filter((r) => r.some((c) => c.trim()));
}

export async function readAgendaSpreadsheet(file: File): Promise<{ grid: unknown[][]; map: Partial<Record<AgendaField, number>> }> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Limite por arquivo: 10 MB.");
  const lower = file.name.toLowerCase();
  let grid: unknown[][];
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    grid = parseCsvText(await file.text());
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const xlsx = await import("xlsx");
    const book = xlsx.read(await file.arrayBuffer(), { type: "array" });
    const first = book.SheetNames[0];
    if (!first || !book.Sheets[first]) throw new Error("Planilha vazia.");
    const sheet = book.Sheets[first];
    const range = xlsx.utils.decode_range(sheet["!ref"] ?? "A1");
    if (range.e.r > 5000 || range.e.c > 60) throw new Error("Planilha excede 5.000 linhas ou 60 colunas.");
    grid = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: unknown[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[xlsx.utils.encode_cell({ r, c })];
        if (!cell) row.push("");
        else if (cell.t === "n" && typeof cell.v === "number") row.push(cell.w && /[:/]/.test(cell.w) ? cell.w : cell.v);
        else row.push(cell.w ?? cell.v ?? "");
      }
      if (row.some((v) => String(v).trim())) grid.push(row);
    }
  } else {
    throw new Error("Formato não suportado. Use .xlsx, .xls, .csv ou .pdf.");
  }
  const header = (grid[0] ?? []).map((c) => String(c ?? ""));
  return { grid, map: guessColumnMap(header) };
}

/** Extrai agendamentos de texto de relatórios PDF (Salux / Sisreg / listas de agenda). */
export function parseAgendaPdfLines(lines: string[], source: string, fallbackSpec = "", fallbackDoc = ""): AgendaImportRow[] {
  let curDate = "";
  let curSpec = fallbackSpec;
  let curDoc = fallbackDoc;
  const out: AgendaImportRow[] = [];

  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) return;

    const specM = /(?:especialidade|agenda|setor|servi[cç]o)\s*:\s*([^|–-]+)/i.exec(line);
    if (specM?.[1]) curSpec = specM[1].trim();
    const docM = /(?:m[eé]dico|profissional|recurso|dr\.?a?)\s*:\s*([^|–-]+)/i.exec(line);
    if (docM?.[1]) curDoc = sanitizeProfessional(docM[1]);
    const dateHeader = /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(line);
    if (dateHeader?.[1]) curDate = normalizeDate(dateHeader[1]);

    const timeM = /\b(\d{2}:\d{2})\b/.exec(line);
    if (!timeM?.[1]) return;

    const afterTime = line.slice(timeM.index + timeM[0].length).replace(/^[\s–|-]+/, "").trim();
    if (!afterTime || /^(hor[aá]rio|paciente|total|p[aá]gina)/i.test(afterTime)) return;

    const cpfM = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/.exec(afterTime);
    const cnsM = /\b(\d{15})\b/.exec(afterTime);
    let namePart = afterTime
      .replace(cpfM?.[0] ?? "", "")
      .replace(cnsM?.[0] ?? "", "")
      .replace(/(?:\(?\d{2}\)?\s*)?\b\d{4,5}-\d{4}\b/g, "")
      .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "")
      .replace(/\b(agendado|confirmado|retorno|consulta|sisreg|encaixe|faltou|cancelado)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s–|-]+|[\s–|-]+$/g, "");

    const parts = namePart.split(/\s*[|–-]\s*/).map((s) => s.trim()).filter(Boolean);
    const patientName = parts[0] ?? "";
    const rowSpec = parts[1] || curSpec;
    const rowDoc = sanitizeProfessional(parts[2]) || curDoc;

    if (patientName.length < 3) return;
    const item: AgendaImportItem = {
      date: curDate,
      time: timeM[1],
      patientName,
      cpf: (cpfM?.[1] ?? "").replace(/\D/g, ""),
      cns: cnsM?.[1] ?? "",
      prontuario: "",
      specialty: rowSpec,
      professional: rowDoc,
      note: "",
    };
    out.push({ source, row: idx + 1, item, errors: validateAgendaItem(item) });
  });
  return out;
}

export async function readAgendaPdf(file: File, fallbackSpec = "", fallbackDoc = ""): Promise<AgendaImportRow[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Limite por PDF: 15 MB.");
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 50); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let buf = "";
    for (const it of content.items) {
      if (!("str" in it)) continue;
      const y = Math.round(it.transform[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (buf.trim()) lines.push(buf.trim());
        buf = it.str;
      } else {
        buf += (buf && it.str ? " " : "") + it.str;
      }
      lastY = y;
    }
    if (buf.trim()) lines.push(buf.trim());
  }
  return parseAgendaPdfLines(lines, file.name, fallbackSpec, fallbackDoc);
}

export function markDuplicates(
  rows: AgendaImportRow[],
  existing: Appointment[],
  patients: { id: string; name: string }[],
  specs: AmbSpecialty[],
): AgendaImportRow[] {
  const patName = new Map(patients.map((p) => [p.id, normText(p.name)]));
  const specName = new Map(specs.map((s) => [s.id, normText(s.name)]));
  const keys = new Set(
    existing
      .filter((a) => a.status !== "cancelado")
      .map((a) => `${a.date}|${a.time}|${patName.get(a.patientId) ?? ""}|${specName.get(a.specialtyId) ?? ""}`),
  );
  const seen = new Set<string>();
  return rows.map((r) => {
    const key = `${r.item.date}|${r.item.time}|${normText(r.item.patientName)}|${normText(r.item.specialty)}`;
    const dup = !r.errors.length && (keys.has(key) || seen.has(key));
    if (!r.errors.length) seen.add(key);
    return { ...r, duplicate: dup };
  });
}

export async function downloadAgendaTemplate() {
  const xlsx = await import("xlsx");
  const ws = xlsx.utils.aoa_to_sheet([
    ["Data", "Horário", "Paciente", "CPF", "CNS", "Especialidade", "Profissional", "Observação"],
    ["26/11/2026", "08:00", "MARIA DA SILVA", "12345678901", "", "Pediatria", "DR. JOÃO SANTOS", "CONSULTA"],
  ]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Agenda");
  xlsx.writeFile(wb, "modelo-agenda-ambulatorio.xlsx");
}