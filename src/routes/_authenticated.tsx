import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { loadEmployeeAccess } from "@/lib/employee-access";
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const access = await loadEmployeeAccess();
    if (!access) throw redirect({ to: "/auth" });
    if (access.profile.status !== "approved") throw redirect({ to: "/pendente" });
  },
  component: Outlet,
});