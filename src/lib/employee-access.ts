import { supabase } from "@/integrations/supabase/client";
import { clinicalProfile } from "./employee-rules";
import { areaFor } from "./cid-access";
import { setState, setEmployeeCrm } from "./hospital-store";

export async function loadEmployeeAccess() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (profileError || roleError || !profile) throw new Error("Não foi possível verificar seu cadastro. Tente novamente.");
  const roles = (roleRows ?? []).map((r) => r.role);
  if (profile.status === "approved") {
    setEmployeeCrm(profile.council_type === 'CRM' && profile.council_number && profile.council_state ? `CRM/${profile.council_state} ${profile.council_number}` : '');
    setState(() => ({ profile: clinicalProfile(profile.job_function, roles), employeeName: profile.full_name, employeeArea: areaFor(profile.job_function), accessAreas: profile.access_areas ?? null }));
  }
  return { profile, roles };
}