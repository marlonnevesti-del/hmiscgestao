import { doctorKey, mergeImportedDoctors, validDoctorCns, type Doctor } from './doctors';

export interface DoctorImportRow { source: string; row: number; doctor: Doctor; errors: string[] }
export function previewDoctorGrid(grid: string[][], source: string): DoctorImportRow[] {
  const headerIndex = grid.findIndex((r) => r.includes('Nome') && r.includes('Nº Conselho'));
  const header = grid[headerIndex];
  if (!header) throw new Error(`${source}: cabeçalho do corpo clínico não encontrado.`);
  const column = (label: string) => {
    const matches = header.flatMap((v, i) => v === label ? [i] : []);
    if (matches.length !== 1) throw new Error(`${source}: coluna ${label} ausente ou repetida.`);
    return matches[0] ?? -1;
  };
  const columns = Object.fromEntries(['Nome', 'Conselho', 'Nº Conselho', 'UF', 'Especialidades', 'CNS', 'Equipe(s)'].map((key) => [key, column(key)]));
  return grid.slice(headerIndex + 1).flatMap((cells, i) => {
    if (cells.every((v) => !v.trim())) return [];
    const get = (key: string) => cells[columns[key] ?? -1]?.trim() ?? '';
    const name = get('Nome'); const number = get('Nº Conselho'); const uf = get('UF').toUpperCase(); const cns = get('CNS').replace(/\D/g, '');
    const errors = [];
    if (!name) errors.push('Nome ausente');
    if (get('Conselho') !== 'CRM' || !/^\d+$/.test(number) || !/^[A-Z]{2}$/.test(uf)) errors.push('CRM/UF inválido');
    const status = !cns ? 'CNS ausente' : validDoctorCns(cns) ? 'CNS válido' : 'Conferir CNS inválido';
    return [{ source, row: headerIndex + i + 2, errors, doctor: { name: name.toUpperCase(), crm: `CRM/${uf} ${number}`, specialty: get('Especialidades').split(',').map((s) => s.trim()).join('; '), cns, cnsStatus: status, teams: get('Equipe(s)').split(',').join(';'), sources: source } }];
  });
}
export function reviewedDoctors(rows: DoctorImportRow[]): Doctor[] {
  const doctors = mergeImportedDoctors([], rows.filter((r) => !r.errors.length).map((r) => r.doctor));
  const owners = new Map<string, Set<string>>();
  for (const d of doctors) if (d.cns) owners.set(d.cns, new Set([...(owners.get(d.cns) ?? []), doctorKey(d)]));
  return doctors.map((d) => (owners.get(d.cns ?? '')?.size ?? 0) > 1 ? { ...d, cnsStatus: 'Conferir CNS repetido' } : d);
}
export async function readDoctorWorkbook(file: File): Promise<DoctorImportRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Limite por planilha: 5 MB.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Selecione uma planilha XLSX.');
  const xlsx = await import('xlsx');
  const book = xlsx.read(await file.arrayBuffer(), { type: 'array', cellText: true });
  const sheet = book.Sheets['Corpo Clínico'];
  if (!sheet) throw new Error(`${file.name}: aba Corpo Clínico não encontrada.`);
  const range = xlsx.utils.decode_range(sheet['!ref'] ?? 'A1');
  if (range.e.r > 5000 || range.e.c > 100) throw new Error('Planilha excede o limite de 5.000 linhas ou 100 colunas.');
  const grid: string[][] = [];
  for (let r = 0; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[xlsx.utils.encode_cell({ r, c })];
      cells.push(String(cell?.w ?? cell?.v ?? ''));
    }
    grid.push(cells);
  }
  return previewDoctorGrid(grid, file.name);
}