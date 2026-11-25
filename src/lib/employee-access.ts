import { supabase } from "@/integrations/supabase/client";
import { clinicalProfile } from "./employee-rules";
import { areaFor } from "./cid-access";
import { defaultAreas } from "./hospital-data";
import { withSectorAreas } from "./employee-sectors";
import { setState, setEmployeeCrm } from "./hospital-store";

export async function loadEmployeeAccess() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (profileError || roleError || !profile) throw new Error("Não foi possível verificar seu cadastro. Tente novamente.");
  const roles = (roleRows ?? []).map((r) => r.role);
  if (profile.status === "approved") {
    const { data: sectorRows, error: sectorError } = await supabase.from("employee_sectors").select("name,access_areas").eq("is_active", true).limit(500);
    if (sectorError) throw new Error("Não foi possível verificar os acessos do seu setor. Tente novamente.");
    const clinical = clinicalProfile(profile.job_function, roles);
    const baseAreas = profile.access_areas ?? defaultAreas(clinical);
    setEmployeeCrm(profile.council_type === 'CRM' && profile.council_number && profile.council_state ? `CRM/${profile.council_state} ${profile.council_number}` : '');
    setState(() => ({ profile: clinical, employeeName: profile.full_name, employeeArea: areaFor(profile.job_function), accessAreas: withSectorAreas(baseAreas, profile.sector, sectorRows ?? []) }));
  }
  return { profile, roles };
}