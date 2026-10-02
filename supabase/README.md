# Banco de dados — LabStocker

Todo o banco (tabelas, funções, políticas de RLS, bucket de Storage) está versionado em
`supabase/migrations/` e é aplicado pelo **Supabase CLI**. Os testes ficam em
`supabase/tests/` e usam **pgTAP**.

> Não altere o banco pelo SQL Editor do painel. Toda mudança vira uma migration nova
> neste diretório, para qualquer pessoa (inclusive a STI) conseguir reproduzir o banco.

## 🔐 Modelo de permissões

| Papel           | Onde           | O que pode                                                                                            |
| --------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| **Admin**       | Sistema todo   | Cadastra laboratórios, define e troca chefes, gerencia admins, lê tudo. Não opera estoque.            |
| **Chefe**       | Um laboratório | Tudo no laboratório. Concede e revoga gestor e membro. Transfere a chefia. Edita o catálogo.          |
| **Gestor**      | Um laboratório | Edita estoque, aprova e recusa transferências, concede e revoga **membros**.                          |
| **Membro**      | Um laboratório | Registra consumo e resíduo, vê o histórico, pede transferência (aprovada por gestor/chefe da origem). |
| Qualquer logado | —              | Lê o estoque de todos os laboratórios.                                                                |

- **Vínculos** (`vinculo_laboratorio`): um por usuário e laboratório; uma pessoa pode ter
  papéis diferentes em laboratórios diferentes. Validade opcional (`expira_em`); vínculo
  vencido ou revogado não dá acesso. A chefia não expira.
- **Histórico**: nada é apagado. Conceder cria uma linha com `concedido_por`/`concedido_em`;
  revogar preenche `revogado_por`/`revogado_em`/`motivo_revogacao`. Trocar de papel revoga o
  vínculo antigo e cria outro. O mesmo vale para `administrador`.
- **Delegação**: ninguém concede papel igual ou acima do seu, nem altera o próprio vínculo.
  A chefia só nasce por `definir_chefe` (admin) ou `transferir_chefia` (chefe atual, que
  vira gestor). Não é possível revogar o último admin.
- **Cargo** (`perfis.cargo`: Técnico, Docente ou Discente) é só informativo e não dá
  permissão nenhuma.
- **Pedido de acesso** (`pedido_vinculo`): tabela preparada para uma próxima etapa; ainda
  não é usada.

### Onde a regra mora

Uma única função decide as permissões dentro de um laboratório:

```sql
public.tem_permissao(p_laboratorio uuid, p_acao text) -> boolean
```

Ações atuais: `laboratorio.ver`, `consumo.registrar`, `residuo.registrar`,
`transferencia.solicitar`, `transferencia.aprovar`, `estoque.editar`, `membros.gerenciar`,
`chefia.transferir`. Para o catálogo global há `tem_permissao_global('reagente.cadastrar' |
'reagente.editar')`, e `eh_admin()` para o admin.

**Para uma feature nova:** acrescente a ação em `acoes_laboratorio()` e na matriz de
`tem_permissao()` (numa migration nova), e use `tem_permissao(id_laboratorio, 'sua.acao')`
nas políticas de RLS e nas RPCs. O front lê as mesmas ações por `minhas_permissoes()`, só
para esconder o que o usuário não pode usar; quem garante a regra é o banco.

No front, `src/shared/permissoes.js` guarda o laboratório ativo e as ações permitidas nele.
Para esconder um botão, marque-o com `data-permissao="sua.acao"` e chame
`aplicarPermissoes(elemento, acoes)` depois de renderizar.

As escritas em `vinculo_laboratorio` e `administrador` só acontecem pelas RPCs
`conceder_vinculo`, `revogar_vinculo`, `transferir_chefia`, `definir_chefe`,
`conceder_admin`, `revogar_admin` e `definir_cargo`. A tela de equipe lê ativos e histórico
por `vinculos_do_laboratorio(laboratorio)`, que devolve os nomes (inclusive de
ex-integrantes) sem abrir a tabela `perfis`.

### Auditoria

Toda inclusão, alteração e exclusão em `estoquelab`, `reagente` e `residuo` vira uma linha
em `auditoria` (trigger `registrar_auditoria`), com os valores de antes e de depois em
`jsonb`, quem fez, quando e a origem: `manual`, `consumo` ou `transferencia` (as RPCs
marcam a origem com `marcar_origem_auditoria`). A tabela só tem política de leitura;
ninguém do app insere, altera ou apaga linhas nela. As entradas em `movimentacao` também
são só de inserção.

A edição de um item de estoque é feita só pela RPC `editar_item_estoque`, que exige motivo
quando muda a quantidade, a unidade ou o reagente. O motivo fica na auditoria e aparece no
Histórico.

### Dependência do Supabase Auth

O usuário logado é lido só por `usuario_atual()` e `email_atual()` (que chamam
`auth.uid()` / `auth.email()`). Além delas, dependem do Supabase Auth apenas a FK
`perfis.id → auth.users` e o trigger que cria o perfil no cadastro
(`handle_new_user`). Se o sistema sair do Supabase para um Postgres puro, são esses os
pontos a trocar.

## 🧪 Rodando o banco e os testes localmente (Docker)

Pré-requisitos: **Docker** rodando (Docker Desktop no Windows/macOS) e `npm install` feito.

```bash
npm run db:start   # sobe Postgres + Auth + Storage locais e aplica todas as migrations
npm run test:db    # roda os testes pgTAP de supabase/tests/
npm run db:reset   # recria o banco local do zero (reaplica as migrations)
npm run db:stop    # desliga os containers
```

Na primeira vez o `db:start` baixa as imagens e demora alguns minutos. O comando mostra a
URL da API local e as chaves; para apontar o front para o banco local, use essa URL e a
`anon key` no `src/.env`.

Os testes cobrem a matriz de permissões, as regras de delegação, a gestão de admins, as
políticas de RLS de cada tabela, a lista exata de políticas (uma política a mais pode
liberar acesso) e a migração dos dados do modelo antigo.

## 🆕 Criando uma migration

```bash
npx supabase migration new descricao_curta
```

Edite o arquivo criado em `supabase/migrations/`, rode `npm run db:reset` e
`npm run test:db`. Uma migration já aplicada em produção **nunca** é editada: corrija com
outra migration.

## 🚀 Aplicando num projeto Supabase

Login no CLI (uma vez por máquina) e vínculo com o projeto:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref-do-projeto>
```

O `ref` é o código que aparece na URL do painel (`supabase.com/dashboard/project/<ref>`).
Para um Supabase self-hosted, troque o `link` por `--db-url` nos comandos abaixo
(`npx supabase db push --db-url "postgresql://..."`).

### Projeto novo (banco vazio)

```bash
npx supabase db push
```

Isso cria tudo, inclusive o bucket privado `documentos-projetos`. Depois crie o primeiro
admin (seção abaixo).

### Projeto que já existia antes das migrations

Os bancos de produção e de teste foram montados à mão com os scripts antigos. Antes do
primeiro `db push`, marque como aplicadas as migrations que eles já têm, para o CLI não
tentar recriá-las:

```bash
npx supabase migration repair --status applied 20260930120000 20260930120100 20260930120200
```

(`base`, `001_consumo_reagentes` e `002_correcoes_consumo`.) Se a
`003_seguranca_permissoes.sql` também já foi rodada à mão, inclua `20260930120300` na lista.
Depois:

```bash
npx supabase db push
```

A migration do modelo novo converte os dados existentes: cada `perfis.id_laboratorio` vira
um vínculo de **membro** e cada `perfis.is_admin` vira um **admin**. Nenhum laboratório
ganha chefe automaticamente; o admin define pelo painel.

## 👤 Primeiro admin

Não existe admin fixo no código nem no seed. Na instalação:

1. A pessoa cria a conta normalmente pela tela de cadastro.
2. Quem faz o deploy roda, com a chave **service_role** do projeto (Project Settings → API;
   nunca coloque essa chave no front nem no repositório):

   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<chave> npm run criar-admin -- pessoa@ufc.br
   ```

   No PowerShell:

   ```powershell
   $env:SUPABASE_URL="https://<ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<chave>"; npm run criar-admin -- pessoa@ufc.br
   ```

   O e-mail também pode vir da variável `PRIMEIRO_ADMIN_EMAIL`. Alternativa sem Node:
   no SQL Editor, `select public.criar_primeiro_admin('pessoa@ufc.br');`.

O comando só funciona enquanto **não houver nenhum admin ativo**. Depois disso, admins
cadastram e revogam outros admins pela interface.
