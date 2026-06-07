# Banco de dados — LabStocker

Scripts SQL do LabStocker (PostgreSQL / Supabase). Aqui ficam tanto os **arquivos base** (montam o banco do zero).

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
