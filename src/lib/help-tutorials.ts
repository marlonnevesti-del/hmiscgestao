export interface HelpStep {
  title: string;
  detail: string;
}

export interface HelpFaq {
  q: string;
  a: string;
}

export interface HelpSector {
  id: string;
  title: string;
  group: "Recepção" | "Assistência" | "Apoio" | "Administrativo";
  route?: string;
  summary: string;
  steps: HelpStep[];
  rules: string[];
  faq: HelpFaq[];
}

export const HELP_SECTORS: HelpSector[] = [
  {
    id: "recepcao",
    title: "Recepção (Ambulatório, PS e Maternidade)",
    group: "Recepção",
    route: "/ambulatorio",
    summary: "Cadastro de pacientes, abertura de BAA, agenda ambulatorial, atalhos SADT e emissão de documentos.",
    steps: [
      { title: "1. Buscar paciente pelo CPF", detail: "Digite o CPF no campo de busca. Se houver cadastro único, os dados são preenchidos automaticamente. Em caso de homônimos ou duplicidade, selecione o registro correto na lista." },
      { title: "2. Abrir atendimento (BAA)", detail: "Escolha a porta de entrada (Ambulatório, Pronto Socorro ou Maternidade), informe o motivo (Consulta, Retorno, SISREG, Exame de Mama) e a especialidade. O número da BAA é gerado automaticamente." },
      { title: "3. Atalhos de Orelhinha e Punção de Mama", detail: "Na Recepção do Ambulatório, use os botões rápidos 'Teste da Orelhinha' ou 'Punção de Mama' para preencher automaticamente profissional, sala, procedimento principal e caixas INFO SUS." },
      { title: "4. Retificar abertura antes do atendimento", detail: "Se errar especialidade ou motivo antes do médico iniciar, clique em 'Retificar abertura' na fila da Recepção para corrigir sem cancelar a BAA." },
      { title: "5. Imprimir documentos e chamar na TV", detail: "Use 'Documentos Recepção' para Termos de Internação, Consentimento e Crachás. O Painel de Chamadas (TV) fica no rodapé do menu lateral e abre em nova aba." },
    ],
    rules: [
      "Recém-nascidos (RN) possuem validação automática de idade: após 28 dias o sistema alerta e bloqueia o uso do fluxo neonatal.",
      "Pacientes agendados no Ambulatório só entram no Faturamento TISS/SUS após a confirmação da chegada e realização do atendimento.",
      "Consultas de Obstetrícia no Ambulatório passam primeiro pela pré-consulta de Enfermagem antes de liberar para o médico.",
    ],
    faq: [
      { q: "Como importar a agenda do Ambulatório?", a: "Na aba Agenda do Ambulatório, clique em 'Importar agenda' e envie o arquivo Excel (CSV/XLSX) ou PDF. O sistema vincula automaticamente médicos e especialidades." },
      { q: "Troquei o CPF e os dados antigos continuaram?", a: "Ao alterar o CPF de um paciente já selecionado, o sistema desvincula o cadastro anterior automaticamente para evitar mistura de prontuários." },
    ],
  },
  {
    id: "triagem",
    title: "Acolhimento & Classificação de Risco",
    group: "Assistência",
    route: "/pronto-socorro",
    summary: "Registro de sinais vitais, medidas antropométricas, classificação por cor e encaminhamento ao consultório.",
    steps: [
      { title: "1. Selecionar paciente da fila", detail: "Acesse a aba Acolhimento/Triagem da unidade (PS ou Maternidade) e clique no paciente que acabou de passar pela Recepção." },
      { title: "2. Registrar sinais vitais e antropometria", detail: "Preencha PA, FC, FR, Tax, SatO2, dor, peso, altura e perímetro cefálico. Alertas visuais aparecem automaticamente em valores críticos (ex.: SatO2 < 92%)." },
      { title: "3. Definir classificação de risco", detail: "Selecione a cor (Vermelho, Laranja, Amarelo, Verde ou Azul) conforme a queixa principal e os sinais vitais." },
      { title: "4. Salvar e encaminhar ao médico", detail: "Ao concluir a triagem, o paciente sobe imediatamente para a fila do Atendimento Médico ordenado por prioridade." },
    ],
    rules: [
      "O código SIGTAP de Acolhimento/Classificação de Risco (0301060118) é lançado automaticamente ao concluir a triagem.",
      "O preenchimento de peso, altura ou perímetro cefálico vincula automaticamente o código de antropometria (0101040024) para o BPA.",
    ],
    faq: [
      { q: "Preciso digitar o código SIGTAP da triagem manualmente?", a: "Não. O sistema gera automaticamente os códigos de classificação de risco e antropometria para o faturamento SUS." },
    ],
  },
  {
    id: "pep-medico",
    title: "Atendimento Médico & PEP",
    group: "Assistência",
    route: "/pacientes",
    summary: "Evolução clínica, CID-10, SIGTAP obrigatório, prescrição múltipla de medicamentos, exames e desfechos.",
    steps: [
      { title: "1. Abrir o Prontuário (PEP)", detail: "Chame o paciente pela fila da unidade ou use a barra de busca superior (nome, CPF, prontuário ou nome da mãe)." },
      { title: "2. Registrar evolução, CID e SIGTAP", detail: "Preencha anamnese, exame físico, hipótese diagnóstica (CID-10) e confirme o código SIGTAP (padrão 0301010072 para consulta médica)." },
      { title: "3. Prescrever medicamentos", detail: "Na aba Prescrição, escolha o medicamento, via, posologia (Agora, 2/2h, 4/4h, 6/6h, 8/8h, 12/12h, 24/24h) e clique em Adicionar. É possível incluir vários itens em sequência sem travar a prescrição." },
      { title: "4. Solicitar exames, procedimentos ou internação", detail: "Use as abas de Exames/SADT, Fisioterapia, Raio-X/Gesso ou clique em 'Solicitar Internação' (o pedido vai direto para o NIR regular o leito)." },
      { title: "5. Finalizar atendimento (Desfecho)", detail: "Em Resumo & Evolução → Desfecho, escolha Alta, Observação, Transferência ou Óbito e imprima receitas/atestados ou Nota de Alta." },
    ],
    rules: [
      "O campo SIGTAP é obrigatório para finalizar o atendimento médico e garantir o faturamento sem glosas.",
      "Doses regulares são programadas para dispensação a partir das 16:00; use 'Agora / Dose imediata' quando o medicamento precisar sair na hora.",
      "Para emitir receitas ou laudos depois de finalizar, não é necessário reabrir a consulta — basta abrir o PEP do paciente.",
    ],
    faq: [
      { q: "Por que o quadro 'Adicionar item' apareceu bloqueado?", a: "Verifique a etapa do atendimento: a prescrição fica liberada em Atendimento Médico, Observação, Aguardando Farmácia/Medicação e Internação." },
      { q: "Dei alta por engano, como desfazer?", a: "Apenas o perfil Administrador pode usar 'Desfazer alta' em BAAs e FIAs abertas, mediante justificativa obrigatória." },
    ],
  },
  {
    id: "enfermagem",
    title: "Posto de Enfermagem",
    group: "Assistência",
    route: "/enfermagem",
    summary: "Checagem de medicações aprazadas, evolução de enfermagem, passagem de plantão SBAR e cuidados.",
    steps: [
      { title: "1. Conferir painel de medicações do turno", detail: "Acesse Posto de Enfermagem para ver os horários aprazados de cada paciente internado ou em observação." },
      { title: "2. Checar administração", detail: "Após administrar o medicamento dispensado pela Farmácia, clique em Checar. Quando todas as doses são checadas, o paciente pode retornar automaticamente à revisão médica." },
      { title: "3. Registrar evolução e procedimentos", detail: "No PEP do paciente, registre evoluções de enfermagem, sinais vitais e procedimentos (curativos, sondagens) com os respectivos códigos SIGTAP." },
      { title: "4. Passagem de plantão (SBAR)", detail: "Utilize o resumo SBAR gerado automaticamente a partir dos dados clínicos e alertas ativos do turno." },
    ],
    rules: [
      "Técnicos de Enfermagem possuem acesso ao PEP em modo de visualização e checagem conforme perfil liberado.",
      "Em Procedimentos, use o botão 'Salvar no prontuário' se quiser apenas registrar a evolução sem imprimir a folha.",
    ],
    faq: [
      { q: "Como adicionar vários procedimentos de enfermagem (ex.: PA + temperatura)?", a: "Na tela de Procedimentos, selecione o código SIGTAP, clique em 'Confirmar código' e use o botão '+' para incluir quantos procedimentos precisar." },
    ],
  },
  {
    id: "uti-uci",
    title: "UTI Pediátrica · UCI · UTI Neonatal",
    group: "Assistência",
    route: "/uti-uci",
    summary: "Monitorização intensiva, sinais vitais horários, balanço hídrico neonatal (ml/kg/h), escalas e bundles.",
    steps: [
      { title: "1. Selecionar a unidade intensiva", detail: "Alterne entre UTI Pediátrica, UCI e UTI Neonatal nas abas superiores do módulo." },
      { title: "2. Sinais vitais e Balanço Hídrico separados", detail: "Na UTI Neonatal, registre os Sinais Vitais horários no quadro próprio e o Balanço Hídrico (entradas, saídas e cálculo automático em ml/kg/h) no quadro dedicado." },
      { title: "3. Preencher escalas e bundles", detail: "Registre escalas específicas da unidade e checklists de prevenção de infecção (bundles de CVC, PAV e SVD)." },
      { title: "4. Atalho rápido para prescrição", detail: "Clique em 'Prescrever / Abrir PEP' para ir direto à aba de prescrição do paciente sem alterar o status clínico." },
    ],
    rules: [
      "Os 3 casos de 'Exemplos de internação (TESTE/Treinamento)' servem apenas para capacitação da equipe e nunca ocupam leitos reais nem entram no faturamento.",
    ],
    faq: [
      { q: "O balanço hídrico neonatal calcula ml/kg/h sozinho?", a: "Sim, basta informar o peso do recém-nascido e os volumes de entrada/saída; o sistema calcula o balanço e destaca alertas." },
    ],
  },
  {
    id: "nir",
    title: "NIR & Censo de Internações",
    group: "Apoio",
    route: "/nir",
    summary: "Regulação de leitos integrada à Hotelaria, autorização de internação, abertura de FIA e Censo Hospitalar.",
    steps: [
      { title: "1. Receber solicitação médica", detail: "Quando o médico solicita internação, o paciente aparece na fila de solicitações pendentes do NIR." },
      { title: "2. Selecionar leito disponível", detail: "Verifique os leitos livres no mapa sincronizado com a Hotelaria e clique em 'Autorizar internação'." },
      { title: "3. Fechamento da BAA e abertura da FIA", detail: "Ao autorizar o leito, o sistema reserva o leito na Hotelaria, encerra a BAA e gera automaticamente a FIA oficial com numeração sequencial." },
      { title: "4. Acompanhar Censo e Readmissões", detail: "Em 'Censo · Internações', acompanhe a taxa de ocupação, tempo de permanência, alertas de alergia/isolamento e documentos de internação." },
    ],
    rules: [
      "Apenas o NIR (ou perfil autorizado) aloca leitos. Médicos apenas solicitam a internação.",
      "Se a Hotelaria estiver indisponível ou o leito em higienização/bloqueado, o NIR bloqueia a reserva para evitar dupla ocupação.",
    ],
    faq: [
      { q: "Como cancelar uma internação feita no leito errado?", a: "O Administrador pode usar 'Desfazer internação' em BAAs e FIAs abertas: isso cancela a FIA, reabre a BAA e libera o leito." },
    ],
  },
  {
    id: "farmacia",
    title: "Farmácia Hospitalar",
    group: "Apoio",
    route: "/farmacia",
    summary: "Dispensação por setor, requisição individualizada por horário (SURE090_R), estoque, consumo e inventário.",
    steps: [
      { title: "1. Filtrar a fila por setor", detail: "Use as abas Todos, Imediatas, PS, Maternidade/CO, UTI/UCI, Internação/Enfermarias e Ambulatório para organizar a separação." },
      { title: "2. Dispensar medicamento", detail: "Confira o item prescrito, o lote/validade e clique em Dispensar. Cada horário gera sua própria requisição individualizada (SURE090_R) com quantidade 1 para aquele horário." },
      { title: "3. Conferir bloqueios de antimicrobianos", detail: "Antimicrobianos restritos que aguardam liberação da SCIRAS/CCIH ficam sinalizados e bloqueados até aprovação." },
      { title: "4. Consultar Consumo e Inventário", detail: "Na aba Consumo, filtre por Dia, Mês ou Ano para ver saídas, perdas por validade e sugestão de compra. Na aba Inventário, faça contagens físicas com justificativa." },
    ],
    rules: [
      "A Requisição (SURE090_R) imprime uma folha separada por horário de dose (ex.: 16:00 com quantidade 1), facilitando a conferência no posto.",
      "Apenas colaboradores com permissão de Inventário (ou Administradores) podem aprovar ajustes de saldo no inventário.",
    ],
    faq: [
      { q: "Por que um antibiótico não libera para dispensação?", a: "Antimicrobianos de uso restrito exigem avaliação e liberação prévia na tela da SCIRAS/CCIH." },
    ],
  },
  {
    id: "almoxarifado",
    title: "Almoxarifado Geral",
    group: "Apoio",
    route: "/almoxarifado",
    summary: "Atendimento de pedidos dos setores, estoque por 12 Grupos de Compra, empréstimos e inventário físico.",
    steps: [
      { title: "1. Navegar pelos Grupos de Compra", detail: "No Estoque Geral e no Inventário, use as abas dos 12 Grupos de Compra (Descartáveis, EPI's, Higiene e Limpeza, Material Médico Hospitalar, Nutrição, etc.) para localizar itens rapidamente." },
      { title: "2. Atender solicitações dos setores", detail: "Na aba Pedidos, confira as requisições enviadas pelos setores (cada colaborador solicita apenas categorias autorizadas) e registre a entrega." },
      { title: "3. Realizar Inventário físico", detail: "Na aba Inventário, filtre pelo Grupo de Compra desejado, imprima a ficha de contagem, lance a quantidade física e informe a justificativa para divergências." },
    ],
    rules: [
      "Qualquer colaborador autenticado pode abrir 'Solicitação ao Almoxarifado', mas só enxerga as categorias liberadas para sua função ou concedidas pelo Administrador.",
      "Devoluções de empréstimos aceitam devolução parcial com histórico acumulado de cada retorno.",
    ],
    faq: [
      { q: "Como solicitar um item que não aparece na minha lista de categorias?", a: "Peça ao Administrador para liberar a categoria específica em Colaboradores → Áreas de acesso." },
    ],
  },
  {
    id: "centro-cirurgico-cme",
    title: "Centro Cirúrgico · SRPA · CME",
    group: "Apoio",
    route: "/centro-cirurgico",
    summary: "Mapa cirúrgico, SAEP, escala de Aldrete-Kroulik na SRPA, Centro Obstétrico (Robson) e rastreabilidade CME.",
    steps: [
      { title: "1. Agendar e conduzir cirurgia", detail: "Cadastre a cirurgia no Centro Cirúrgico, informe equipe, sala, kit cirúrgico e registre os tempos operatórios e SAEP." },
      { title: "2. Vincular kits esterilizados (CME)", detail: "Leia ou selecione o código de barras do kit esterilizado para registrar a rastreabilidade direta na cirurgia." },
      { title: "3. Acompanhar SRPA e CO", detail: "Em 'SRPA · CO · Indicadores', preencha a escala de Aldrete-Kroulik na recuperação pós-anestésica e os dados obstétricos (Classificação de Robson)." },
      { title: "4. Operar ciclos na CME", detail: "Na tela da CME, registre ciclos de autoclave, teste biológico (bloqueia uso em caso de falha) e validade dos pacotes." },
    ],
    rules: [
      "Kits de ciclos com indicador biológico positivo ou vencidos ficam bloqueados automaticamente para uso cirúrgico.",
    ],
    faq: [
      { q: "Onde vejo os indicadores de suspensão cirúrgica e partos?", a: "Acesse 'SRPA · CO · Indicadores' para visualizar taxas de suspensão, Robson e relatórios mensais." },
    ],
  },
  {
    id: "apoio-sadt",
    title: "SADT · Fisioterapia · Raio-X · Gesso · BLH · SCIRAS",
    group: "Apoio",
    route: "/fisioterapia",
    summary: "Fluxo de exames, laudos com retificação, sessões de fisioterapia, banco de leite humano e controle de infecção.",
    steps: [
      { title: "1. SADT e Laudos (Ambulatório)", detail: "Na aba SADT · Laudos, solicite exames pré-natal/pré-operatório (imprimindo o Boletim), filtre por data, libere laudos com o médico laudista ou use 'Retificar laudo' com justificativa." },
      { title: "2. Fisioterapia, Raio-X e Gesso", detail: "Acesse o painel do setor, clique no pedido pendente e use 'Registrar sessão / Finalizar'. A conclusão gera automaticamente uma evolução no PEP do paciente." },
      { title: "3. Banco de Leite Humano (BLH)", detail: "Controle frascos de leite cru (validade 15 dias), acidez Dornic, microbiologia, crematócrito (kcal) e relatório AT46." },
      { title: "4. SCIRAS / CCIH", detail: "Avalie prescrições de antimicrobianos restritos, acompanhe isolamentos (MDR) e alertas de readmissão." },
    ],
    rules: [
      "Laudos já liberados só podem ser alterados via 'Retificar laudo', mantendo histórico e aviso de retificação na impressão.",
      "Na Fisioterapia, ao escolher um modelo de evolução, a identificação do paciente é composta automaticamente.",
    ],
    faq: [
      { q: "Preciso copiar a evolução da Fisioterapia ou Raio-X para o prontuário?", a: "Não. Ao finalizar o atendimento no painel do setor, o sistema grava automaticamente a evolução no PEP." },
    ],
  },
  {
    id: "faturamento",
    title: "Faturamento SUS, TISS e Custos",
    group: "Administrativo",
    route: "/faturamento-sus",
    summary: "Remessas BPA Magnético, SISAIH01 (TXT/ZIP), CIHA-01, validação SIGTAP anti-glosa, TISS e Centro de Custos.",
    steps: [
      { title: "1. Conferir Dados do Hospital", detail: "Em Faturamento SUS → Dados do Hospital, verifique CNES (2594277), CNPJ, Razão Social, Órgão Emissor AIH (E420000012) e Diretor Clínico." },
      { title: "2. Resolver pendências (Semáforo pré-faturamento)", detail: "Verifique alertas de CID × SIGTAP, idade, sexo, permanência ou falta de número de documento. A equipe de faturamento pode retificar números ausentes com justificativa." },
      { title: "3. Exportar arquivos mensais", detail: "Selecione a competência (AAAAMM) e baixe o BPA Magnético (PA2594277.xx), SISAIH01 (.txt ou .Zip) ou CIHA-01 (.CHA)." },
      { title: "4. Acompanhar TISS, Custos e Prestação de Contas", detail: "Use os módulos 'Faturamento TISS', 'Centro de custos' e 'Prestação de contas OS' para relatórios financeiros por setor." },
    ],
    rules: [
      "No SISAIH01, sempre confirme se a competência aberta no programa do DATASUS é a mesma do arquivo exportado.",
      "Todas as remessas usam o mesmo CNES institucional centralizado para evitar divergências entre BPA, AIH, CIHA e TISS.",
    ],
    faq: [
      { q: "Por que o BPA baixa com extensão .11 ou .12 e o CIHA com .CHA?", a: "É o padrão oficial exigido pelos programas do DATASUS: o BPA usa o número do mês na extensão (ex.: PA2594277.11) e o CIHA-01 usa .CHA." },
    ],
  },
  {
    id: "administracao",
    title: "Administração, Colaboradores e Backups",
    group: "Administrativo",
    route: "/colaboradores",
    summary: "Aprovação de colaboradores, cadastro manual offline, setores/áreas de acesso, BAAs/FIAs abertas e Máquina do Tempo.",
    steps: [
      { title: "1. Aprovar ou cadastrar colaboradores", detail: "Em Colaboradores, libere novos cadastros pendentes ou clique em 'Cadastrar colaborador' para criar acesso manual com gerador de senha." },
      { title: "2. Definir Setor e Áreas de Acesso", detail: "Vincule o colaborador ao setor correspondente (que já libera as áreas padrão do setor) ou personalize caixas específicas como Inventário e categorias do Almoxarifado." },
      { title: "3. Corrigir BAAs e FIAs abertas", detail: "Em 'BAAs e FIAs abertas', corrija dados de abertura, desfaça altas ou reverta internações mediante justificativa registrada em auditoria." },
      { title: "4. Segurança & Backups", detail: "Em 'Segurança & Backups', consulte o histórico automático de snapshots, restaure pontos anteriores ou exporte cópias de segurança." },
    ],
    rules: [
      "O sistema sincroniza automaticamente em tempo real entre todos os computadores. Abas ociosas por mais de 30 minutos recarregam os dados para evitar informações desatualizadas.",
      "A remoção de um colaborador revoga o acesso mantendo todo o histórico de evoluções e assinaturas intacto.",
    ],
    faq: [
      { q: "Um computador ficou com dados antigos na tela, o que fazer?", a: "Confira o indicador de sincronização no topo direito. Basta recarregar a página (F5) ou clicar no indicador para puxar a versão mais recente do servidor." },
    ],
  },
];