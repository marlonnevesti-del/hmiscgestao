import { createFileRoute } from "@tanstack/react-router";
import { EmployeeForm } from "@/components/EmployeeForm";
import { employeeHead } from "@/lib/employee-rules";
export const Route = createFileRoute("/cadastro-colaborador")({ head: () => employeeHead("Cadastro de colaboradores", "Cadastro profissional de colaboradores do hospital, sujeito à aprovação administrativa."), component: Registration });
function Registration() { return <main className="mx-auto w-full max-w-3xl px-4 py-8"><h1 className="mb-6 text-2xl font-semibold">HMISC · Cadastro de colaborador</h1><EmployeeForm /></main>; }