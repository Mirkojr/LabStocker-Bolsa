-- ============================================================
-- Tabela: "Movimentacao"  (entradas / compras de estoque)
-- ------------------------------------------------------------
-- Registra movimentações de estoque (hoje: entradas/compras).
-- É gravada ao cadastrar um novo item de estoque
-- (estoqueService.registrarMovimentacaoEntradaestoque) e lida
-- pela linha do tempo da tela de Histórico
-- (movimentacoesService.listarEntradasPorLaboratorio).
--
-- Esta tabela NÃO existia no banco -> as consultas retornavam
-- "Could not find the table 'public.Movimentacao' in the schema
-- cache", quebrando a montagem do histórico.
--
-- IMPORTANTE: o app acessa a tabela como "Movimentacao" (M
-- maiúsculo). Por isso o nome é criado ENTRE ASPAS, para
-- preservar a grafia exata (sem aspas o Postgres rebaixaria
-- para "movimentacao" e o cliente não a encontraria).
--
-- Colunas seguem exatamente o que o código grava/le:
--   insert -> id_laboratorio, tipo, item_nome, quantidade, unidade, observacao
--   select -> filtra por id_laboratorio + tipo='ENTRADA', ordena por data_movimentacao
--
-- Rode este script no SQL Editor do Supabase (é idempotente).
-- ============================================================

CREATE TABLE IF NOT EXISTS public."Movimentacao" (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_laboratorio    uuid NOT NULL REFERENCES public.laboratorio(id) ON DELETE CASCADE,
    tipo              text NOT NULL DEFAULT 'ENTRADA',
    item_nome         text,
    quantidade        numeric,
    unidade           text,
    observacao        text,
    data_movimentacao timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentacao_lab
    ON public."Movimentacao" (id_laboratorio);

-- ------------------------------------------------------------
-- Row Level Security (mesmo padrão das demais tabelas)
-- ------------------------------------------------------------
ALTER TABLE public."Movimentacao" ENABLE ROW LEVEL SECURITY;

-- Leitura: o próprio laboratório (ou admin)
DROP POLICY IF EXISTS "Ver movimentacoes" ON public."Movimentacao";
CREATE POLICY "Ver movimentacoes"
    ON public."Movimentacao"
    FOR SELECT
    TO authenticated
    USING (id_laboratorio = public.get_my_lab_id() OR public.am_i_admin());

-- Inserção: somente para o próprio laboratório (ou admin)
DROP POLICY IF EXISTS "Inserir movimentacoes" ON public."Movimentacao";
CREATE POLICY "Inserir movimentacoes"
    ON public."Movimentacao"
    FOR INSERT
    TO authenticated
    WITH CHECK (id_laboratorio = public.get_my_lab_id() OR public.am_i_admin());

-- Atualização
DROP POLICY IF EXISTS "Atualizar movimentacoes" ON public."Movimentacao";
CREATE POLICY "Atualizar movimentacoes"
    ON public."Movimentacao"
    FOR UPDATE
    TO authenticated
    USING (id_laboratorio = public.get_my_lab_id() OR public.am_i_admin())
    WITH CHECK (id_laboratorio = public.get_my_lab_id() OR public.am_i_admin());

-- Exclusão
DROP POLICY IF EXISTS "Excluir movimentacoes" ON public."Movimentacao";
CREATE POLICY "Excluir movimentacoes"
    ON public."Movimentacao"
    FOR DELETE
    TO authenticated
    USING (id_laboratorio = public.get_my_lab_id() OR public.am_i_admin());
