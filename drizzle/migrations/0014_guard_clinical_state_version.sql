CREATE OR REPLACE FUNCTION public.guard_clinical_state_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.version <= OLD.version THEN
    RAISE EXCEPTION 'Versão desatualizada (tentativa: %, atual: %). Atualize a página antes de salvar.', NEW.version, OLD.version;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_clinical_state_version ON public.clinical_state;

CREATE TRIGGER trg_guard_clinical_state_version
  BEFORE UPDATE ON public.clinical_state
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_clinical_state_version();