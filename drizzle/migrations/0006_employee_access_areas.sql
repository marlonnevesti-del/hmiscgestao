ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_areas text[];
CREATE OR REPLACE FUNCTION public.set_employee_areas(target_id uuid, areas text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.is_approved_employee(auth.uid()) OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
 IF target_id = auth.uid() OR public.has_role(target_id, 'admin') OR public.has_role(target_id, 'super_admin') THEN RAISE EXCEPTION 'Conta administrativa protegida'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(areas) a WHERE a NOT IN ('recepcao','acolhimento','atendimento','pacientes','enfermagem','centro-cirurgico','farmacia','almoxarifado','faturamento')) THEN RAISE EXCEPTION 'Área inválida'; END IF;
 UPDATE public.profiles SET access_areas = areas WHERE id = target_id AND status IN ('pending','approved','blocked');
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não disponível'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_employee_areas(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_employee_areas(uuid,text[]) TO authenticated, service_role;