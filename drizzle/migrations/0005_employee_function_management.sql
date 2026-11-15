CREATE OR REPLACE FUNCTION public.set_employee_function(target_id uuid, new_function text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.is_approved_employee(auth.uid()) OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN RAISE EXCEPTION 'Apenas administradores liberados podem definir funções'; END IF;
 IF target_id = auth.uid() OR public.has_role(target_id, 'admin') OR public.has_role(target_id, 'super_admin') THEN RAISE EXCEPTION 'Conta administrativa protegida'; END IF;
 IF new_function NOT IN ('Recepcionista','Médico','Enfermeiro','Técnico de enfermagem','Farmacêutico','Fisioterapeuta','Administrativo') AND new_function NOT LIKE 'Outro: %' THEN RAISE EXCEPTION 'Função inválida'; END IF;
 IF length(new_function) > 107 OR length(trim(new_function)) < 3 THEN RAISE EXCEPTION 'Função inválida'; END IF;
 UPDATE public.profiles SET job_function = new_function WHERE id = target_id AND status IN ('pending','approved','blocked');
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não disponível'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_employee_function(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_employee_function(uuid,text) TO authenticated, service_role;