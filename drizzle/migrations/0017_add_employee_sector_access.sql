ALTER TABLE public.employee_sectors ADD COLUMN access_areas text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.employee_sectors ADD CONSTRAINT employee_sectors_access_areas_valid CHECK (
  cardinality(access_areas) <= 80 AND access_areas <@ ARRAY[
    'recepcao','acolhimento','atendimento','pacientes','enfermagem','centro-cirurgico','cme','farmacia','almoxarifado','faturamento','nir','sciras',
    'uti-uci','fisioterapia','raio-x','gesso','banco-de-leite',
    'ambulatorio:agenda','ambulatorio:recepcao','ambulatorio:acolhimento','ambulatorio:atendimento','ambulatorio:sadt','ambulatorio:especialidades','ambulatorio:relatorios','ambulatorio:coordenacao',
    'pronto-socorro:recepcao','pronto-socorro:acolhimento','pronto-socorro:atendimento','pronto-socorro:internados','pronto-socorro:aguardando','pronto-socorro:observacao','pronto-socorro:assistencia','pronto-socorro:coordenacao',
    'maternidade:recepcao','maternidade:acolhimento','maternidade:atendimento','maternidade:observacao','maternidade:assistencia','maternidade:internados','maternidade:coordenacao',
    'pedido:hospitalar','pedido:medicamento','pedido:escritorio','pedido:alimentacao','pedido:higiene'
  ]::text[]
);