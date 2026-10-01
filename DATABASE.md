# Banco de Dados — LabStocker

Documentação inferida de `supabase/migrations/*.sql`, `supabase/tests/*.sql` e chamadas em `src/shared/services/*`.

## 1) Dicionário de Dados (PostgreSQL)

## Schema `public`

### `laboratorio`
- **PK:** `id`
- **FK:** —

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| nome_laboratorio | text | não |
| codigo_sipac | text (UNIQUE) | não |
| data_criacao | timestamp with time zone | sim |

### `reagente`
- **PK:** `id`
- **FK:** —

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| nome | text | não |
| composicao_quimica | text | sim |
| data_criacao | timestamp with time zone | sim |
| instituicao_controladora | text | sim |

### `perfis`
- **PK:** `id`
- **FK:** `id -> auth.users(id)`, `id_laboratorio -> laboratorio(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| nome | text | não |
| sobrenome | text | não |
| tipo_identificador | text | não |
| identificador | text | não |
| id_laboratorio | uuid | sim |
| is_admin | boolean | sim |
| email | text | sim |
| cargo | text (`Técnico` \| `Docente` \| `Discente`) | sim |

### `estoquelab`
- **PK:** `id`
- **FK:** `id_laboratorio -> laboratorio(id)`, `id_reagente -> reagente(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_laboratorio | uuid | não |
| id_reagente | uuid | não |
| quantidade | numeric | não |
| unidade_medida | text | não |
| data_validade | date | sim |
| observacoes_operacionais | text | sim |
| data_atualizacao | timestamp with time zone | sim |

### `residuo`
- **PK:** `id`
- **FK:** `id_laboratorio -> laboratorio(id)`, `id_consumo -> consumo(id)`, `id_usuario -> perfis(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_laboratorio | uuid | não |
| descricao | text | não |
| tipo_perigo | text | não |
| quantidade | numeric | não |
| unidade_medida | text | não |
| status | text | sim |
| data_criacao | timestamp with time zone | sim |
| id_consumo | uuid | sim |
| id_usuario | uuid | sim |

### `transferencia`
- **PK:** `id`
- **FK:** `id_item_estoque -> estoquelab(id)`, `id_lab_origem -> laboratorio(id)`, `id_lab_destino -> laboratorio(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_item_estoque | uuid | não |
| id_lab_origem | uuid | não |
| id_lab_destino | uuid | não |
| quantidade_transferida | numeric | não |
| status | text (`pendente` \| `aprovado` \| `recusado`) | sim |
| motivo_recusa | text | sim |
| data_solicitacao | timestamp with time zone | sim |

### `feedback`
- **PK:** `id`
- **FK:** `user_id -> auth.users(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| user_id | uuid | sim |
| tipo | text | não |
| mensagem | text | não |
| status | text | sim |
| data_envio | timestamp with time zone | sim |

### `projetos`
- **PK:** `id`
- **FK:** `user_id -> auth.users(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| created_at | timestamp with time zone | sim |
| user_id | uuid | sim |
| responsavel_nome | text | não |
| responsavel_siape | text | sim |
| responsavel_cpf | text | sim |
| responsavel_email | text | não |
| responsavel_telefone | text | sim |
| titulo_projeto | text | não |
| orgao_financiador | text | sim |
| registro_numero | text | sim |
| periodo_execucao | text | sim |
| lab_nome | text | sim |
| lab_sipac | text | sim |
| produtos | jsonb | não |
| status | text (`pendente` \| `aprovado` \| `recusado`) | não |
| motivo_recusa | text | sim |
| cargo_responsavel | text | sim |
| departamento_responsavel | text | sim |
| unidade_academica | text | sim |
| local_atividades | text | sim |
| depto_atividades | text | sim |
| orgao_controlador | text | sim |
| documento_url | text | sim |
| pdf_assinado_url | text | sim |

### `"Movimentacao"`
- **PK:** `id`
- **FK:** `id_laboratorio -> laboratorio(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_laboratorio | uuid | não |
| tipo | text | não |
| item_nome | text | sim |
| quantidade | numeric | sim |
| unidade | text | sim |
| observacao | text | sim |
| data_movimentacao | timestamp with time zone | não |

### `consumo`
- **PK:** `id`
- **FK:** `id_laboratorio -> laboratorio(id)`, `id_item_estoque -> estoquelab(id)`, `id_reagente -> reagente(id)`, `id_usuario -> perfis(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_laboratorio | uuid | não |
| id_item_estoque | uuid | sim |
| id_reagente | uuid | não |
| id_usuario | uuid | sim |
| quantidade | numeric | não |
| unidade_medida | text | não |
| finalidade | text | sim |
| data_consumo | timestamp with time zone | não |

### `vinculo_laboratorio`
- **PK:** `id`
- **FK:** `id_usuario -> perfis(id)`, `id_laboratorio -> laboratorio(id)`, `concedido_por -> perfis(id)`, `revogado_por -> perfis(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_usuario | uuid | não |
| id_laboratorio | uuid | não |
| papel | public.papel_laboratorio (`membro` \| `gestor` \| `chefe`) | não |
| concedido_por | uuid | sim |
| concedido_em | timestamp with time zone | não |
| expira_em | timestamp with time zone | sim |
| observacao | text | sim |
| revogado_por | uuid | sim |
| revogado_em | timestamp with time zone | sim |
| motivo_revogacao | text | sim |

### `administrador`
- **PK:** `id`
- **FK:** `id_usuario -> perfis(id)`, `concedido_por -> perfis(id)`, `revogado_por -> perfis(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_usuario | uuid | não |
| concedido_por | uuid | sim |
| concedido_em | timestamp with time zone | não |
| observacao | text | sim |
| revogado_por | uuid | sim |
| revogado_em | timestamp with time zone | sim |
| motivo_revogacao | text | sim |

### `pedido_vinculo`
- **PK:** `id`
- **FK:** `id_usuario -> perfis(id)`, `id_laboratorio -> laboratorio(id)`, `decidido_por -> perfis(id)`

| Coluna | Tipo | Nulo |
|---|---|---|
| id | uuid | não |
| id_usuario | uuid | não |
| id_laboratorio | uuid | não |
| mensagem | text | sim |
| status | text (`pendente` \| `aprovado` \| `recusado` \| `cancelado`) | não |
| criado_em | timestamp with time zone | não |
| decidido_por | uuid | sim |
| decidido_em | timestamp with time zone | sim |

## Dependências externas usadas pelo modelo

### `auth.users` (Supabase Auth)
- Referenciada por `perfis.id`, `feedback.user_id`, `projetos.user_id`.

### `storage.objects` / `storage.buckets` (Supabase Storage)
- Bucket privado `documentos-projetos` é criado em `storage.buckets`.
- Políticas aplicadas em `storage.objects` usam as colunas `bucket_id` e `name` para autorizar leitura/escrita de documentos ligados a `projetos.documento_url` e `projetos.pdf_assinado_url`.

---

## 2) Mapa de Relacionamentos

- **1 Laboratório** tem **N Estoques** (`estoquelab`), **N Resíduos** (`residuo`), **N Movimentações**, **N Vínculos** e aparece como origem/destino em **N Transferências**.
- **1 Reagente** aparece em **N Itens de Estoque** e **N Consumos**.
- **1 Item de Estoque** pode gerar **N Consumos** e **N Transferências**.
- **1 Consumo** pode originar **0..N Resíduos** (rastreio por `residuo.id_consumo`).
- **1 Usuário (auth.users)** tem **1 Perfil** (`perfis`) e pode ter **N Vínculos de laboratório** e **N registros de administrador** (histórico).
- **1 Perfil** pode conceder/revogar **N Vínculos** e **N Admins**.
- **1 Transferência** pertence a **1 laboratório de origem**, **1 de destino** e **1 item de estoque**.
- **1 Projeto** pertence a **0..1 usuário** e pode referenciar objetos em `storage.objects`.

---

## 3) Políticas de Segurança (RLS) e permissões

> Referência central de autorização:
> - `tem_permissao(id_laboratorio, acao)` (ações por laboratório)
> - `tem_permissao_global(acao)` (catálogo global)
> - `eh_admin()` (admin do sistema)

## 3.1 Tabelas críticas de operação

### `laboratorio`
- **SELECT:** público (`true`).
- **INSERT/UPDATE/DELETE:** somente `authenticated` com `eh_admin() = true`.

### `perfis`
- **SELECT:** usuário vê o próprio perfil, admins veem todos, e usuários que compartilham laboratório ativo (`compartilha_laboratorio`).
- **INSERT:** bloqueado para `anon`/`authenticated` (perfil nasce por trigger de `auth.users`).
- **UPDATE:** apenas próprio usuário (`id = usuario_atual()`), com privilégio de coluna restrito a `nome` e `sobrenome`; `cargo` deve ser alterado via RPC `definir_cargo`.
- **DELETE:** bloqueado para `anon`/`authenticated`.

### `reagente`
- **SELECT:** qualquer `authenticated`.
- **INSERT:** `tem_permissao_global('reagente.cadastrar')` (vínculo ativo em algum lab ou admin).
- **UPDATE/DELETE:** `tem_permissao_global('reagente.editar')` (chefe de algum laboratório ou admin).

### `estoquelab`
- **SELECT:** qualquer `authenticated`.
- **INSERT/UPDATE/DELETE:** `tem_permissao(id_laboratorio, 'estoque.editar')` (gestor/chefe no laboratório).
- **Observação:** admin lê, mas não opera estoque (confirmado em testes).

### `"Movimentacao"`
- **SELECT:** `tem_permissao(id_laboratorio, 'laboratorio.ver')`.
- **INSERT/UPDATE/DELETE:** `tem_permissao(id_laboratorio, 'estoque.editar')`.

### `consumo`
- **SELECT:** `tem_permissao(id_laboratorio, 'laboratorio.ver')`.
- **INSERT/UPDATE/DELETE direto:** revogado para `anon`/`authenticated`.
- **Escrita oficial:** RPC `registrar_consumo` (SECURITY DEFINER), exigindo `tem_permissao(..., 'consumo.registrar')`.

### `residuo`
- **SELECT:** `tem_permissao(id_laboratorio, 'laboratorio.ver')`.
- **INSERT/UPDATE/DELETE:** `tem_permissao(id_laboratorio, 'residuo.registrar')` (membro+ do laboratório).
- **Admin:** leitura liberada por `laboratorio.ver`; escrita não liberada por papel admin isolado.

### `transferencia`
- **SELECT:** `tem_permissao(id_lab_origem, 'laboratorio.ver')` **ou** `tem_permissao(id_lab_destino, 'laboratorio.ver')`.
- **INSERT (solicitação):** `tem_permissao(id_lab_destino, 'transferencia.solicitar')`, `id_lab_origem <> id_lab_destino`, status `pendente`.
- **UPDATE:** apenas colunas `status, motivo_recusa` concedidas; política de recusa exige `tem_permissao(id_lab_origem, 'transferencia.aprovar')` e status anterior `pendente`.
- **DELETE:** revogado.
- **Aprovação:** via RPC `aprovar_transferencia` (SECURITY DEFINER), com `tem_permissao(..., 'transferencia.aprovar')`.

### `feedback`
- **SELECT:** próprio usuário (`user_id = usuario_atual()`) ou admin.
- **INSERT:** apenas quando `user_id = usuario_atual()`.
- **UPDATE/DELETE:** sem política explícita (não liberado por RLS).

### `projetos`
- **SELECT:** próprio usuário (`user_id = usuario_atual()`), mesmo responsável por e-mail (`responsavel_email = email_atual()`) ou admin.
- **INSERT:** próprio usuário ou responsável por e-mail.
- **UPDATE:** somente admin (`eh_admin()`).
- **DELETE:** sem política explícita (não liberado por RLS).

## 3.2 Tabelas de governança de permissões

### `vinculo_laboratorio`
- **SELECT:** próprio usuário ou quem pode ver o laboratório (`tem_permissao(id_laboratorio, 'laboratorio.ver')`).
- **INSERT/UPDATE/DELETE:** revogados para `anon`/`authenticated`; gestão via RPCs (`conceder_vinculo`, `revogar_vinculo`, `transferir_chefia`, `definir_chefe`).

### `administrador`
- **SELECT:** próprio usuário ou admin.
- **INSERT/UPDATE/DELETE:** revogados para `anon`/`authenticated`; gestão via RPCs (`conceder_admin`, `revogar_admin`, `criar_primeiro_admin`).

### `pedido_vinculo`
- **SELECT:** próprio usuário, gestor/chefe com `tem_permissao(id_laboratorio, 'membros.gerenciar')`, ou admin.
- **INSERT/UPDATE/DELETE:** revogados para `anon`/`authenticated` (estrutura preparada; sem fluxo ativo no front atual).

## 3.3 Storage (`documentos-projetos`)

Políticas em `storage.objects`:
- **INSERT/UPDATE/DELETE:** somente admin (`eh_admin()`) no bucket `documentos-projetos`.
- **SELECT:** admin **ou** dono do projeto correspondente (quando `name` coincide com `projetos.documento_url`/`pdf_assinado_url` e o usuário é dono por `user_id` ou `responsavel_email`).
