CREATE OR REPLACE FUNCTION public.is_approved_employee(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;

CREATE TABLE public.clinical_state (
  id text PRIMARY KEY DEFAULT 'main',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clinical_state TO authenticated;
GRANT ALL ON public.clinical_state TO service_role;
ALTER TABLE public.clinical_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinical_read ON public.clinical_state FOR SELECT TO authenticated USING (public.is_approved_employee(auth.uid()));
CREATE POLICY clinical_insert ON public.clinical_state FOR INSERT TO authenticated WITH CHECK (public.is_approved_employee(auth.uid()));
CREATE POLICY clinical_update ON public.clinical_state FOR UPDATE TO authenticated USING (public.is_approved_employee(auth.uid())) WITH CHECK (public.is_approved_employee(auth.uid()));