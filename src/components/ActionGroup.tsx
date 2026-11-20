import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Menu suspenso que mantém os botões montados (preserva janelas e impressões abertas pelos filhos). */
export function ActionGroup({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn("flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted", open && "bg-muted")}>
        {icon}{label}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <div
        className={cn("absolute right-0 top-full z-50 mt-1 w-64 flex-col gap-1 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg [&_button]:w-full [&_button]:justify-start [&_button]:border-0", open ? "flex" : "hidden")}
        onClick={(ev) => { if ((ev.target as HTMLElement).closest("button")) setOpen(false); }}
      >
        {children}
      </div>
    </div>
  );
}
