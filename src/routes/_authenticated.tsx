import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { loadEmployeeAccess } from "@/lib/employee-access";
import { clinicalProfile } from "@/lib/employee-rules";
import { canAccessPage } from "@/lib/hospital-data";
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const access = await loadEmployeeAccess();
    if (!access) throw redirect({ to: "/auth" });
    if (access.profile.status !== "approved") throw redirect({ to: "/pendente" });
    if (!canAccessPage(clinicalProfile(access.profile.job_function, access.roles), location.pathname, access.profile.access_areas)) throw redirect({ to: "/" });
  },
  component: Outlet,
});