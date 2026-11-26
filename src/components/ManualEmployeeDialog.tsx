import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Eye, EyeOff, KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JOBS, adminEmployeeCreationSchema, formatEmployeeAccessSummary, generateSecurePassword, needsCouncil, type AdminEmployeeCreation } from "@/lib/employee-rules";
import { adminCreateEmployee } from "@/lib/employees.functions";

const EMPTY: AdminEmployeeCreation = {
  full_name: "", username: "", email: "", password: "", cpf: "", phone: "",
  birth_date: "", address: "", job_function: "Recepcionista", sector: "",
  other_function: "", council_type: "", council_number: "", council_state: "",
  approve_immediately: true,
};

type Props = { open: boolean; onOpenChange: (open: boolean) => void; sectors: string[]; onCreated: () => void };

export function ManualEmployeeDialog({ open, onOpenChange, sectors, onCreated }: Props) {
  const createEmployee = useServerFn(adminCreateEmployee);
  const [form, setForm] = useState<AdminEmployeeCreation>(EMPTY);
  const [showPassword, setShowPassword] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ full_name: string; username: string; email: string; password: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => { setForm(EMPTY); setError(""); setCreated(null); setCopied(false); };
  const handleOpenChange = (next: boolean) => { if (!next) reset(); onOpenChange(next); };
  const generate = () => { setForm((f) => ({ ...f, password: generateSecurePassword(12) })); setShowPassword(true); };

  const copySummary = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(formatEmployeeAccessSummary(created));
      setCopied(true);
      toast.success("Dados de acesso copiados");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const parsed = adminEmployeeCreationSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados"); return; }
    setBusy(true);
    try {
      const res = await createEmployee({ data: parsed.data });
      if (!res.ok) { setError(res.message); return; }
      toast.success(res.message);
      setCreated({ full_name: parsed.data.full_name, username: parsed.data.username, email: parsed.data.email, password: parsed.data.password, message: res.message });
      onCreated();
    } catch {
      setError("Não foi possível cadastrar o colaborador. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof AdminEmployeeCreation, label: string, type = "text", required = true) => (
    <label key={key} className="grid gap-1 text-xs font-medium">
      {label}{required ? " *" : ""}
      <Input type={type} value={String(form[key] ?? "")} required={required} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{created ? "Colaborador cadastrado" : "Cadastrar colaborador manualmente"}</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <p className="text-sm text-clinical">{created.message}</p>
            <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
              <div><span className="text-muted-foreground">Colaborador:</span> <strong>{created.full_name}</strong></div>
              <div><span className="text-muted-foreground">Usuário:</span> <code>{created.username}</code></div>
              <div><span className="text-muted-foreground">E-mail:</span> <code>{created.email}</code></div>
              <div><span className="text-muted-foreground">Senha inicial:</span> <code className="font-semibold">{created.password}</code></div>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => void copySummary()}>
                {copied ? <Check /> : <Copy />}{copied ? "Copiado" : "Copiar dados de acesso"}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={reset}><UserPlus />Cadastrar outro</Button>
                <Button type="button" onClick={() => handleOpenChange(false)}>Fechar</Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <section className="space-y-3">
              <h3 className="border-b pb-1 text-xs font-semibold uppercase text-muted-foreground">Dados pessoais</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {field("full_name", "Nome completo")}
                {field("cpf", "CPF (somente números)")}
                {field("birth_date", "Data de nascimento", "date")}
                {field("phone", "Telefone", "tel")}
                <div className="sm:col-span-2">{field("address", "Endereço completo")}</div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="border-b pb-1 text-xs font-semibold uppercase text-muted-foreground">Função e setor no hospital</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium">
                  Função *
                  <select value={form.job_function} onChange={(e) => setForm((f) => ({ ...f, job_function: e.target.value as AdminEmployeeCreation["job_function"] }))} className="h-9 rounded-md border bg-background px-3 text-sm">
                    {JOBS.map((job) => <option key={job}>{job}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  Setor *
                  <select required aria-label="Setor" value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} className="h-9 rounded-md border bg-background px-3 text-sm">
                    <option value="" disabled>Selecione o setor…</option>
                    {sectors.map((sector) => <option key={sector}>{sector}</option>)}
                  </select>
                </label>
                {form.job_function === "Outro" && field("other_function", "Qual função?")}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {field("council_type", "Conselho (CRM, COREN…)", "text", needsCouncil(form.job_function))}
                {field("council_number", "Número do conselho", "text", needsCouncil(form.job_function))}
                {field("council_state", "UF do conselho", "text", needsCouncil(form.job_function))}
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="border-b pb-1 text-xs font-semibold uppercase text-muted-foreground">Conta de acesso</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {field("username", "Nome de usuário")}
                {field("email", "E-mail", "email")}
                <div className="sm:col-span-2 grid gap-1 text-xs font-medium">
                  <span>Senha inicial *</span>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="pr-9" />
                      <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" onClick={generate}><KeyRound />Gerar senha segura</Button>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.approve_immediately ?? true} onChange={(e) => setForm((f) => ({ ...f, approve_immediately: e.target.checked }))} className="size-4 rounded border" />
                Liberar acesso imediatamente com as áreas padrão da função e do setor
              </label>
            </section>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy}><UserPlus />{busy ? "Cadastrando…" : "Cadastrar colaborador"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}