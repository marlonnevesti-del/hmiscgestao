import { useEffect, useState, type FormEvent } from "react";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoPermission } from "@/components/AppShell";
import { canAct } from "@/lib/hospital-data";
import { saveInstitution, useStore } from "@/lib/hospital-store";
import type { InstitutionConfig } from "@/lib/institution";

export function InstitutionForm({ onSaved }: { onSaved?: () => void }) {
  const stored = useStore((s) => s.institution);
  const profile = useStore((s) => s.profile);
  const accessAreas = useStore((s) => s.accessAreas);
  const allowed = canAct(profile, "faturar", accessAreas) || profile === "Administrador";
  const [form, setForm] = useState<InstitutionConfig>(stored);

  useEffect(() => { setForm(stored); }, [stored]);

  const setField = <K extends keyof InstitutionConfig>(k: K, v: InstitutionConfig[K]) =>
    setForm((cur) => ({ ...cur, [k]: v }));

  const setDiretor = <K extends keyof InstitutionConfig["diretorClinico"]>(k: K, v: string) =>
    setForm((cur) => ({ ...cur, diretorClinico: { ...cur.diretorClinico, [k]: v } }));

  const setFaturista = <K extends keyof InstitutionConfig["faturista"]>(k: K, v: string) =>
    setForm((cur) => ({ ...cur, faturista: { ...cur.faturista, [k]: v } }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!allowed) return;
    const cnesDigits = form.cnes.replace(/\D/g, "");
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    if (cnesDigits.length !== 7) { toast.error("CNES deve ter 7 dígitos."); return; }
    if (cnpjDigits.length !== 14) { toast.error("CNPJ do hospital deve ter 14 dígitos."); return; }
    try {
      saveInstitution(form);
      toast.success("Dados do hospital salvos e aplicados ao faturamento SUS.");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar os dados.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!allowed && <NoPermission action="alterar os dados institucionais do hospital (Faturamento ou Administração)" />}

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4" />Identificação jurídica e SUS</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium">Razão Social da Mantenedora<Input required disabled={!allowed} value={form.razaoSocial} onChange={(e) => setField("razaoSocial", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">Nome do Estabelecimento (Fantasia)<Input required disabled={!allowed} value={form.nomeFantasia} onChange={(e) => setField("nomeFantasia", e.target.value)} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium">Sigla (até 6 caracteres)<Input required maxLength={6} disabled={!allowed} value={form.sigla} onChange={(e) => setField("sigla", e.target.value.toUpperCase())} /></label>
          <label className="grid gap-1 text-xs font-medium">CNPJ do Hospital (14 dígitos)<Input required disabled={!allowed} value={form.cnpj} onChange={(e) => setField("cnpj", e.target.value)} placeholder="47.708.771/0026-50" /></label>
          <label className="grid gap-1 text-xs font-medium">CNPJ da Mantenedora<Input disabled={!allowed} value={form.cnpjMantenedora} onChange={(e) => setField("cnpjMantenedora", e.target.value)} placeholder="Opcional" /></label>
          <label className="grid gap-1 text-xs font-medium">CNES (7 dígitos)<Input required maxLength={7} disabled={!allowed} value={form.cnes} onChange={(e) => setField("cnes", e.target.value.replace(/\D/g, ""))} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-[140px_180px_1fr]">
          <label className="grid gap-1 text-xs font-medium">IBGE Município<Input required maxLength={7} disabled={!allowed} value={form.ibgeMunicipio} onChange={(e) => setField("ibgeMunicipio", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="grid gap-1 text-xs font-medium">Esfera de Gestão
            <select disabled={!allowed} className="h-9 rounded-md border bg-background px-3 text-sm" value={form.esferaGestao} onChange={(e) => setField("esferaGestao", e.target.value === "M" ? "M" : "E")}>
              <option value="E">Estadual (E)</option>
              <option value="M">Municipal (M)</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">Órgão Gestor de Destino (cabeçalho BPA/SUS)<Input required disabled={!allowed} value={form.orgaoGestor} onChange={(e) => setField("orgaoGestor", e.target.value)} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Endereço e contato institucional</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_100px_180px]">
          <label className="grid gap-1 text-xs font-medium">Logradouro<Input disabled={!allowed} value={form.logradouro} onChange={(e) => setField("logradouro", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">Número<Input disabled={!allowed} value={form.numero} onChange={(e) => setField("numero", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">Complemento<Input disabled={!allowed} value={form.complemento} onChange={(e) => setField("complemento", e.target.value)} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium">Bairro<Input disabled={!allowed} value={form.bairro} onChange={(e) => setField("bairro", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">CEP<Input disabled={!allowed} value={form.cep} onChange={(e) => setField("cep", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">Município<Input disabled={!allowed} value={form.municipio} onChange={(e) => setField("municipio", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">UF<Input maxLength={2} disabled={!allowed} value={form.uf} onChange={(e) => setField("uf", e.target.value.toUpperCase())} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium">Telefone<Input disabled={!allowed} value={form.telefone} onChange={(e) => setField("telefone", e.target.value)} placeholder="(48) ..." /></label>
          <label className="grid gap-1 text-xs font-medium">E-mail do Faturamento / Regulação<Input type="email" disabled={!allowed} value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="faturamento@hmisc.com.br" /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Diretor Clínico / Técnico</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_110px_70px]">
          <label className="grid gap-1 text-xs font-medium">Nome completo<Input disabled={!allowed} value={form.diretorClinico.nome} onChange={(e) => setDiretor("nome", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">CRM<Input disabled={!allowed} value={form.diretorClinico.crm} onChange={(e) => setDiretor("crm", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">UF<Input maxLength={2} disabled={!allowed} value={form.diretorClinico.uf} onChange={(e) => setDiretor("uf", e.target.value.toUpperCase())} /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium">CNS (15 dígitos)<Input maxLength={15} disabled={!allowed} value={form.diretorClinico.cns} onChange={(e) => setDiretor("cns", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="grid gap-1 text-xs font-medium">CPF<Input disabled={!allowed} value={form.diretorClinico.cpf} onChange={(e) => setDiretor("cpf", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">CBO<Input maxLength={6} disabled={!allowed} value={form.diretorClinico.cbo} onChange={(e) => setDiretor("cbo", e.target.value.replace(/\D/g, ""))} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Responsável pelo Faturamento / Digitação</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium">Nome<Input disabled={!allowed} value={form.faturista.nome} onChange={(e) => setFaturista("nome", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">CNS (15 dígitos)<Input maxLength={15} disabled={!allowed} value={form.faturista.cns} onChange={(e) => setFaturista("cns", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="grid gap-1 text-xs font-medium">CPF<Input disabled={!allowed} value={form.faturista.cpf} onChange={(e) => setFaturista("cpf", e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-medium">CBO<Input maxLength={6} disabled={!allowed} value={form.faturista.cbo} onChange={(e) => setFaturista("cbo", e.target.value.replace(/\D/g, ""))} /></label>
        </div>
      </section>

      {allowed && (
        <div className="flex justify-end">
          <Button type="submit"><Save className="size-4" />Salvar dados do hospital</Button>
        </div>
      )}
    </form>
  );
}