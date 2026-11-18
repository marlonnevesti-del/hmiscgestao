import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lookupCep, lookupCityCode } from "@/lib/ibge";
import { emptyAddress, type PatientAddress, patientAge, presentationName, type PatientRegistration, type RegistrationMode } from "@/lib/patient-registration";

type Field = [keyof PatientRegistration, string, string[]?];
const states = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const education = ["Não informado", "Sem escolaridade", "Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Superior incompleto", "Superior completo", "Pós-graduação"];
const general: Field[] = [
  ["civilName", "Nome civil"], ["birthDate", "Data de nascimento"], ["bloodType", "Tipo sanguíneo", ["A", "B", "AB", "O"]], ["rhFactor", "Fator RH", ["Positivo", "Negativo", "Não informado"]],
  ["sex", "Sexo", ["Masculino", "Feminino", "Não informado"]],
  ["insurance", "Convênio / SUS", ["SUS", "Particular", "Unimed", "Bradesco Saúde", "Amil", "SulAmérica"]], ["insuranceCategory", "Categoria do convênio"], ["insuranceCard", "Carteira do convênio"],
  ["cns", "Cartão de saúde (CNS)"], ["nationality", "Nacionalidade"], ["countryEntryDate", "Data de entrada no país"], ["maritalStatus", "Estado civil", ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "Não informado"]],
  ["education", "Grau de instrução", education], ["spouse", "Nome do cônjuge"], ["parent1", "Nome filiação 1 (mãe, quando elegível)"], ["parent2", "Nome filiação 2"],
  ["skinColor", "Cor (pele)", ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Não informada"]], ["ethnicity", "Etnia"], ["cpf", "CPF"], ["identityDocument", "CIN / RG"], ["birthCertificate", "Certidão de nascimento (matrícula)"], ["religion", "Religião"],
  ["birthplaceState", "Naturalidade · UF", states], ["birthplaceCode", "Naturalidade · código"], ["birthplace", "Naturalidade · cidade"], ["observation1", "Observação 1"], ["observation2", "Observação 2"],
];
const other: Field[] = [
  ["profession", "Profissão"], ["occupationCode", "Ocupação · código"], ["occupation", "Ocupação"], ["originState", "Cidade de origem · UF", states], ["originCityCode", "Cidade de origem · código"], ["originCity", "Cidade de origem"],
  ["pis", "Número PIS / PASEP"], ["passport", "Passaporte"], ["rne", "RNE"], ["guardian", "Nome do responsável"], ["guardianRelationship", "Parentesco", ["Mãe", "Pai", "Avó / Avô", "Irmão / Irmã", "Cônjuge", "Tutor(a)", "Outro"]],
  ["guardianAreaCode", "DDD do responsável"], ["guardianPhone", "Telefone do responsável"], ["communicationBarrier", "Barreira de comunicação", ["Nenhuma", "Auditiva", "Visual", "Fala", "Idioma", "Cognitiva", "Outra"]],
];

const REQUIRED: Record<RegistrationMode, string[]> = {
  completo: ["civilName", "birthDate", "sex", "parent1", "skinColor", "birthplaceState", "birthplace"],
  simplificado: ["civilName", "sex"],
};
const RECOMMENDED_SIMPLE = ["birthDate", "parent1", "skinColor", "birthplaceState", "birthplace"];
const simple: Field[] = [
  ["civilName", "Nome civil"], ["sex", "Sexo", ["Masculino", "Feminino", "Não informado"]], ["birthDate", "Data de nascimento"],
  ["bloodType", "Tipo sanguíneo", ["A", "B", "AB", "O"]], ["rhFactor", "Fator RH", ["Positivo", "Negativo", "Não informado"]],
  ["parent2", "Nome do pai"], ["parent1", "Nome da mãe"], ["nationality", "Nacionalidade"], ["countryEntryDate", "Data de entrada no país"],
  ["birthplaceState", "Naturalidade · UF", states], ["birthplace", "Naturalidade · cidade"], ["cpf", "CPF"], ["cns", "CNS"],
  ["skinColor", "Cor (pele)", ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Não informada"]], ["ethnicity", "Etnia"], ["esusCode", "Código e-SUS"],
];

export function PatientRegistrationFields({ value: r, onChange, recordNumber, readOnly = false, mode = "completo", birthError }: { birthError?: string | null; value: PatientRegistration; onChange: (value: PatientRegistration) => void; recordNumber?: string | undefined; readOnly?: boolean; mode?: RegistrationMode }) {
  const req = REQUIRED[mode];
  const mark = (key: string, label: string) => req.includes(key) ? <span className="font-semibold text-primary">{label} *</span> : mode === "simplificado" && RECOMMENDED_SIMPLE.includes(key) ? <span className="text-primary">{label}</span> : label;
  /** Ao preencher UF + cidade de naturalidade/origem, busca o código IBGE automaticamente. */
  const set = (key: keyof PatientRegistration, value: string | boolean) => {
    const next = { ...r, [key]: value } as PatientRegistration;
    onChange(next);
    const pairs = [["birthplaceState", "birthplace", "birthplaceCode"], ["originState", "originCity", "originCityCode"]] as const;
    for (const [uf, city, code] of pairs) if ((key === uf || key === city) && String(next[city]).trim() && String(next[uf]).length === 2)
      void lookupCityCode(String(next[uf]), String(next[city])).then((c) => { if (c) onChange({ ...next, [code]: c }); });
  };
  /** Atualiza um endereço e, ao completar CEP ou cidade, busca logradouro e código IBGE automaticamente. */
  const editAddress = (index: number, key: keyof PatientAddress, value: string) => {
    const base = r.addresses.length ? r.addresses : [emptyAddress()];
    const next = { ...base[index], [key]: value } as PatientAddress;
    const apply = (patch: Partial<PatientAddress>) => onChange({ ...r, addresses: base.map((a, i) => i === index ? { ...next, ...patch } : a) });
    apply({});
    if (key === "postalCode" && value.replace(/\D/g, "").length === 8) void lookupCep(value).then((c) => { if (c) apply({ street: next.street || c.street, streetType: next.streetType || c.streetType, neighborhood: next.neighborhood || c.neighborhood, city: c.city, state: c.state, cityCode: c.cityCode }); });
    if ((key === "city" || key === "state") && next.city && next.state.length === 2) void lookupCityCode(next.state, next.city).then((code) => { if (code) apply({ cityCode: code }); });
  };
  const fields = (list: Field[]) => list.map(([key, label, options]) => <label key={key} className="grid min-w-0 gap-1 text-xs">
    {mark(key, label)}{options ? <select aria-label={label} value={String(r[key])} onChange={e => set(key, e.target.value)} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-sm"><option value="">Não informado</option>{options.map(option => <option key={option}>{option}</option>)}{r[key] && !options.includes(String(r[key])) && <option>{String(r[key])}</option>}</select>
      : key.startsWith("observation") ? <textarea aria-label={label} value={String(r[key])} maxLength={2000} onChange={e => set(key, e.target.value)} className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
      : <Input aria-label={label} type={key.endsWith("Date") ? "date" : key === "weight" || key === "height" ? "number" : "text"} min={key === "weight" || key === "height" ? 0 : undefined} step={key === "weight" || key === "height" ? "any" : undefined} maxLength={200} value={String(r[key])} onChange={e => set(key, e.target.value)} className={key === "birthDate" && birthError ? "border-2 border-destructive" : undefined} aria-invalid={key === "birthDate" && !!birthError} />}
    {key === "birthDate" && birthError && <span className="font-semibold text-destructive">{birthError}</span>}
  </label>);
  const check = (key: keyof PatientRegistration, label: string) => <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(r[key])} onCheckedChange={v => set(key, v === true)} />{label}</label>;
  const unknownToggle = <label className="flex items-center gap-2 text-sm"><Checkbox checked={r.unknownIdentity} onCheckedChange={v => onChange({ ...r, unknownIdentity: v === true })} />Paciente desconhecido (sem documentação)</label>;
  if (mode === "simplificado") {
    const a = r.addresses[0] ?? emptyAddress();
    const p = r.phones[0] ?? { primary: true, type: "Celular", areaCode: "", number: "", complement: "" };
    const setP = (key: keyof typeof p, v: string) => onChange({ ...r, phones: [{ ...p, [key]: v }, ...r.phones.slice(1)] });
    return <fieldset disabled={readOnly} className="min-w-0 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-xs">Número de cadastro<Input readOnly value={recordNumber || "Automático"} /></label>
        <label className="grid gap-1 text-xs lg:col-span-2">Nome de apresentação<Input readOnly value={presentationName(r)} /></label>
      </div>
      <div className="flex flex-wrap items-end gap-4 rounded-md border border-primary/40 bg-primary/5 p-3">{unknownToggle}
        {r.unknownIdentity && <label className="grid gap-1 text-xs">Nº Desc.<Input aria-label="Número do desconhecido" value={r.unknownNumber} onChange={e => set("unknownNumber", e.target.value)} /></label>}
        <div className="space-y-2">{check("useSocialName", "Utilizar nome social")}<Input aria-label="Nome social" disabled={!r.useSocialName} value={r.socialName} onChange={e => set("socialName", e.target.value)} /></div>
        <div className="space-y-2 text-sm">{check("estimatedAge", "Idade estimada")}<div className="text-muted-foreground">{patientAge(r)}</div></div>
        {r.estimatedAge && <div className="grid grid-cols-3 gap-2">{fields([["ageYears", "Anos"], ["ageMonths", "Meses"], ["ageDays", "Dias"]])}</div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields(simple.filter(([k]) => !(r.unknownIdentity && k === "civilName")))}</div>
      {check("homeless", "Em situação de rua")}
      <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">{([["postalCode", "CEP"], ["streetType", "Tipo logradouro"], ["street", "Logradouro"], ["number", "Número"], ["neighborhood", "Bairro"], ["complement", "Complemento"], ["state", "UF"], ["city", "Cidade"], ["cityCode", "Cód. IBGE município"]] as const).map(([k, l]) => <label key={k} className="grid gap-1 text-xs"><span className={k === "complement" || k === "state" || k === "city" || k === "cityCode" ? "" : "text-primary"}>{l}</span><Input aria-label={l} maxLength={200} value={a[k]} onChange={e => editAddress(0, k, e.target.value)} /></label>)}</div>
      <div className="grid gap-3 border-t pt-3 sm:grid-cols-4"><h3 className="font-semibold sm:col-span-4">Telefone</h3>{([["type", "Tipo telefone"], ["areaCode", "DDD"], ["number", "Fone"], ["complement", "Complemento"]] as const).map(([k, l]) => <label key={k} className="grid gap-1 text-xs">{l}<Input aria-label={l} maxLength={200} value={p[k]} onChange={e => setP(k, e.target.value)} /></label>)}</div>
    </fieldset>;
  }
  return <Tabs defaultValue="general" className="min-w-0">
    <TabsList className="mb-3 flex h-auto w-fit max-w-full flex-wrap"><TabsTrigger value="general">Dados gerais</TabsTrigger><TabsTrigger value="contacts">Endereços / Telefones</TabsTrigger><TabsTrigger value="other">Outras informações</TabsTrigger></TabsList>
    <TabsContent value="general"><fieldset disabled={readOnly} className="min-w-0 space-y-4">
      <div className="grid gap-3 border-b pb-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs">Número de cadastro<Input readOnly value={recordNumber || "Automático"} /></label>
        {fields([["inpatientArchive", "Arquivo internação"], ["outpatientArchive", "Arquivo ambulatório / PS"], ["enrollment", "Matrícula"]])}
        <label className="grid gap-1 text-xs sm:col-span-2 lg:col-span-4">Nome de apresentação<Input readOnly value={presentationName(r)} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields(general.slice(0, 1).map(f => f))}
        <div className="space-y-2">{check("useSocialName", "Utilizar nome social")}<Input aria-label="Nome social" disabled={!r.useSocialName} maxLength={200} value={r.socialName} onChange={e => set("socialName", e.target.value)} /></div>
        <div className="space-y-2">{check("useAffectiveName", "Utilizar nome afetivo")}<Input aria-label="Nome afetivo" disabled={!r.useAffectiveName} maxLength={200} value={r.affectiveName} onChange={e => set("affectiveName", e.target.value)} /></div>
        {fields(general.slice(1, 2))}<div className="space-y-2 text-sm">{check("estimatedAge", "Idade estimada")}<div className="text-muted-foreground">{patientAge(r)}</div></div>
        {r.estimatedAge && <div className="grid grid-cols-3 gap-2">{fields([["ageYears", "Anos"], ["ageMonths", "Meses"], ["ageDays", "Dias"]])}</div>}
        {fields(general.slice(2))}
      </div>
      <div className="flex flex-wrap gap-6">{check("transgender", "Transgênero")}{check("unknownIdentity", "Desconhecido")}{r.unknownIdentity && <Input aria-label="Número do desconhecido" placeholder="Nº Desc." className="w-32" value={r.unknownNumber} onChange={e => set("unknownNumber", e.target.value)} />}{check("homeless", "Em situação de rua")}</div>
      <div className="grid gap-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-2"><div>Inclusão: {r.createdBy || "—"} · {r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : "—"}</div><div>Alteração: {r.updatedBy || "—"} · {r.updatedAt ? new Date(r.updatedAt).toLocaleString("pt-BR") : "—"}</div></div>
    </fieldset></TabsContent>
    <TabsContent value="contacts"><fieldset disabled={readOnly} className="min-w-0 space-y-6">
      <section className="space-y-3"><h3 className="font-semibold">Endereços</h3>
        {r.addresses.map((address, index) => <div key={index} className="space-y-3 border-b pb-4">
          <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><Checkbox checked={address.primary} onCheckedChange={v => onChange({ ...r, addresses: r.addresses.map((a, i) => ({ ...a, primary: i === index ? v === true : false })) })} />Principal</label><Button type="button" variant="ghost" size="icon" aria-label={`Remover endereço ${index + 1}`} onClick={() => onChange({ ...r, addresses: r.addresses.filter((_, i) => i !== index) })}><Trash2 className="size-4" /></Button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['type','Tipo'],['postalCode','CEP'],['streetType','Tipo de logradouro'],['street','Logradouro'],['number','Número'],['complement','Complemento'],['neighborhood','Bairro'],['state','UF'],['cityCode','Cód. IBGE município'],['city','Cidade'],['country','País'],['company','Nome da empresa'],['situation','Situação'],['shift','Turno']] as const).map(([key,label]) => <label key={key} className="grid gap-1 text-xs">{label}<Input aria-label={`${label} do endereço ${index + 1}`} maxLength={200} value={address[key]} onChange={e => editAddress(index, key, e.target.value)} /></label>)}</div>
        </div>)}
        <Button type="button" variant="outline" disabled={r.addresses.length >= 20} onClick={() => onChange({ ...r, addresses: [...r.addresses, { ...emptyAddress(), primary: !r.addresses.length }] })}><Plus className="size-4" />Adicionar endereço</Button>
      </section>
      <section className="space-y-3"><h3 className="font-semibold">Telefones</h3>{r.phones.map((phone, index) => <div key={index} className="grid items-end gap-3 border-b pb-3 sm:grid-cols-2 lg:grid-cols-6">{([['type','Tipo de telefone'],['areaCode','DDD'],['number','Telefone'],['complement','Complemento']] as const).map(([key,label]) => <label key={key} className="grid gap-1 text-xs">{label}<Input aria-label={`${label} ${index + 1}`} maxLength={200} value={phone[key]} onChange={e => onChange({ ...r, phones: r.phones.map((p,i) => i === index ? { ...p, [key]: e.target.value } : p) })} /></label>)}<label className="flex h-9 items-center gap-2 text-sm"><Checkbox checked={phone.primary} onCheckedChange={v => onChange({ ...r, phones: r.phones.map((p,i) => ({ ...p, primary: i === index ? v === true : false })) })} />Padrão</label><Button type="button" variant="ghost" size="icon" aria-label={`Remover telefone ${index + 1}`} onClick={() => onChange({ ...r, phones: r.phones.filter((_,i) => i !== index) })}><Trash2 className="size-4" /></Button></div>)}<Button type="button" variant="outline" disabled={r.phones.length >= 20} onClick={() => onChange({ ...r, phones: [...r.phones, { primary: !r.phones.length, type: "Celular", areaCode: "", number: "", complement: "" }] })}><Plus className="size-4" />Adicionar telefone</Button></section>
      <section className="space-y-3"><h3 className="font-semibold">E-mails</h3>{r.emails.map((email,index) => <div key={index} className="flex flex-wrap items-end gap-3"><label className="grid min-w-0 flex-1 gap-1 text-xs">E-mail<Input aria-label={`E-mail ${index + 1}`} type="email" maxLength={254} value={email.email} onChange={e => onChange({ ...r, emails: r.emails.map((p,i) => i === index ? { ...p, email: e.target.value } : p) })} /></label><label className="flex h-9 items-center gap-2 text-sm"><Checkbox checked={email.primary} onCheckedChange={v => onChange({ ...r, emails: r.emails.map((p,i) => ({ ...p, primary: i === index ? v === true : false })) })} />Padrão</label><Button type="button" variant="ghost" size="icon" aria-label={`Remover e-mail ${index + 1}`} onClick={() => onChange({ ...r, emails: r.emails.filter((_,i) => i !== index) })}><Trash2 className="size-4" /></Button></div>)}<Button type="button" variant="outline" disabled={r.emails.length >= 20} onClick={() => onChange({ ...r, emails: [...r.emails, { primary: !r.emails.length, email: "" }] })}><Plus className="size-4" />Adicionar e-mail</Button></section>
    </fieldset></TabsContent>
    <TabsContent value="other"><fieldset disabled={readOnly} className="min-w-0 space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields(other)}</div>{check("attendsSchool", "Frequenta escola")}<section className="border-t pt-4"><h3 className="mb-3 font-semibold">Informações do sistema legado</h3><div className="grid gap-3 sm:grid-cols-3">{fields([["legacyHospital", "Hospital"], ["legacyRecord", "Número do prontuário legado"], ["esusCode", "Código e-SUS"]])}</div></section></fieldset></TabsContent>
  </Tabs>;
}