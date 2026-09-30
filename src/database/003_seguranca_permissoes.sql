-- ============================================================
-- MIGRAÇÃO 003: Correções urgentes de segurança
-- ------------------------------------------------------------
-- Depende da 002_correcoes_consumo.sql. Pode ser executada mais
-- de uma vez sem erro.
--
-- 1. perfis: o usuário podia editar a própria linha inteira,
--    inclusive is_admin e id_laboratorio (virava admin ou entrava
--    em qualquer laboratório pelo console do navegador). Agora só
--    nome e sobrenome são editáveis pelo próprio usuário. O INSERT
--    direto também sai: o perfil é criado pelo trigger do cadastro.
-- 2. aprovar_transferencia: mesmo defeito corrigido na 002 para a
--    registrar_consumo. Com get_my_lab_id() NULL a checagem virava
--    NULL e não barrava; e a função podia ser chamada sem login.
-- 3. reagente: qualquer usuário logado editava e excluía o catálogo
--    global. Agora qualquer um lê e cadastra; editar e excluir fica
--    só com admin (os chefes de laboratório entram quando existirem).
-- ============================================================

-- 1. PERFIS: só nome e sobrenome são editáveis pelo próprio usuário
DROP POLICY IF EXISTS "Atualizar proprio perfil" ON public.perfis;
DROP POLICY IF EXISTS "Inserir proprio perfil" ON public.perfis;

REVOKE INSERT, UPDATE, DELETE ON public.perfis FROM anon, authenticated;
GRANT UPDATE (nome, sobrenome) ON public.perfis TO authenticated;

CREATE POLICY "Atualizar proprio perfil" ON public.perfis
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. APROVAR_TRANSFERENCIA: checagem de permissão tratando NULL
CREATE OR REPLACE FUNCTION public.aprovar_transferencia(p_transfer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transfer        public.transferencia%ROWTYPE;
    v_item_origem     public.estoquelab%ROWTYPE;
    v_qtd             numeric;
    v_item_destino_id uuid;
    v_meu_lab         uuid;
    v_admin           boolean;
BEGIN
    v_meu_lab := public.get_my_lab_id();
    v_admin := COALESCE(public.am_i_admin(), false);

    -- 1. Carrega a transferência
    SELECT * INTO v_transfer
    FROM public.transferencia
    WHERE id = p_transfer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transferência não encontrada.';
    END IF;

    -- 2. Permissão: apenas o laboratório de ORIGEM (dono do material) ou um admin pode aprovar
    -- Sem laboratório vinculado (v_meu_lab NULL) e sem ser admin = sem permissão.
    IF NOT v_admin AND (v_meu_lab IS NULL OR v_transfer.id_lab_origem <> v_meu_lab) THEN
        RAISE EXCEPTION 'Sem permissão para aprovar esta transferência.';
    END IF;

    -- 3. Só aprova se estiver pendente (aceita qualquer caixa de texto)
    IF lower(coalesce(v_transfer.status, '')) <> 'pendente' THEN
        RAISE EXCEPTION 'Esta transferência não está pendente (status atual: %).', v_transfer.status;
    END IF;

    -- 4. Carrega o item de estoque de origem
    SELECT * INTO v_item_origem
    FROM public.estoquelab
    WHERE id = v_transfer.id_item_estoque;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de estoque de origem não encontrado.';
    END IF;

    v_qtd := v_transfer.quantidade_transferida;

    -- 5. Valida saldo suficiente na origem
    IF v_item_origem.quantidade < v_qtd THEN
        RAISE EXCEPTION 'Quantidade insuficiente no estoque de origem (disponível: %, solicitado: %).',
            v_item_origem.quantidade, v_qtd;
    END IF;

    -- 6. Debita da origem (dono do material)
    UPDATE public.estoquelab
    SET quantidade = quantidade - v_qtd,
        data_atualizacao = now()
    WHERE id = v_item_origem.id;

    -- 7. Credita no destino (solicitante): procura item equivalente (mesmo reagente + unidade)
    SELECT id INTO v_item_destino_id
    FROM public.estoquelab
    WHERE id_laboratorio = v_transfer.id_lab_destino
      AND id_reagente   = v_item_origem.id_reagente
      AND unidade_medida = v_item_origem.unidade_medida
    LIMIT 1;

    IF v_item_destino_id IS NOT NULL THEN
        UPDATE public.estoquelab
        SET quantidade = quantidade + v_qtd,
            data_atualizacao = now()
        WHERE id = v_item_destino_id;
    ELSE
        INSERT INTO public.estoquelab
            (id_laboratorio, id_reagente, quantidade, unidade_medida, data_validade, observacoes_operacionais)
        VALUES
            (v_transfer.id_lab_destino, v_item_origem.id_reagente, v_qtd, v_item_origem.unidade_medida,
             v_item_origem.data_validade,
             'Recebido via transferência ' || p_transfer_id::text);
    END IF;

    -- 8. Marca a transferência como aprovada
    UPDATE public.transferencia
    SET status = 'aprovado'
    WHERE id = p_transfer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aprovar_transferencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_transferencia(uuid) TO authenticated;

-- 3. REAGENTE: leitura e cadastro para logados; edição e exclusão só admin
DROP POLICY IF EXISTS "Acesso total reagentes" ON public.reagente;
DROP POLICY IF EXISTS "Ver reagentes" ON public.reagente;
DROP POLICY IF EXISTS "Cadastrar reagente" ON public.reagente;
DROP POLICY IF EXISTS "Admin edita reagente" ON public.reagente;
DROP POLICY IF EXISTS "Admin exclui reagente" ON public.reagente;

CREATE POLICY "Ver reagentes" ON public.reagente
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Cadastrar reagente" ON public.reagente
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admin edita reagente" ON public.reagente
    FOR UPDATE TO authenticated
    USING (COALESCE(public.am_i_admin(), false))
    WITH CHECK (COALESCE(public.am_i_admin(), false));

CREATE POLICY "Admin exclui reagente" ON public.reagente
    FOR DELETE TO authenticated
    USING (COALESCE(public.am_i_admin(), false));
