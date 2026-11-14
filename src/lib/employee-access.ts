import { supabase } from "@/integrations/supabase/client";
import { clinicalProfile } from "./employee-rules";
import { setState } from "./hospital-store";

export async function loadEmployeeAccess() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (profileError || roleError || !profile) throw new Error("Não foi possível verificar seu cadastro. Tente novamente.");
  const roles = (roleRows ?? []).map((r) => r.role);
  if (profile.status === "approved") setState(() => ({ profile: clinicalProfile(profile.job_function, roles), employeeName: profile.full_name }));
  return { profile, roles };
}