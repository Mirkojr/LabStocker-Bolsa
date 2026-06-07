-- ============================================================
-- MIGRAÇÃO: corrigir visualização do estoque de outros laboratórios
-- ------------------------------------------------------------
-- Problema: a política "Acesso total estoque" era FOR ALL e restringia
-- TAMBÉM o SELECT ao próprio laboratório. Por isso o estoque de outros
-- labs aparecia vazio.
--
-- Solução: leitura liberada para qualquer autenticado; escrita continua
-- restrita ao próprio laboratório (ou admin).
--
-- Rode este script UMA VEZ no SQL Editor do Supabase.
-- ============================================================

-- Remove a política antiga (que bloqueava o SELECT entre labs).
DROP POLICY IF EXISTS "Acesso total estoque" ON public.estoquelab;

-- Leitura liberada para qualquer usuário autenticado.
CREATE POLICY "Ver estoque" ON public.estoquelab
    FOR SELECT TO authenticated
    USING (true);

-- Escrita restrita ao próprio laboratório (ou admin).
CREATE POLICY "Inserir estoque proprio lab" ON public.estoquelab
    FOR INSERT TO authenticated
    WITH CHECK (id_laboratorio = get_my_lab_id() OR am_i_admin());

CREATE POLICY "Atualizar estoque proprio lab" ON public.estoquelab
    FOR UPDATE TO authenticated
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin())
    WITH CHECK (id_laboratorio = get_my_lab_id() OR am_i_admin());

CREATE POLICY "Excluir estoque proprio lab" ON public.estoquelab
    FOR DELETE TO authenticated
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin());
