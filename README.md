# LabStocker — README

<aside>
🧪

**LabStocker** — sistema web para gestão de reagentes químicos, estoque, resíduos e transferências entre laboratórios. Projeto acadêmico (bolsa) construído com HTML, CSS e JavaScript vanilla no front-end e **Supabase** (PostgreSQL + Auth) no back-end.

</aside>

## ✨ Funcionalidades

- **Autenticação** de usuários com perfis vinculados a um laboratório
- **Gestão de estoque** de reagentes por laboratório
- **Catálogo global de reagentes** (com composição química)
- **Controle de resíduos** com classificação de perigo
- **Transferências** de itens entre laboratórios (solicitar/responder)
- **Relatórios e histórico** de movimentações
- **Painel de administração**: usuários, permissões, laboratórios e catálogo
- **feedback / suporte** ao usuário

## 🛠️ Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Front-end | HTML, CSS, JavaScript (vanilla, ES modules) |
| Back-end / BaaS | Supabase (PostgreSQL, Auth, RLS) |
| Cliente do banco | @supabase/supabase-js |

## 📁 Estrutura de pastas

O projeto usa uma arquitetura **co-localizada**: cada página tem seu HTML e seu JS juntos na mesma pasta dentro de `src/pages/`, enquanto o código reutilizado por várias páginas fica centralizado em `src/shared/`.

```
labstocker/
├─ docs/                    # Documentação do projeto
└─ src/
   ├─ .env                  # Variáveis de ambiente locais
   ├─ .gitignore            # Arquivos ignorados pelo Git
   ├─ index.html            # Página inicial / login
   ├─ auth.js               # Autenticação da página de login
   ├─ css/                  # Estilos
   ├─ imagens/              # Assets (inclui favicon/)
   ├─ modelos/              # Modelos/templates (ex.: ofício .docx)
   ├─ database/             # Scripts/artefatos do banco
   ├─ shared/               # Código compartilhado entre as páginas
   │  ├─ config.js          # URL e chave (anon) do Supabase
   │  ├─ supabaseClient.js  # Cliente Supabase compartilhado
   │  ├─ sessionManager.js  # Sessão, contexto de laboratório/admin
   │  ├─ authGuard.js       # Proteção de rotas (exige login)
   │  ├─ services/          # Acesso ao banco (estoque, perfis, reagentes...)
   │  └─ utils/             # Utilitários (toast, formatters)
   └─ pages/                # Cada página com HTML + JS co-localizados
      ├─ dashboard/         #   dashboard.html + dashboard.js
      ├─ estoque/           #   estoque.html + estoque.js
      ├─ reagentes/         #   reagentes.html + reagentes.js
      ├─ residuos/          #   residuos.html + residuos.js
      ├─ laboratorios/      #   laboratorios.html + laboratorios.js
      ├─ solicitacoes/      #   solicitacoes.html + solicitacoes.js
      ├─ historico/         #   historico.html + historico.js
      ├─ relatorios/        #   relatorios.html + relatorios.js
      ├─ suporte/           #   suporte.html + suporte.js
      ├─ usuarios/          #   usuarios.html + usuarios.js
      ├─ autorizacoes/      #   autorizacoes.html + autorizacoes.js
      ├─ register/          #   register.html + register.js
      └─ admin/             # Páginas de administração
         ├─ admin-labs.html + admin-labs.js
         ├─ admin-autorizacoes.html          (script inline)
         ├─ admin-detalhes-projeto.html + adminDetalhes.js
         └─ lab-cadastro.js
```

## ✅ Pré-requisitos

- Conta no Supabase (plano gratuito serve)
- Node.js 18+ (recomendado, para servir o projeto com Vite, porém opcional)
- Um navegador moderno

## 🚀 Como rodar

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd labstocker
```

### 2. Configurar o Supabase

1. Crie um projeto novo no painel do Supabase.
2. No **SQL Editor**, rode o script de criação das tabelas e políticas de RLS (veja o documento de schema do projeto).
3. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.


### 3. Rodar localmente

**Opção A — com Vite (recomendado):**

```bash
npm install
npm run dev
```

Acesse o endereço exibido no terminal (ex.: `http://localhost:5173`).

**Opção B — servidor estático simples:**

Como é HTML/CSS/JS puro, basta servir os arquivos com qualquer servidor estático (abrir o `index.html` direto pode quebrar os ES modules por causa do CORS):

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Ou use a extensão "Live Server" do VSCode.

## 👤 Criando o primeiro usuário admin

1. Cadastre-se normalmente pela tela de registro do app.
2. No Supabase, na tabela `perfil`, marque `is_admin = true` no seu usuário.
3. Vincule um `id_laboratorio` ao perfil, se necessário.

## 🧩 Arquitetura (resumo)

- As **páginas** ficam em `src/pages/<nome>/`, cada uma com seu próprio `HTML` + `JS` co-localizados (ex.: `pages/relatorios/relatorios.html` e `pages/relatorios/relatorios.js`).
- O **código compartilhado** vive em `src/shared/`: `config.js`, `supabaseClient.js`, `sessionManager.js`, `authGuard.js`, além das pastas `services/` e `utils/`.
- Toda comunicação com o banco passa pela camada de **services** (`src/shared/services`), que usa o `supabaseClient`.
- `authGuard.js` e `sessionManager.js` (em `src/shared`) controlam acesso e sessão.
- A tela de **login** (`src/index.html` + `src/auth.js`) fica na raiz de `src/`.
- A segurança dos dados é garantida por **RLS** no Supabase (cada usuário só acessa o que pode).

## 📄 Licença

Projeto acadêmico — a definir.
