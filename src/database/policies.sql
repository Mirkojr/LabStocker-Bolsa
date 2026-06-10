-- ==========================================
-- ATIVANDO RLS EM TODAS AS TABELAS
-- ==========================================
ALTER TABLE public.laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reagente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoquelab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residuo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Movimentacao" ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- POLÍTICAS: LABORATÓRIO
-- ==========================================
CREATE POLICY "Leitura publica de laboratorios" ON public.laboratorio FOR SELECT TO public USING (true);
CREATE POLICY "Admin gerencia laboratorios" ON public.laboratorio FOR ALL TO authenticated USING (am_i_admin()) WITH CHECK (am_i_admin());

-- ==========================================
-- POLÍTICAS: REAGENTE
-- ==========================================
CREATE POLICY "Acesso total reagentes" ON public.reagente FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- POLÍTICAS: PERFIS (Ajustado para não dar erro 500 no login)
-- ==========================================
CREATE POLICY "Acesso perfis" ON public.perfis 
    FOR SELECT TO authenticated 
    USING (auth.uid() = id OR id_laboratorio = get_my_lab_id() OR am_i_admin());

CREATE POLICY "Atualizar proprio perfil" ON public.perfis FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Inserir proprio perfil" ON public.perfis FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ==========================================
-- POLÍTICAS: ESTOQUE
-- ==========================================
-- Leitura liberada para qualquer usuário autenticado: permite visualizar o
-- estoque de OUTROS laboratórios (ex.: para consultar e solicitar transferências).
CREATE POLICY "Ver estoque" ON public.estoquelab
    FOR SELECT TO authenticated
    USING (true);

-- Escrita (inserir/atualizar/excluir) restrita ao próprio laboratório ou admin.
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

-- ==========================================
-- POLÍTICAS: RESÍDUOS
-- ==========================================
CREATE POLICY "Acesso total residuos" ON public.residuo 
    FOR ALL TO authenticated 
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin()) 
    WITH CHECK (id_laboratorio = get_my_lab_id() OR am_i_admin());

-- ==========================================
-- POLÍTICAS: TRANSFERÊNCIA
-- ==========================================
CREATE POLICY "Gerenciar transferencias" ON public.transferencia 
    FOR ALL TO authenticated 
    USING (id_lab_origem = get_my_lab_id() OR id_lab_destino = get_my_lab_id() OR am_i_admin()) 
    WITH CHECK (id_lab_origem = get_my_lab_id() OR id_lab_destino = get_my_lab_id() OR am_i_admin());

-- ==========================================
-- POLÍTICAS: FEEDBACK
-- ==========================================
CREATE POLICY "Criar feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Ver feedbacks" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id OR am_i_admin());

-- ==========================================
-- POLÍTICAS: PROJETOS (Solicitações de autorização)
-- ==========================================
-- Usuário comum cria a própria solicitação
CREATE POLICY "Criar propria solicitacao" ON public.projetos
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR responsavel_email = auth.email());

-- Usuário vê as próprias; admin vê todas
CREATE POLICY "Ver solicitacoes" ON public.projetos
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR responsavel_email = auth.email() OR am_i_admin());

-- Somente admin atualiza (aprovar / recusar / dados administrativos)
CREATE POLICY "Admin gerencia solicitacoes" ON public.projetos
    FOR UPDATE TO authenticated
    USING (am_i_admin()) WITH CHECK (am_i_admin());

-- ==========================================
-- POLÍTICAS: MOVIMENTACAO (entradas de estoque / Historico)
-- ==========================================
-- Leitura/escrita restritas ao próprio laboratório (ou admin).
CREATE POLICY "Ver movimentacoes" ON public."Movimentacao"
    FOR SELECT TO authenticated
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin());

CREATE POLICY "Inserir movimentacoes" ON public."Movimentacao"
    FOR INSERT TO authenticated
    WITH CHECK (id_laboratorio = get_my_lab_id() OR am_i_admin());

CREATE POLICY "Atualizar movimentacoes" ON public."Movimentacao"
    FOR UPDATE TO authenticated
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin())
    WITH CHECK (id_laboratorio = get_my_lab_id() OR am_i_admin());

CREATE POLICY "Excluir movimentacoes" ON public."Movimentacao"
    FOR DELETE TO authenticated
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin());
