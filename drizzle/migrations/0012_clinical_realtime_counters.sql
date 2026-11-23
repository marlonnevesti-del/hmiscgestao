CREATE TABLE public.clinical_counters (kind text PRIMARY KEY, value bigint NOT NULL DEFAULT 0);
GRANT SELECT ON public.clinical_counters TO authenticated;
GRANT ALL ON public.clinical_counters TO service_role;
ALTER TABLE public.clinical_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY counters_read ON public.clinical_counters FOR SELECT TO authenticated USING (public.is_approved_employee(auth.uid()));
INSERT INTO public.clinical_counters(kind, value)
SELECT 'baa', coalesce((SELECT (data->>'beSequence')::bigint FROM public.clinical_state WHERE id='main'),0)
UNION ALL SELECT 'fia', coalesce((SELECT (data->>'fiaSequence')::bigint FROM public.clinical_state WHERE id='main'),0)
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.next_clinical_number(_kind text, _min bigint DEFAULT 0)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v bigint;
BEGIN
  IF NOT public.is_approved_employee(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _kind NOT IN ('baa','fia') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  INSERT INTO public.clinical_counters(kind, value) VALUES (_kind, greatest(coalesce(_min,0),0) + 1)
  ON CONFLICT (kind) DO UPDATE SET value = greatest(public.clinical_counters.value, coalesce(_min,0)) + 1
  RETURNING value INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.next_clinical_number(text, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_clinical_number(text, bigint) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_state;