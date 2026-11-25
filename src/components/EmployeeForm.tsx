import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOBS, employeeSchema, needsCouncil, type EmployeeRegistration } from "@/lib/employee-rules";
import { registerEmployee } from "@/lib/employees.functions";
import { employeeSectorListQuery } from "@/lib/employee-sector-queries";

const EMPTY: EmployeeRegistration = { full_name: "", username: "", email: "", password: "", cpf: "", phone: "", birth_date: "", address: "", job_function: "Recepcionista", sector: "", other_function: "", council_type: "", council_number: "", council_state: "" };
export function EmployeeForm() {
  const { data: sectors } = useSuspenseQuery(employeeSectorListQuery);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const register = useServerFn(registerEmployee);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const result = employeeSchema.safeParse(form);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Verifique os dados"); return; }
    setBusy(true);
    try { const response = await register({ data: { ...result.data, origin: window.location.origin } }); if (response.ok) { setDone(response.message); setForm(EMPTY); } else setError(response.message); }
    catch { setError("Não foi possível enviar o cadastro. Tente novamente."); }
    finally { setBusy(false); }
  };
  const field = (key: keyof EmployeeRegistration, label: string, type = "text", required = true) => <label key={key} className="grid gap-1 text-xs font-medium">{label}{required ? " *" : ""}<Input type={type} value={form[key] ?? ""} required={required} autoComplete={key === "password" ? "new-password" : undefined} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>;
  if (done) return <div className="space-y-4 border-t py-6"><h2 className="text-lg font-semibold text-clinical">Cadastro recebido</h2><p role="status" className="text-sm">{done}</p><Button asChild><Link to="/auth">Ir para o acesso</Link></Button></div>;
  return <form onSubmit={submit} className="space-y-6">
    <section className="space-y-3"><h2 className="border-b pb-2 text-sm font-semibold text-primary">Dados pessoais</h2><div className="grid gap-3 sm:grid-cols-2">{field("full_name", "Nome completo")}{field("cpf", "CPF (somente números)")}{field("birth_date", "Data de nascimento", "date")}{field("phone", "Telefone", "tel")}<div className="sm:col-span-2">{field("address", "Endereço completo")}</div></div></section>
    <section className="space-y-3"><h2 className="border-b pb-2 text-sm font-semibold text-primary">Função e setor no hospital</h2><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Função *<select value={form.job_function} onChange={(e) => setForm((f) => ({ ...f, job_function: e.target.value as EmployeeRegistration["job_function"] }))} className="h-9 rounded-md border bg-background px-3 text-sm">{JOBS.map((job) => <option key={job}>{job}</option>)}</select></label><label className="grid gap-1 text-xs font-medium">Setor *<select required aria-label="Setor" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="" disabled>Selecione o setor…</option>{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label>{form.job_function === "Outro" && field("other_function", "Qual função?")}</div><p className="text-xs text-muted-foreground">O setor identifica sua lotação e libera automaticamente as áreas associadas a ele, após a aprovação do administrador.</p><div className="grid gap-3 sm:grid-cols-3">{field("council_type", "Conselho (COREN, CRM, CREFITO…)", "text", needsCouncil(form.job_function))}{field("council_number", "Número do conselho", "text", needsCouncil(form.job_function))}{field("council_state", "UF do conselho", "text", needsCouncil(form.job_function))}</div></section>
    <section className="space-y-3"><h2 className="border-b pb-2 text-sm font-semibold text-primary">Conta de acesso</h2><div className="grid gap-3 sm:grid-cols-2">{field("username", "Nome de usuário")}{field("email", "E-mail", "email")}{field("password", "Senha", "password")}</div></section>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-between gap-3 border-t pt-4"><Button variant="outline" asChild><Link to="/auth">Já tenho cadastro</Link></Button><Button disabled={busy} type="submit"><UserPlus />{busy ? "Enviando…" : "Enviar cadastro"}</Button></div>
  </form>;
}