import { Baby, Heart, HeartHandshake, Smile } from "lucide-react";
import type { PatientType } from "@/lib/hospital-data";
export const TYPE_LABEL: Record<PatientType, string> = { gestante: "Gestante", puerpera: "Puérpera", neonato: "RN", pediatria: "Pediátrico" };
export function PatientIcon({ type, className }: { type: PatientType; className?: string }) {
  const I = { gestante: Heart, puerpera: HeartHandshake, neonato: Baby, pediatria: Smile }[type] ?? Smile;
  return <I className={className ?? "h-3.5 w-3.5"} aria-label={TYPE_LABEL[type] ?? 'Paciente'} />;
}
