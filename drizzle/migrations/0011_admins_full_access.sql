CREATE OR REPLACE FUNCTION public.grant_administrator(target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.profiles SET status='approved', approved_by=auth.uid(), approved_at=now() WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown employee'; END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES(target_id,'admin') ON CONFLICT DO NOTHING;
 INSERT INTO public.user_roles(user_id,role) VALUES(target_id,'super_admin') ON CONFLICT DO NOTHING;
END $$;
INSERT INTO public.user_roles(user_id, role)
SELECT ur.user_id, 'super_admin'::app_role FROM public.user_roles ur
WHERE ur.role = 'admin' AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = ur.user_id AND x.role = 'super_admin');