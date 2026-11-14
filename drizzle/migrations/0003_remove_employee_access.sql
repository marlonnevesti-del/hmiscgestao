CREATE OR REPLACE FUNCTION public.remove_employee_access(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'Não pode remover a própria conta'; END IF;
  PERFORM id FROM public.profiles WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_id AND role = 'super_admin') THEN RAISE EXCEPTION 'Administrador principal protegido'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_id AND role = 'admin') AND NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Somente administrador principal pode remover administradores'; END IF;
  UPDATE public.profiles SET status = 'removed', approved_by = auth.uid(), approved_at = now() WHERE id = target_id;
  DELETE FROM public.user_roles WHERE user_id = target_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_employee_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_employee_access(uuid) TO authenticated;
