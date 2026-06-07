-- ============================================================
-- RPC: aprovar_transferencia(p_transfer_id uuid)
-- ------------------------------------------------------------
-- Executa, de forma transacional, a aprovação de uma transferência
-- entre laboratórios:
--   1. valida permissão (laboratório de ORIGEM / dono do material, ou admin);
--   2. valida que a transferência está pendente;
--   3. valida saldo suficiente no item de estoque de origem;
--   4. DEBITA a quantidade do estoque de origem (dono);
--   5. CREDITA no estoque do laboratório de destino (solicitante)
--      (soma a um item equivalente ou cria um novo);
--   6. marca a transferência como 'Aprovado'.
--
-- Convenção de direção:
--   id_lab_origem  = dono do reagente (de onde o material sai) -> quem APROVA.
--   id_lab_destino = quem solicitou / vai receber.
--
-- SECURITY DEFINER: necessário para alterar o estoque dos DOIS
-- laboratórios mesmo com RLS ativa.
--
-- Rode este script no SQL Editor do Supabase (é idempotente).
-- ============================================================

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
BEGIN
    -- 1. Carrega a transferência
    SELECT * INTO v_transfer
    FROM public.transferencia
    WHERE id = p_transfer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transferência não encontrada.';
    END IF;

    -- 2. Permissão: apenas o laboratório de ORIGEM (dono do material) ou um admin pode aprovar
    IF NOT (v_transfer.id_lab_origem = public.get_my_lab_id() OR public.am_i_admin()) THEN
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
    SET status = 'Aprovado'
    WHERE id = p_transfer_id;
END;
$$;

-- Permite que usuários autenticados chamem a função via API.
GRANT EXECUTE ON FUNCTION public.aprovar_transferencia(uuid) TO authenticated;
