import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ACCESS_AREAS, UNIT_AREAS } from "@/lib/hospital-data";
import { cn } from "@/lib/utils";
import { WAREHOUSE_CATEGORIES, requestAreaId, type WarehouseCategory } from "@/lib/warehouse-categories";

/** Area picker: care units expand into their sub-levels (stored as "unit:tab"). */
export function AreaTree({ value, onChange, requestDefaults = [] }: { value: string[]; onChange: (v: string[]) => void; requestDefaults?: WarehouseCategory[] }) {
  const reqIds = WAREHOUSE_CATEGORIES.map((c) => requestAreaId(c.id));
  const hasReq = value.some((x) => reqIds.includes(x));
  const reqOn = (c: WarehouseCategory) => hasReq ? value.includes(requestAreaId(c)) : requestDefaults.includes(c);
  const toggleReq = (c: WarehouseCategory, on: boolean) => { const cur = WAREHOUSE_CATEGORIES.map((x) => x.id).filter((x) => x === c ? on : reqOn(x)); onChange([...value.filter((x) => !reqIds.includes(x)), ...cur.map(requestAreaId)]); };
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));
  return <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
    {UNIT_AREAS.map((u) => {
      const ids = u.tabs.map((t) => `${u.id}:${t.id}`);
      const legacy = value.includes(u.id);
      const n = legacy ? ids.length : ids.filter((i) => value.includes(i)).length;
      const expanded = open === u.id;
      const setAll = (on: boolean) => { const rest = value.filter((x) => x !== u.id && !ids.includes(x)); onChange(on ? [...rest, ...ids] : rest); };
      return <div key={u.id} className="rounded-md border">
        <div className="flex items-center gap-2 p-2 text-sm">
          <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : u.id)} className="flex flex-1 items-center gap-2 text-left font-medium">
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />{u.label}
            <span className="text-xs font-normal text-muted-foreground">({n} de {ids.length} liberados)</span>
          </button>
          <button type="button" className="text-xs text-primary underline" onClick={() => setAll(n < ids.length)}>{n < ids.length ? "Marcar todos" : "Desmarcar todos"}</button>
        </div>
        {expanded && <div className="grid gap-1 border-t p-2 pl-8 sm:grid-cols-2">
          {u.tabs.map((t) => { const id = `${u.id}:${t.id}`; return <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={legacy || value.includes(id)} onChange={(ev) => { const base = legacy ? [...value.filter((x) => x !== u.id), ...ids] : value; onChange(ev.target.checked ? [...new Set([...base, id])] : base.filter((x) => x !== id)); }} />{t.label}</label>; })}
        </div>}
      </div>;
    })}
    <div className="pt-2 text-xs uppercase tracking-wider text-muted-foreground">Demais setores</div>
    <div className="grid gap-2 sm:grid-cols-2">{ACCESS_AREAS.map((a) => <label key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" checked={value.includes(a.id)} onChange={(ev) => toggle(a.id, ev.target.checked)} />{a.label}</label>)}</div>
    <div className="pt-2 text-xs uppercase tracking-wider text-muted-foreground">Solicitação ao Almoxarifado · categorias liberadas</div>
    <div className="grid gap-2 sm:grid-cols-2">{WAREHOUSE_CATEGORIES.map((c) => <label key={c.id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" checked={reqOn(c.id)} onChange={(ev) => toggleReq(c.id, ev.target.checked)} />{c.label}</label>)}</div>
  </div>;
}
