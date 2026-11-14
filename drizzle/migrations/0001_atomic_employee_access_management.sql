CREATE FUNCTION public.review_employee(target_id uuid, new_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF new_status NOT IN ('approved','blocked') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF target_id=auth.uid() OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target_id AND role IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Cannot change administrator access'; END IF;
 UPDATE public.profiles SET status=new_status, approved_by=auth.uid(), approved_at=now() WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown employee'; END IF; END $$;
REVOKE ALL ON FUNCTION public.review_employee(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_employee(uuid,text) TO authenticated;
CREATE FUNCTION public.grant_administrator(target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.profiles SET status='approved', approved_by=auth.uid(), approved_at=now() WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown employee'; END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES(target_id,'admin') ON CONFLICT DO NOTHING; END $$;
REVOKE ALL ON FUNCTION public.grant_administrator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_administrator(uuid) TO authenticated;