CREATE TABLE IF NOT EXISTS public.clinical_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id text NOT NULL DEFAULT 'main',
  version bigint NOT NULL,
  data jsonb NOT NULL,
  saved_by uuid,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  patient_count integer NOT NULL DEFAULT 0,
  encounter_count integer NOT NULL DEFAULT 0,
  appointment_count integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'auto'
);

CREATE INDEX IF NOT EXISTS clinical_state_history_state_saved_idx
  ON public.clinical_state_history (state_id, saved_at DESC);

GRANT SELECT ON public.clinical_state_history TO authenticated;
GRANT ALL ON public.clinical_state_history TO service_role;

ALTER TABLE public.clinical_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_admin_read"
  ON public.clinical_state_history
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.archive_clinical_state_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patients integer;
  v_encounters integer;
  v_appointments integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.version IS NOT DISTINCT FROM OLD.version THEN
    RETURN NEW;
  END IF;

  v_patients := CASE WHEN jsonb_typeof(NEW.data -> 'patients') = 'array' THEN jsonb_array_length(NEW.data -> 'patients') ELSE 0 END;
  v_encounters := CASE WHEN jsonb_typeof(NEW.data -> 'encounters') = 'array' THEN jsonb_array_length(NEW.data -> 'encounters') ELSE 0 END;
  v_appointments := CASE WHEN jsonb_typeof(NEW.data -> 'appointments') = 'array' THEN jsonb_array_length(NEW.data -> 'appointments') ELSE 0 END;

  INSERT INTO public.clinical_state_history (
    state_id, version, data, saved_by, saved_at,
    patient_count, encounter_count, appointment_count, reason
  ) VALUES (
    NEW.id, NEW.version, NEW.data, NEW.updated_by, COALESCE(NEW.updated_at, now()),
    v_patients, v_encounters, v_appointments, 'auto'
  );

  DELETE FROM public.clinical_state_history
  WHERE id IN (
    SELECT id FROM public.clinical_state_history
    WHERE state_id = NEW.id
    ORDER BY saved_at DESC, version DESC
    OFFSET 100
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_clinical_state_version ON public.clinical_state;
CREATE TRIGGER trg_archive_clinical_state_version
  AFTER INSERT OR UPDATE ON public.clinical_state
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_clinical_state_version();

CREATE OR REPLACE FUNCTION public.restore_clinical_state_snapshot(_history_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap public.clinical_state_history%ROWTYPE;
  v_new_version bigint;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar pontos de segurança';
  END IF;

  SELECT * INTO v_snap
  FROM public.clinical_state_history
  WHERE id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ponto de restauração não encontrado';
  END IF;

  UPDATE public.clinical_state
  SET
    data = v_snap.data,
    version = version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = v_snap.state_id
  RETURNING version INTO v_new_version;

  RETURN v_new_version;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_clinical_state_snapshot(uuid) TO authenticated;

INSERT INTO public.clinical_state_history (
  state_id, version, data, saved_by, saved_at,
  patient_count, encounter_count, appointment_count, reason
)
SELECT
  id,
  version,
  data,
  updated_by,
  COALESCE(updated_at, now()),
  CASE WHEN jsonb_typeof(data -> 'patients') = 'array' THEN jsonb_array_length(data -> 'patients') ELSE 0 END,
  CASE WHEN jsonb_typeof(data -> 'encounters') = 'array' THEN jsonb_array_length(data -> 'encounters') ELSE 0 END,
  CASE WHEN jsonb_typeof(data -> 'appointments') = 'array' THEN jsonb_array_length(data -> 'appointments') ELSE 0 END,
  'inicial'
FROM public.clinical_state;