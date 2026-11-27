# Hmiscgestao

Crie um Sistema de Gestão Hospitalar e Prontuário Eletrônico do Paciente (PEP) focado em um Hospital Materno-Infantil, com interface moderna, limpa, densa em informações e de alta produtividade, inspirada em sistemas hospitalares robustos como o Salux.

IDENTIDADE VISUAL E LAYOUT:
- Estilo: Clean clinical UI, fundo cinza muito claro (#F4F6F9), cards brancos (#FFFFFF) com bordas sutis (#E2E8F0), cor primária azul hospitalar (#0F4C81) e destaques em verde-água/teal (#0D9488) para ações clínicas e rosa suave (#E11D48) apenas para alertas obstétricos/maternos.
- Navegação: Sidebar esquerda recolhível com ícones e textos claros, e um cabeçalho superior fixo (Topbar) com busca global rápida de pacientes (por nome, CPF, prontuário ou nome da mãe), seletor de unidade/ala (Pronto-Socorro Obstétrico, Pronto-Socorro Pediátrico, Centro Obstétrico, UTI Neonatal, Enfermaria) e alertas críticos.

ESTRUTURA DE TELAS E MÓDULOS PRINCIPAIS:

1. DASHBOARD OPERACIONAL (Visão Geral da Unidade):
- KPIs superiores: Taxa de Ocupação Geral, Leitos Livres (Obstetrícia vs. Pediatria/Neo), Pacientes em Triagem, Partos Realizados Hoje, Alta Prevista.
- Mapa de Leitos visual (Kanban/Grid por ala) mostrando status por cor: Livre (Verde), Ocupado (Azul), Higienização (Amarelo), Isolamento (Roxo), Alta Prev. (Ciano). Clicar no leito abre um drawer lateral com resumo do paciente.

2. RECEPÇÃO E CLASSIFICAÇÃO DE RISCO (Acolhimento):
- Fila de espera em tempo real dividida por: Gestantes/Puérperas e Pediatria.
- Protocolo de Manchester adaptado (Vermelho, Laranja, Amarelo, Verde, Azul) com tempo de espera em cronômetro.
- Formulário rápido de triagem: Sinais vitais (PA, FC, FR, Tax, SatO2, Dor) + Campos específicos:
  * Se Gestante: Idade Gestacional (IG em semanas/dias), DUM, Batimentos Cardiofetais (BCF), Dinâmica Uterina, Queixa obstétrica.
  * Se Pediatria: Peso atual (kg), Estatura, Perímetro Cefálico, Nome do responsável legal.

3. PRONTUÁRIO ELETRÔNICO DO PACIENTE (PEP - Tela Principal do Médico/Enfermeiro):
- Cabeçalho fixo do paciente (Banner Clínico): Foto/Avatar, Nome Completo, Idade/IG, Peso, Alergias em destaque vermelho pulsante, Pulseira de Risco (Queda, Alergia, Flebite), Leito e Convênio.
- Navegação por abas internas estilo prontuário tradicional:
  * Resumo Clínico & Evolução (Linha do tempo cronológica com filtro por profissional: Médico, Enfermagem, Fisioterapia).
  * Prescrição Médica (Dieta, Hidratação/Soro, Medicamentos com cálculo automático de dose por peso/kg para pediatria, Cuidados de Enfermagem, Exames).
  * Sinais Vitais & Balanço Hídrico (Tabela de horários + gráficos de curva térmica/pressórica).
  * Obstetrícia / Partograma (Aba exclusiva para gestantes com registro de dilatação cervical, altura da apresentação, BCF e contrações).
  * Recém-Nascido / Sala de Parto (Boletim de Apgar 1º e 5º min, peso ao nascer, tipagem sanguínea, vacinas iniciais e vínculo direto com o prontuário da mãe).

DADOS DE DEMONSTRAÇÃO (MOCK DATA):
- Popule o sistema com 8 pacientes realistas de um hospital materno-infantil (ex: gestante em trabalho de parto ativo de 39 semanas, puérpera pós-cesárea, lactente de 8 meses com bronquiolite, recém-nascido na UTI Neo) para que todas as telas já funcionem de forma interativa.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hmiscgestao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/99c05fd0-634e-424c-a006-6c577d58a502).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
