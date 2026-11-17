# Integração Hotelaria HMISC → SISHMISC

## Estado atual
O SISHMISC está preparado para consultar um endpoint autenticado na Hotelaria a cada 5 segundos enquanto o NIR estiver aberto, inclusive em aba de fundo (o navegador pode reduzir essa frequência). Não é uma conexão push nem garantia de atualização instantânea. A Hotelaria ainda não tem esse endpoint: nenhuma leitura de sua base privada foi feita e nenhum leito real foi importado.

O mapa conserva códigos, nomes, ordem de setores e os seis estados fornecidos pela Hotelaria; usa os tokens visuais do SISHMISC. Não é uma cópia exata das cores personalizadas ou das ações do outro aplicativo. Os cartões são de consulta, não alteram a Hotelaria.

Enquanto não configurado, o mapa local e a autorização atual permanecem. Quando configurado, o mapa externo substitui o local no NIR e a autorização integrada permanece bloqueada até a reserva transacional ser implementada nos dois aplicativos. Não usar este estágio como fluxo integrado de internação em produção.

## Alteração necessária no projeto Hotelaria
Abra o chat do projeto Hotelaria HMISC e solicite:

> Criar GET /api/public/integracao/leitos para o SISHMISC. Exigir Authorization Bearer com segredo HOTELARIA_INTEGRATION_TOKEN (comparação em tempo constante); recusar chamada sem segredo configurado ou token inválido antes de consultar os dados. Ler setores/leitos no servidor, ordenar por ordem, retornar somente os campos do contrato abaixo e Cache-Control: no-store. Não retornar pacientes, observações, colaboradores ou histórico. O SISHMISC fará consulta a cada 5 segundos. Criar também uma reserva autenticada transacional e idempotente: somente disponivel pode virar ocupado, verificar atomicamente a disponibilidade e responder conflito se já ocupado; usar identificador UUID externo do leito, e não código, e registrar auditoria da integração. Não liberar higienizacao_concluida automaticamente. Definir contrato de confirmação/cancelamento e recuperação de reserva antes de integrar a autorização do NIR, para não deixar ocupação órfã se o registro clínico falhar.

Esse chat não consegue modificar o outro projeto. Depois de publicar o endpoint, configurar o mesmo segredo em ambos os aplicativos usando o gerenciamento de segredos; nunca colar o segredo no chat ou no código.

## Contrato de leitura
```json
{
  "generatedAt": "2026-11-17T11:23:00Z",
  "setores": [{
    "id": "uuid-do-setor", "nome": "Maternidade", "ordem": 1,
    "leitos": [{
      "id": "uuid-do-leito", "codigo": "306A", "ordem": 1,
      "status": "ocupado", "atualizado_em": "2026-11-17T11:22:00Z",
      "higienizacao_iniciada_em": null
    }]
  }]
}
```
O exemplo é apenas o formato, não dado real. `generatedAt` deve ser a hora UTC da consulta atual. Estados: ocupado, aguardando_higienizacao, higienizacao, higienizacao_concluida, disponivel, bloqueado. Identificadores de setor e leito devem ser únicos. O consumidor rejeita respostas com mais de 15 segundos ou relógio adiantado mais de 5 segundos, e não apresenta dados vencidos como disponibilidade confirmada.

## Configuração no SISHMISC
- `HOTELARIA_INTEGRATION_ORIGIN`: origem HTTPS publicada da Hotelaria (somente origem, sem caminho).
- `HOTELARIA_INTEGRATION_TOKEN`: segredo exclusivo da integração, apenas no servidor.
- Publicar mudanças após configurar; validar no NIR: ocupar um leito real na Hotelaria e conferir a alteração no SISHMISC, depois mudar para higienização e disponível. Repetir com falha de conexão. Só marcar integração concluída após essa verificação.

## Servidor interno
O leitor usa fetch padrão, sem serviços exclusivos da hospedagem Lovable. Ao migrar o SISHMISC, configurar as mesmas duas variáveis no processo servidor (não VITE_), HTTPS, saída de rede para a Hotelaria e relógio sincronizado. A migração completa do aplicativo, autenticação e banco exige instalação própria e não foi realizada neste pedido. Copiar somente os arquivos da tela não migra esses serviços.

Sem internet, a consulta externa falha; o sistema deve mostrar disponibilidade não confirmada, nunca assumir leitos livres. Não expor o banco interno à internet. Quando os dois aplicativos estiverem na rede interna, usar um endereço HTTPS alcançável pelo servidor SISHMISC.

## Pendências para integração completa
- Publicar o endpoint e configurar credenciais na Hotelaria.
- Configurar credenciais no SISHMISC e verificar leitura real.
- Implementar reserva transacional, mapeamento explícito de setores externos para áreas clínicas e confirmação/compensação persistida antes de autorizar internações externas.
- Testar concorrência entre dois operadores, indisponibilidade, alta, transferência e recuperação após falha; o snapshot clínico atual usa last-write-wins e sozinho não garante reserva concorrente.