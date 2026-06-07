# Banco de dados — LabStocker

Scripts SQL do LabStocker (PostgreSQL / Supabase). Aqui ficam tanto os **arquivos base** (montam o banco do zero) quanto as **migrations** (ajustes pontuais para bancos que já estão rodando).

> **Onde rodar:** Supabase → **SQL Editor**. Todos os scripts são seguros para colar e executar.

---

## 📦 Arquivos base (setup do zero)

Rode estes, **nesta ordem**, para montar um banco novo já completo. Não é preciso rodar nenhuma migration depois disso.

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `schema.sql` | Cria todas as tabelas: `laboratorio`, `reagente`, `perfis`, `estoquelab`, `residuo`, `transferencia`, `feedback`, `projetos` e `"Movimentacao"`. |
| 2 | `funcoes_auxiliares.sql` | Funções de apoio usadas pelas policies: `get_my_lab_id()` e `am_i_admin()` (ambas `SECURITY DEFINER`). |
| 3 | `funcao_aprovar_transferencia.sql` | RPC `aprovar_transferencia(p_transfer_id)`: aprova a transferência de forma transacional (debita a origem / credita o destino). Quem aprova é o laboratório de **origem** (dono do material). |
| 4 | `criar_perfil_trigger.sql` | Trigger que cria automaticamente um registro em `perfis` quando um usuário se cadastra no Auth. |
| 5 | `policies.sql` | Habilita RLS e cria todas as políticas de acesso de todas as tabelas. **Depende** das funções auxiliares (passo 2). |
| 6 | `storage_policies.sql` | Políticas do bucket de Storage `documentos-projetos` (ofícios/PDFs das autorizações). |

> ⚠️ A ordem importa: `policies.sql` usa `get_my_lab_id()` / `am_i_admin()`, então as **funções auxiliares precisam existir antes**. As tabelas (passo 1) também precisam existir antes das policies.

### Pré-requisitos manuais (fora do SQL)
- Criar o bucket de Storage **`documentos-projetos`** (privado) antes de rodar `storage_policies.sql`.
- Conferir a URL/anon key do projeto em `src/shared/config.js`.

---

## 🔧 Migrations (banco já em produção)

Use **somente** se o banco já existe e você quer aplicar uma correção específica sem recriar tudo. Em um setup do zero elas são **desnecessárias** (os arquivos base já incluem essas mudanças). Todas são idempotentes.

| Migration | Correção que aplica | Já incluída no arquivo base |
|-----------|--------------------|------------------------------|
| `migracao_email_perfis.sql` | Adiciona a coluna `email` em `perfis`. | `schema.sql` |
| `migracao_projetos.sql` | Cria a tabela `projetos` (autorizações). | `schema.sql` + `policies.sql` |
| `migracao_rls_estoque.sql` | Ajusta a RLS de `estoquelab` para permitir **ver o estoque de outros laboratórios** (leitura liberada; escrita restrita ao próprio lab). | `policies.sql` |
| `migracao_movimentacao.sql` | Cria a tabela `"Movimentacao"` (entradas de estoque) usada pela linha do tempo do **Histórico**, com sua RLS. | `schema.sql` + `policies.sql` |

> Para corrigir a RPC de aprovação em um banco existente, basta rodar de novo `funcao_aprovar_transferencia.sql` (é `CREATE OR REPLACE`).

---

## 🗒️ Notas e convenções

- **`"Movimentacao"` (M maiúsculo):** o app acessa a tabela com essa grafia, por isso ela é criada **entre aspas**. Sem as aspas, o Postgres rebaixaria o nome para `movimentacao` e o cliente não a encontraria ("schema cache").
- **Direção da transferência:** `id_lab_origem` = laboratório **dono** do reagente (de onde o material sai, quem **aprova**); `id_lab_destino` = laboratório que **solicita / recebe**.
- **RLS padrão:** a maioria das tabelas restringe acesso por `id_laboratorio = get_my_lab_id()`, com `OR am_i_admin()` para administradores. Exceções: `reagente` (catálogo, leitura/escrita liberada para autenticados) e `estoquelab` (leitura liberada, escrita restrita).
- **Pontos em aberto (Backlog):** padronização da grafia do status de `transferencia` (`Pendente` x `pendente`) e definição sobre transferência de **resíduos** (hoje só reagentes).
