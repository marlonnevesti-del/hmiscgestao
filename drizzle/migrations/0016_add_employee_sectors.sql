ALTER TABLE public.profiles ADD COLUMN sector text NOT NULL DEFAULT '';

CREATE TABLE public.employee_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 80),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employee_sectors TO anon;
GRANT SELECT, INSERT ON public.employee_sectors TO authenticated;
GRANT ALL ON public.employee_sectors TO service_role;
ALTER TABLE public.employee_sectors ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX employee_sectors_name_unique ON public.employee_sectors (lower(name));
CREATE POLICY employee_sectors_public_read ON public.employee_sectors FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY employee_sectors_admin_insert ON public.employee_sectors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.handle_employee_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.profiles(id,full_name,username,email,cpf,phone,birth_date,address,job_function,sector,council_type,council_number,council_state) VALUES (NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),coalesce(NEW.raw_user_meta_data->>'username',''),coalesce(NEW.email,''),coalesce(NEW.raw_user_meta_data->>'cpf',''),coalesce(NEW.raw_user_meta_data->>'phone',''),coalesce(NEW.raw_user_meta_data->>'birth_date',''),coalesce(NEW.raw_user_meta_data->>'address',''),coalesce(NEW.raw_user_meta_data->>'job_function',''),coalesce(NEW.raw_user_meta_data->>'sector',''),coalesce(NEW.raw_user_meta_data->>'council_type',''),coalesce(NEW.raw_user_meta_data->>'council_number',''),coalesce(NEW.raw_user_meta_data->>'council_state',''));
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'employee'); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.handle_employee_signup() FROM PUBLIC;