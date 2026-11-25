import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminUpdateEmployee } from "@/lib/employees.functions";

type Emp = { id: string; full_name: string; username: string; email: string; cpf: string; phone: string; birth_date: string; address: string; council_type: string; council_number: string; council_state: string; job_function: string; sector: string };
const FIELDS = [["full_name", "Nome completo"], ["username", "Usuário"], ["email", "E-mail"], ["cpf", "CPF"], ["phone", "Telefone"], ["birth_date", "Nascimento"], ["address", "Endereço"], ["council_type", "Conselho"], ["council_number", "Nº conselho"], ["council_state", "UF conselho"]] as const;

export function EmployeeEditForm({ employee, sectors, onDone }: { employee: Emp; sectors: string[]; onDone: () => void }) {
  const save = useServerFn(adminUpdateEmployee);
  const cache = useQueryClient();
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, employee[k] ?? ""])) as Record<(typeof FIELDS)[number][0], string>);
  const [sector, setSector] = useState(employee.sector);
  const [resend, setResend] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try {
      const r = await save({ data: { id: employee.id, ...form, sector, resend, origin: window.location.origin } });
      if (!r.ok) { toast.error(r.message); return; }
      toast.success(r.message);
      await cache.invalidateQueries({ queryKey: ["employees"] });
      onDone();
    } catch { toast.error("Não foi possível salvar o cadastro"); } finally { setBusy(false); setConfirm(false); }
  };
  return <form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      {FIELDS.map(([k, label]) => <label key={k} className={k === "address" || k === "full_name" ? "col-span-2 grid gap-1 text-xs" : "grid gap-1 text-xs"}>{label}<Input type={k === "email" ? "email" : "text"} required={k === "full_name" || k === "username" || k === "email"} value={form[k]} onChange={(e) => { setConfirm(false); setForm((f) => ({ ...f, [k]: e.target.value })); }} /></label>)}
    </div>
    <label className="grid gap-1 text-xs">Setor<select required aria-label="Setor do colaborador" className="h-9 rounded-md border bg-background px-3 text-sm" value={sector} onChange={(event) => { setConfirm(false); setSector(event.target.value); }}><option value="" disabled>Selecione o setor…</option>{[...new Set([...sectors, employee.sector].filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></label>
    <p className="text-xs text-muted-foreground">Função: {employee.job_function} (altere pelo lápis na lista). O setor soma seus acessos automáticos às áreas liberadas.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} />Reenviar e-mail de confirmação (se ainda não confirmado)</label>
    {confirm && <p role="alert" className="text-sm font-medium text-destructive">Tem certeza que deseja alterar este cadastro? Clique novamente para confirmar.</p>}
    <Button type="submit" disabled={busy}>{confirm ? "Confirmar correção" : "Salvar correções"}</Button>
  </form>;
}
