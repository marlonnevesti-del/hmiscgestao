import { useId, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/hospital-store";
import { findDoctor, mergeDoctors, searchDoctors } from "@/lib/doctors";

/** Name field with autocomplete from the doctors catalog; picking a known doctor fills the CRM. */
export function DoctorNameInput({ value, onChange, onCrm, className, disabled }: { value: string; onChange: (v: string) => void; onCrm?: (crm: string) => void; className?: string; disabled?: boolean }) {
  const id = useId(); const learned = useStore((s) => s.doctors);
  const all = useMemo(() => mergeDoctors(learned ?? []), [learned]);
  const hits = searchDoctors(all, value, 12);
  return <>
    <Input list={id} value={value} disabled={disabled} className={className} autoComplete="off" onChange={(e) => { const v = e.target.value; onChange(v); const d = findDoctor(all, v); if (d?.crm) onCrm?.(d.crm); }} />
    <datalist id={id}>{hits.map((d) => <option key={d.name} value={d.name}>{[d.crm, d.specialty].filter(Boolean).join(" · ")}</option>)}</datalist>
  </>;
}
