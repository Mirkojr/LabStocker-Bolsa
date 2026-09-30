# Banco de dados — LabStocker

Scripts SQL do LabStocker (PostgreSQL / Supabase). Aqui ficam tanto os **arquivos base** (montam o banco do zero) quanto as **migrations** numeradas (mudanças incrementais sobre um banco já existente).

> **Onde rodar:** Supabase → **SQL Editor**. Todos os scripts são seguros para colar e executar.

---

## 📦 Arquivos base (setup do zero)

Rode estes, **nesta ordem**, para montar um banco novo. Depois, rode **todas** as migrations abaixo, também em ordem.

| #   | Arquivo                            | O que faz                                                                                                                                                                                     |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `schema.sql`                       | Cria todas as tabelas: `laboratorio`, `reagente`, `perfis`, `estoquelab`, `residuo`, `transferencia`, `feedback`, `projetos` e `"Movimentacao"`.                                              |
| 2   | `funcoes_auxiliares.sql`           | Funções de apoio usadas pelas policies: `get_my_lab_id()` e `am_i_admin()` (ambas `SECURITY DEFINER`).                                                                                        |
| 3   | `funcao_aprovar_transferencia.sql` | RPC `aprovar_transferencia(p_transfer_id)`: aprova a transferência de forma transacional (debita a origem / credita o destino). Quem aprova é o laboratório de **origem** (dono do material). |
| 4   | `criar_perfil_trigger.sql`         | Trigger que cria automaticamente um registro em `perfis` quando um usuário se cadastra no Auth.                                                                                               |
| 5   | `policies.sql`                     | Habilita RLS e cria todas as políticas de acesso de todas as tabelas. **Depende** das funções auxiliares (passo 2).                                                                           |
| 6   | `storage_policies.sql`             | Políticas do bucket de Storage `documentos-projetos` (ofícios/PDFs das autorizações).                                                                                                         |

> ⚠️ A ordem importa: `policies.sql` usa `get_my_lab_id()` / `am_i_admin()`, então as **funções auxiliares precisam existir antes**. As tabelas (passo 1) também precisam existir antes das policies.

### Pré-requisitos manuais (fora do SQL)

- Criar o bucket de Storage **`documentos-projetos`** (privado) antes de rodar `storage_policies.sql`.
- Conferir a URL/anon key do projeto em `src/shared/config.js`.

---

## 🔁 Migrations

Rode em ordem crescente. Num banco que já tem uma migration aplicada, rode só as seguintes.

| #   | Arquivo                     | O que faz                                                                                                                                                                                                                                                                     |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 | `001_consumo_reagentes.sql` | Cria a tabela `consumo` (com RLS), as colunas `id_consumo` e `id_usuario` em `residuo` e a RPC `registrar_consumo`.                                                                                                                                                           |
| 002 | `002_correcoes_consumo.sql` | Corrige a checagem de permissão da `registrar_consumo` (usuário sem laboratório não consome mais estoque alheio), restringe a função a usuários logados e deixa `consumo.id_item_estoque` / `consumo.id_usuario` nullable, para permitir excluir itens de estoque e usuários. |

> ⚠️ Não edite uma migration que já foi aplicada. Para corrigir algo, crie a próxima (`003_...sql`).
