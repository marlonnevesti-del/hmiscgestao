import { createFileRoute } from '@tanstack/react-router';
import { MedicalQueue } from '@/components/CareMedical';
import { employeeHead } from '@/lib/employee-rules';
export const Route = createFileRoute('/_authenticated/atendimento')({ head:()=>employeeHead('Consultório médico e reavaliação','Fila médica por classificação Manchester e atendimento integrado ao BAA do HMISC.'), component:MedicalQueue });