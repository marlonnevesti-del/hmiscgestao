CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'employee');
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL DEFAULT '', username text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', cpf text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', birth_date text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', job_function text NOT NULL DEFAULT '', council_type text NOT NULL DEFAULT '', council_number text NOT NULL DEFAULT '', council_state text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','blocked')), approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.user_id=_user_id AND r.role=_role AND p.status='approved') $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE FUNCTION public.handle_employee_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.profiles(id,full_name,username,email,cpf,phone,birth_date,address,job_function,council_type,council_number,council_state) VALUES (NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),coalesce(NEW.raw_user_meta_data->>'username',''),coalesce(NEW.email,''),coalesce(NEW.raw_user_meta_data->>'cpf',''),coalesce(NEW.raw_user_meta_data->>'phone',''),coalesce(NEW.raw_user_meta_data->>'birth_date',''),coalesce(NEW.raw_user_meta_data->>'address',''),coalesce(NEW.raw_user_meta_data->>'job_function',''),coalesce(NEW.raw_user_meta_data->>'council_type',''),coalesce(NEW.raw_user_meta_data->>'council_number',''),coalesce(NEW.raw_user_meta_data->>'council_state',''));
 INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'employee'); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.handle_employee_signup() FROM PUBLIC;
CREATE TRIGGER employee_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_employee_signup();