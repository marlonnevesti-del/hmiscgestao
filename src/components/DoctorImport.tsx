import { useRef, useState } from 'react';
import { Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { readDoctorWorkbook, reviewedDoctors, type DoctorImportRow } from '@/lib/doctor-import';
import { importDoctors, updateDoctor, useStore } from '@/lib/hospital-store';
import { documentCns, mergeDoctors, type Doctor } from '@/lib/doctors';
import { Pencil } from 'lucide-react';

export function DoctorImport() {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<DoctorImportRow[]>([]); const [q, setQ] = useState('');
  const [pending, setPending] = useState(false); const input = useRef<HTMLInputElement>(null);
  const saved = useStore((s) => s.doctors);
  const preview = reviewedDoctors(rows); const all = rows.length ? preview : mergeDoctors(saved);
  const [edit, setEdit] = useState<{ orig: Doctor; d: Doctor } | null>(null);
  const saveEdit = () => { if (!edit || !window.confirm(`Salvar a correção de ${edit.d.name}?`)) return; try { updateDoctor(edit.orig, edit.d); setEdit(null); toast.success('Cadastro do médico corrigido.'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.'); } };
  const filtered = all.filter((d) => (!pending || !documentCns(d)) && `${d.name} ${d.crm} ${d.specialty}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()));
  const skipped = rows.filter((r) => r.errors.length).length;
  const load = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setRows([]);
    try { const parsed = await Promise.all(Array.from(files).map(readDoctorWorkbook)); setRows(parsed.flat()); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível ler as planilhas.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const confirm = () => {
    if (!window.confirm(`Confirma a incorporação de ${preview.length} médicos? Os cadastros existentes serão preservados; CNS pendentes não serão preenchidos automaticamente.`)) return;
    try { const count = importDoctors(preview); setRows([]); toast.success(`${count} médicos incorporados ao corpo clínico.`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível incorporar os médicos.'); }
  };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Users />Corpo clínico</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Corpo clínico · HMISC</DialogTitle></DialogHeader>
      <input ref={input} aria-label="Planilhas do corpo clínico" className="hidden" type="file" accept=".xlsx" multiple onChange={(e) => void load(e.target.files)} />
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{busy ? 'Lendo planilhas…' : 'Importar planilhas'}</Button><Input className="w-full sm:w-72" aria-label="Buscar médico no corpo clínico" placeholder="Nome, CRM ou especialidade" value={q} onChange={(e) => setQ(e.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />CNS pendentes</label></div>
      <div className="flex flex-wrap gap-4 border-y py-3 text-sm"><span><b>{all.length}</b> médicos únicos</span><span><b>{all.filter((d) => documentCns(d)).length}</b> CNS aptos ao preenchimento</span><span className="text-destructive"><b>{all.filter((d) => !documentCns(d)).length}</b> CNS pendentes</span></div>
      {rows.length > 0 && <div className="space-y-2"><p className="text-sm">{rows.length} registros lidos · {rows.length - skipped - preview.length} repetições unificadas · {skipped} registros rejeitados.</p>{rows.filter((r) => r.errors.length).map((r) => <p key={`${r.source}-${r.row}`} className="text-xs text-destructive">{r.source}, linha {r.row}: {r.errors.join('; ')}</p>)}<div className="flex gap-2"><Button disabled={busy || !preview.length} onClick={confirm}><Upload />Confirmar importação</Button><Button variant="outline" onClick={() => setRows([])}>Descartar prévia</Button></div></div>}
      <div className="max-h-96 overflow-auto border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="sticky top-0 bg-muted"><tr>{['Médico', 'CRM', 'Especialidades', 'CNS', ''].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.map((d) => <tr key={`${d.crm}-${d.name}`} className="border-t"><td className="p-3 font-medium">{d.name}</td><td className="whitespace-nowrap p-3">{d.crm}</td><td className="p-3">{d.specialty}</td><td className={documentCns(d) ? 'p-3 text-clinical' : 'p-3 text-destructive'}>{documentCns(d) ? 'Apto' : d.cnsStatus || 'CNS ausente'}</td><td className="p-2">{!rows.length && <Button size="icon" variant="ghost" aria-label={`Corrigir ${d.name}`} onClick={() => setEdit({ orig: d, d: { ...d } })}><Pencil /></Button>}</td></tr>)}{!filtered.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum médico encontrado.</td></tr>}</tbody></table></div>
    </DialogContent></Dialog>
    <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent><DialogHeader><DialogTitle>Corrigir médico</DialogTitle></DialogHeader>
      {edit && <div className="grid gap-3">{([['name', 'Nome'], ['crm', 'CRM (ex.: CRM/SC 12345)'], ['rqe', 'RQE'], ['specialty', 'Especialidades (separe por ;)'], ['cns', 'CNS (15 dígitos)']] as const).map(([k, label]) => <label key={k} className="grid gap-1 text-sm">{label}<Input value={edit.d[k] ?? ''} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, [k]: e.target.value } })} /></label>)}
      <Button onClick={saveEdit}>Salvar correção</Button></div>}
    </DialogContent></Dialog>
  </>;
}