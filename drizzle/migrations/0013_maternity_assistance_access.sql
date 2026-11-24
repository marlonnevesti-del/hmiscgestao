CREATE OR REPLACE FUNCTION public.set_employee_areas(target_id uuid, areas text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT public.is_approved_employee(auth.uid()) OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
 IF target_id = auth.uid() OR public.has_role(target_id, 'admin') OR public.has_role(target_id, 'super_admin') THEN RAISE EXCEPTION 'Conta administrativa protegida'; END IF;
 IF coalesce(array_length(areas,1),0) > 80 THEN RAISE EXCEPTION 'Áreas demais'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(areas) a WHERE a NOT IN ('recepcao','acolhimento','atendimento','pacientes','enfermagem','centro-cirurgico','cme','farmacia','almoxarifado','faturamento','nir','sciras',
   'uti-uci','fisioterapia','raio-x','gesso','banco-de-leite',
   'ambulatorio:agenda','ambulatorio:recepcao','ambulatorio:acolhimento','ambulatorio:atendimento','ambulatorio:sadt','ambulatorio:especialidades','ambulatorio:relatorios','ambulatorio:coordenacao',
   'pronto-socorro:recepcao','pronto-socorro:acolhimento','pronto-socorro:atendimento','pronto-socorro:internados','pronto-socorro:aguardando','pronto-socorro:observacao','pronto-socorro:assistencia','pronto-socorro:coordenacao',
   'maternidade:recepcao','maternidade:acolhimento','maternidade:atendimento','maternidade:observacao','maternidade:assistencia','maternidade:internados','maternidade:coordenacao',
   'pedido:hospitalar','pedido:medicamento','pedido:escritorio','pedido:alimentacao','pedido:higiene')) THEN RAISE EXCEPTION 'Área inválida'; END IF;
 UPDATE public.profiles SET access_areas = areas WHERE id = target_id AND status IN ('pending','approved','blocked');
 IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não disponível'; END IF;
END; $function$;