import { createFileRoute } from '@tanstack/react-router';
import { CarePharmacy } from '@/components/CarePharmacy';
import { employeeHead } from '@/lib/employee-rules';
export const Route=createFileRoute('/_authenticated/enfermagem')({head:()=>employeeHead('Posto de enfermagem e medicação','Aprazamento, dispensação e checagem das medicações por BE no HMISC.'),component:()=> <CarePharmacy nursingOnly/>});