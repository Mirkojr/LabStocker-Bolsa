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

```
labstocker/
├─ docs/                # Documentação do projeto
└─ src/
   ├─ .env              # Variáveis de ambiente locais
   ├─ .gitignore        # Arquivos ignorados pelo Git
   ├─ auth.js           # Autenticação na página de login
   ├─ index.html        # Página inicial / login
   ├─ css/              # Estilos
   ├─ imagens/          # Assets
   │  └─ favicon/
   ├─ js/
   │  ├─ config/        # Configurações
   │  ├─ core/          # Núcleo da aplicação
   │  ├─ services/      # Acesso ao banco (estoque, perfis, reagentes...)
   │  ├─ utils/         # Utilitários
   │  └─ *.js           # Arquivos js para páginas específicas
   ├─ modelos/          # Modelos/templates
   └─ pages/            # Páginas HTML (dashboard, estoque, reagentes, etc.)
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

- As **páginas** (`/pages/*.html`) cuidam da interface; cada uma tem um JS correspondente em `/js`.
- Toda comunicação com o banco passa pela camada de **services** (`/js/services`), que usa o `supabaseClient`.
- `authGuard.js` e `sessionManager.js` controlam acesso e sessão.
- A segurança dos dados é garantida por **RLS** no Supabase (cada usuário só acessa o que pode).

## 📄 Licença

Projeto acadêmico — a definir.