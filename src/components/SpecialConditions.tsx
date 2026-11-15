import { Accessibility, AlertTriangle } from "lucide-react";
import { specialConditionsText } from "@/lib/special-conditions";
import { cn } from "@/lib/utils";

type ConditionPatient = { specialConditions?: string[]; otherSpecialCondition?: string } | null | undefined;

export function SpecialConditionBadges({ patient, className }: { patient: ConditionPatient; className?: string }) {
  const conditions = specialConditionsText(patient?.specialConditions, patient?.otherSpecialCondition);
  if (!conditions.length) return null;
  return <span className={cn("inline-flex flex-wrap gap-1", className)}>{conditions.map((condition) => <span key={condition} className="inline-flex items-center gap-1 rounded-full border border-clinical/30 bg-clinical-soft px-2 py-0.5 text-[10px] font-medium text-clinical"><Accessibility className="h-3 w-3" />{condition}</span>)}</span>;
}

export function SpecialConditionsBanner({ patient }: { patient: ConditionPatient }) {
  const conditions = specialConditionsText(patient?.specialConditions, patient?.otherSpecialCondition);
  if (!conditions.length) return null;
  return <div role="alert" className="flex items-start gap-3 rounded-lg border-2 border-primary bg-clinical-soft p-4 text-foreground">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-clinical" />
    <div><div className="font-semibold">Atenção: paciente com condição especial — {conditions.join(", ")}</div><div className="text-sm">Garanta acolhimento adequado: ambiente calmo, comunicação clara, presença do acompanhante e prioridade quando possível.</div></div>
  </div>;
}
