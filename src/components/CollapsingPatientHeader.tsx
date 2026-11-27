import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Scroll-driven presentation only; never changes patient or encounter data. */
export function CollapsingPatientHeader({ patientId, compact, children }: {
  patientId: string;
  compact: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);
  const ignoreUntil = useRef(0);

  const change = (value: boolean) => {
    // Layout/scroll anchoring during the transition must not reverse the action.
    ignoreUntil.current = performance.now() + 350;
    setCollapsed(value);
  };

  useEffect(() => {
    setCollapsed(false);
    lastY.current = window.scrollY;
    ignoreUntil.current = performance.now() + 350;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      if (performance.now() < ignoreUntil.current) {
        lastY.current = y;
        return;
      }
      const delta = y - lastY.current;
      if (Math.abs(delta) < 8 && y > 16) return;
      lastY.current = y;
      if (y <= 16 || delta < -8) {
        setCollapsed((previous) => {
          if (previous) ignoreUntil.current = performance.now() + 350;
          return false;
        });
      } else if (y > 48 && delta > 8) {
        setCollapsed((previous) => {
          if (!previous) ignoreUntil.current = performance.now() + 350;
          return true;
        });
      }
    };
    // A short page may return to scrollY=0 after shrinking. Upward intent
    // still needs to expand it even when there is no remaining scroll range.
    const expandAtTop = () => {
      if (window.scrollY <= 16 && performance.now() >= ignoreUntil.current) {
        ignoreUntil.current = performance.now() + 350;
        setCollapsed(false);
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < -8) expandAtTop();
    };
    let touchY = 0;
    const onTouchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; };
    const onTouchMove = (event: TouchEvent) => {
      if ((event.touches[0]?.clientY ?? touchY) - touchY > 12) expandAtTop();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [patientId]);

  return (
    <section aria-label="Cabeçalho do paciente" data-collapsed={collapsed}
      className="sticky top-14 z-20 -mx-5 -mt-5 border-b bg-card px-3 py-2 sm:px-5 print:hidden">
      <div className={cn("flex items-start gap-2", !collapsed && "justify-end")}>
        {collapsed && <div className="min-w-0 flex-1">{compact}</div>}
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          aria-label={collapsed ? "Expandir cabeçalho do paciente" : "Recolher cabeçalho do paciente"}
          title={collapsed ? "Expandir cabeçalho do paciente" : "Recolher cabeçalho do paciente"}
          aria-expanded={!collapsed} aria-controls="patient-header-details"
          onClick={() => change(!collapsed)}>
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>
      <div id="patient-header-details" inert={collapsed}
        className={cn("grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}