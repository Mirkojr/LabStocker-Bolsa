# LabStocker

> Sistema web para gestão de laboratórios acadêmicos, com foco em controle de inventário químico, rastreabilidade de consumo e gerenciamento de descarte de resíduos.

## Visão Geral

O **LabStocker** é uma plataforma para apoiar a operação de laboratórios (universitários ou institucionais) onde há necessidade de:

- organizar o **estoque de reagentes** por laboratório;
- registrar **consumo e movimentação** de itens;
- controlar o ciclo de **resíduos químicos** (geração e histórico);
- administrar **transferências entre laboratórios** com regras de aprovação;
- aplicar **permissões por papel** (admin, chefe, gestor e membro) com segurança no banco.

### Problema que o projeto resolve

Em muitos laboratórios, o controle de materiais e resíduos ainda é feito em planilhas isoladas ou processos manuais, o que gera:

- baixa rastreabilidade de entradas/saídas;
- inconsistência de inventário;
- dificuldade de auditoria e conformidade;
- risco operacional em descarte e manipulação de substâncias.

O LabStocker centraliza esse fluxo com autenticação, políticas de acesso e persistência em banco relacional, reduzindo erros e melhorando governança.

## Arquitetura e Stack

### Stack principal

| Camada | Tecnologia |
| --- | --- |
| Front-end | HTML, CSS e JavaScript Vanilla (ES Modules) |
| Build e Dev Server | Vite |
| Backend/BaaS | Supabase (PostgreSQL, Auth, RLS, Storage) |
| Cliente de API | `@supabase/supabase-js` |
| Qualidade de código | ESLint + Prettier |
| Banco local e testes | Supabase CLI + pgTAP |
| CI/CD | GitHub Actions + GitHub Pages |

### Organização de código

Estrutura relevante em `src/`:

```text
src/
├─ pages/                 # páginas da aplicação (HTML + JS por feature)
├─ shared/
│  ├─ services/           # acesso a dados/regras de integração com Supabase
│  └─ utils/              # utilitários reutilizáveis
├─ auth.js                # fluxo de autenticação de entrada
└─ index.html             # tela inicial/login
```

Diretrizes arquiteturais do projeto:

- páginas ficam em `pages/` e compõem a interface por domínio funcional;
- integrações e chamadas ao Supabase passam por `shared/services/`;
- utilitários transversais ficam em `shared/utils/`;
- regras de permissão no banco são aplicadas por RLS (não apenas no front-end).

## Pré-requisitos e Instalação

### Pré-requisitos

- **Node.js 20+**
- **npm**
- **Docker** (necessário para rotinas locais do Supabase e testes de banco)

### Instalação local (passo a passo)

1. **Clonar o repositório**

```bash
git clone https://github.com/Mirkojr/LabStocker-Bolsa.git
cd LabStocker-Bolsa
```

2. **Instalar dependências**

```bash
npm install
```

3. **Configurar variáveis de ambiente** (seção abaixo)

4. **Executar em modo desenvolvimento**

```bash
npm run dev
```

5. Abrir a URL exibida no terminal (normalmente `http://localhost:5173`).

## Configuração de Ambiente

Para o frontend conectar ao Supabase, crie o arquivo `src/.env` (o exemplo base está em `src/.env.example`).

### Variáveis obrigatórias

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```

### Observações importantes

- o arquivo deve ficar em **`src/.env`**;
- variáveis expostas ao frontend precisam do prefixo **`VITE_`**;
- nunca commite o `.env`;
- após alterar variáveis, reinicie o `npm run dev`.

## Workflows de CI/CD

O projeto usa GitHub Actions com dois fluxos principais:

### 1) Deploy no GitHub Pages

Workflow: **`.github/workflows/static.yml`**

- gatilhos: `push` na branch `main` e `workflow_dispatch`;
- passos:
  1. checkout do código;
  2. setup de Node 20 com cache npm;
  3. `npm ci`;
  4. `npm run build` com secrets de ambiente;
  5. upload do `dist/` como artifact;
  6. deploy no GitHub Pages.

Secrets necessários no repositório (Actions secrets):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2) Testes de banco (pgTAP)

Workflow: **`.github/workflows/testes-banco.yml`**

- gatilhos: `pull_request`, `push` na `main` e `workflow_dispatch`;
- passos:
  1. checkout;
  2. setup de Node 20;
  3. `npm ci`;
  4. inicialização do Supabase local via CLI;
  5. execução de `npx supabase test db` (pgTAP);
  6. desligamento do ambiente Supabase ao final.

Esse fluxo valida migrations, políticas de segurança e regras de banco antes da integração das mudanças.

## Scripts úteis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | inicia servidor de desenvolvimento (Vite) |
| `npm run build` | gera build de produção em `dist/` |
| `npm run preview` | serve o build local para validação |
| `npm run lint` | roda lint no código-fonte |
| `npm run lint:fix` | corrige automaticamente problemas de lint possíveis |
| `npm run db:start` | sobe ambiente local do Supabase |
| `npm run db:reset` | recria banco local aplicando migrations |
| `npm run test:db` | executa testes pgTAP |
| `npm run db:stop` | encerra ambiente local do Supabase |

## Referências internas

- Guia de banco/migrations/testes: `supabase/README.md`
- Processo de contribuição: `CONTRIBUTING.md`

## Licença

Projeto acadêmico. Definição de licença pendente.
