# LabStocker

> **LabStocker** — sistema web para gestão de reagentes químicos, estoque, resíduos e
> transferências entre laboratórios. Projeto da Bolsa de Inovação Tecnológica da UFC.
>
> Front-end em HTML, CSS e JavaScript vanilla (ES modules), empacotado com **Vite**.
> Back-end em **Supabase** (PostgreSQL + Auth + RLS + Storage).

## ✨ Funcionalidades

- **Autenticação** de usuários com perfis vinculados a um laboratório
- **Gestão de estoque** de reagentes por laboratório
- **Catálogo global de reagentes** (com composição química)
- **Controle de resíduos** com classificação de perigo
- **Transferências** de itens entre laboratórios (solicitar / aprovar / recusar)
- **Relatórios e histórico** de movimentações, com exportação em CSV
- **Painel de administração**: usuários, permissões, laboratórios e catálogo
- **Autorizações de projeto**: geração de minuta de ofício em `.docx` e upload do PDF assinado
- **Feedback / suporte** ao usuário

## 🛠️ Tecnologias

| Camada              | Tecnologia                                  |
| ------------------- | ------------------------------------------- |
| Front-end           | HTML, CSS, JavaScript (vanilla, ES modules) |
| UI                  | Bootstrap 5 + Bootstrap Icons               |
| Build / Dev server  | Vite                                        |
| Qualidade de código | ESLint + Prettier                           |
| Back-end / BaaS     | Supabase (PostgreSQL, Auth, RLS, Storage)   |
| Cliente do banco    | `@supabase/supabase-js`                     |
| Documentos          | docxtemplater + PizZip + FileSaver          |
| Deploy              | GitHub Pages                                |

## 📁 Estrutura de pastas

O projeto usa uma arquitetura **co-localizada**: cada página tem seu HTML e seu JS juntos
na mesma pasta dentro de `src/pages/`, enquanto o código reutilizado por várias páginas
fica centralizado em `src/shared/`.

## ✅ Pré-requisitos

- **Node.js 20.19+** (obrigatório — o Vite 8 não roda em versões anteriores)
- Conta no Supabase (o plano gratuito serve)
- Um navegador moderno

Verifique sua versão com `node -v`.

## 🚀 Como rodar

### 1. Clonar e instalar

```bash
git clone <url-do-repositorio>
cd labstocker
npm install
```

### 2. Configurar o Supabase

1. Crie um projeto novo no painel do Supabase.
2. No **SQL Editor**, rode os scripts de `src/database/` nesta ordem:

   | Ordem | Arquivo                            | O que faz                                  |
   | ----- | ---------------------------------- | ------------------------------------------ |
   | 1     | `schema.sql`                       | Cria as tabelas                            |
   | 2     | `funcoes_auxiliares.sql`           | Funções `get_my_lab_id()` e `am_i_admin()` |
   | 3     | `criar_perfil_trigger.sql`         | Cria o perfil automaticamente no cadastro  |
   | 4     | `policies.sql`                     | Políticas de RLS                           |
   | 5     | `storage_policies.sql`             | Políticas do bucket de documentos          |
   | 6     | `funcao_aprovar_transferencia.sql` | RPC transacional de aprovação              |

3. Crie o bucket **privado** `documentos-projetos` em **Storage**.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

### 3. Criar o arquivo de variáveis de ambiente

Copie o modelo e preencha com as credenciais do passo anterior:

```bash
cp src/.env.example src/.env
```

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

> ⚠️ **O arquivo precisa estar em `src/`, não na raiz** — é onde fica o `root` do Vite.
>
> - O `.env` é ignorado pelo Git e **nunca** deve ser commitado.
> - Se criar o arquivo pelo Bloco de Notas do Windows, confirme que ele não virou
>   `.env.txt` e que o encoding é UTF-8 ou ASCII (não UTF-16).
> - Toda variável precisa começar com `VITE_`, senão o Vite não a expõe ao front-end.
> - Depois de alterar o `.env`, **reinicie o servidor de desenvolvimento**.

### 4. Rodar

```bash
npm run dev
```

Acesse o endereço exibido no terminal.

> ℹ️ **Não abra o `index.html` direto no navegador** e não use extensões como o
> "Live Server" ou servidores estáticos simples (`npx serve`, `python3 -m http.server`).
> O projeto depende do Vite para resolver as importações de pacotes npm e para
> substituir as variáveis de ambiente. Sem ele, a aplicação não carrega.

## 📜 Scripts disponíveis

| Comando                | O que faz                                                     |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento com hot reload                    |
| `npm run build`        | Gera o build de produção em `dist/`                           |
| `npm run preview`      | Serve o `dist/` localmente — **teste aqui antes de abrir PR** |
| `npm run lint`         | Verifica erros de código com ESLint                           |
| `npm run lint:fix`     | Corrige automaticamente o que for possível                    |
| `npm run format`       | Formata o código com Prettier                                 |
| `npm run format:check` | Só verifica a formatação                                      |

## 🧹 Qualidade de código

O projeto usa **ESLint** (encontra erros de lógica e código morto) e **Prettier**
(padroniza a formatação). No dia a dia você não precisa rodar nada na mão: instale as
extensões recomendadas do VS Code e o editor cuida disso ao salvar.

- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`

## 👤 Criando o primeiro usuário admin

1. Cadastre-se normalmente pela tela de registro do app.
2. No Supabase, na tabela **`perfis`**, marque `is_admin = true` no seu usuário.
3. Vincule um `id_laboratorio` ao perfil, se necessário.

## 🚢 Deploy

O deploy é automático: todo push na branch `main` dispara o workflow
`.github/workflows/static.yml`, que instala as dependências, roda `npm run build` e
publica a pasta `dist/` no GitHub Pages.

Para que o build do CI funcione, os secrets abaixo precisam estar cadastrados em
**Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> A `anon key` é pública por design — ela vai embutida no JavaScript do navegador.
> A segurança dos dados depende inteiramente das políticas de **RLS** no Supabase.

## 🧩 Arquitetura (resumo)

- As **páginas** ficam em `src/pages/<nome>/`, cada uma com seu próprio HTML + JS
  co-localizados (ex.: `pages/relatorios/relatorios.html` e `relatorios.js`).
- O **código compartilhado** vive em `src/shared/`: `config.js`, `supabaseClient.js`,
  `sessionManager.js`, `authGuard.js`, além das pastas `services/` e `utils/`.
- Toda comunicação com o banco passa pela camada de **services**
  (`src/shared/services/`), que usa o `supabaseClient`. Nenhuma página chama o Supabase
  diretamente.
- `authGuard.js` e `sessionManager.js` controlam acesso e sessão, incluindo o contexto de
  laboratório assumido por um administrador.
- A tela de **login** (`src/index.html` + `src/auth.js`) fica na raiz de `src/`.
- A **paginação** é centralizada em `src/shared/utils/paginacao.js`, com suporte a
  paginação no servidor (`calcularRange` + `.range()` do Supabase) e no cliente
  (`paginarLista`).
- A segurança dos dados é garantida por **RLS** no Supabase: cada usuário só acessa o que
  a política permite.

## 🤝 Contribuindo

Veja o [CONTRIBUTING.md](CONTRIBUTING.md) para o padrão de branches, commits e Pull
Requests.

Resumo rápido:

1. Crie uma branch a partir da `main`: `feat/nome-da-feature` ou `fix/nome-do-bug`.
2. Faça commits no padrão [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`).
3. Rode `npm run lint` e `npm run build` antes de abrir o PR.
4. Abra o Pull Request descrevendo **o que muda**, **por quê** e **como testar**.

## 📄 Licença

Projeto acadêmico — a definir.
