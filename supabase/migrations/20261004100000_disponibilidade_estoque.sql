-- ============================================================
-- ESTOQUE: CADA LABORATÓRIO VÊ O SEU; OS OUTROS VEEM A DISPONIBILIDADE
-- ------------------------------------------------------------
-- Antes, qualquer usuário logado (até sem vínculo) lia o estoque
-- inteiro de todos os laboratórios, com local e observações.
--
-- Agora:
--   - a tabela estoquelab é lida por quem vê o laboratório
--     (laboratorio.ver: vínculo ativo ou admin) e, para os itens de um
--     pedido de transferência, também pelo laboratório que pediu;
--   - os outros laboratórios consultam estoque_disponivel(lab), que
--     devolve só reagente, quantidade, unidade e validade, e só para
--     quem tem vínculo ativo (ou é admin). Produto controlado (PF ou
--     Exército) aparece sem a quantidade.
--
-- Também fecha uma brecha nos pedidos: o item pedido precisa ser do
-- laboratório de origem informado (no pedido e na aprovação).
-- ============================================================

-- ------------------------------------------------------------
-- 1. FUNÇÕES DE APOIO
-- ------------------------------------------------------------
-- SECURITY DEFINER: usadas dentro de políticas, precisam enxergar
-- estoquelab e transferencia sem depender da RLS de quem consulta.

-- O laboratório que pediu este item (pedido de qualquer status) pode
-- ver a linha do item: nome do reagente e unidade no Histórico,
-- nos Relatórios e nos Pedidos.
CREATE OR REPLACE FUNCTION public.item_pedido_pelo_usuario(
  p_item uuid,
  p_usuario uuid DEFAULT public.usuario_atual()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transferencia t
    WHERE t.id_item_estoque = p_item
      AND public.tem_permissao(t.id_lab_destino, 'laboratorio.ver', p_usuario)
  );
$$;

CREATE OR REPLACE FUNCTION public.item_do_laboratorio(p_item uuid, p_laboratorio uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.estoquelab e
    WHERE e.id = p_item AND e.id_laboratorio = p_laboratorio
  );
$$;

REVOKE EXECUTE ON FUNCTION public.item_pedido_pelo_usuario(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.item_do_laboratorio(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.item_pedido_pelo_usuario(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.item_do_laboratorio(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 2. LEITURA DA TABELA estoquelab
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Ver estoque" ON public.estoquelab;

CREATE POLICY "Ver estoque" ON public.estoquelab
  FOR SELECT TO authenticated
  USING (
    public.tem_permissao(id_laboratorio, 'laboratorio.ver')
    OR public.item_pedido_pelo_usuario(id)
  );

-- ------------------------------------------------------------
-- 3. DISPONIBILIDADE PARA OS OUTROS LABORATÓRIOS
-- ------------------------------------------------------------
-- Itens com saldo e dentro da validade (ou sem validade). Quem vê o
-- laboratório recebe a quantidade de tudo; os demais não recebem a
-- quantidade dos controlados (quantidade NULL, controlado = true).
CREATE OR REPLACE FUNCTION public.estoque_disponivel(p_laboratorio uuid)
RETURNS TABLE (
  id uuid,
  id_laboratorio uuid,
  id_reagente uuid,
  reagente_nome text,
  quantidade numeric,
  unidade_medida text,
  data_validade date,
  instituicao_controladora text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_do_lab boolean := public.tem_permissao(p_laboratorio, 'laboratorio.ver');
BEGIN
  IF NOT v_do_lab AND NOT EXISTS (
    SELECT 1 FROM public.vinculo_laboratorio v
    WHERE v.id_usuario = public.usuario_atual() AND public.vinculo_ativo(v)
  ) THEN
    RAISE EXCEPTION 'Só quem tem vínculo com um laboratório pode consultar o estoque dos outros.';
  END IF;

  RETURN QUERY
  SELECT e.id, e.id_laboratorio, e.id_reagente, r.nome,
         CASE WHEN v_do_lab OR r.instituicao_controladora IS NULL THEN e.quantidade END,
         e.unidade_medida, e.data_validade, r.instituicao_controladora
  FROM public.estoquelab e
  JOIN public.reagente r ON r.id = e.id_reagente
  WHERE e.id_laboratorio = p_laboratorio
    AND e.quantidade > 0
    AND (e.data_validade IS NULL OR e.data_validade >= current_date)
  ORDER BY r.nome, e.data_validade NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.estoque_disponivel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estoque_disponivel(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4. PEDIDO: O ITEM PRECISA SER DO LABORATÓRIO DE ORIGEM
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Solicitar transferencia" ON public.transferencia;

CREATE POLICY "Solicitar transferencia" ON public.transferencia
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao(id_lab_destino, 'transferencia.solicitar')
    AND id_lab_origem <> id_lab_destino
    AND public.item_do_laboratorio(id_item_estoque, id_lab_origem)
    AND lower(coalesce(status, 'pendente')) = 'pendente'
    AND motivo_recusa IS NULL
  );

-- Mesmo corpo da migration de auditoria, com a checagem do dono do item.
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
    -- 1. Carrega (e trava) a transferência
    SELECT * INTO v_transfer
    FROM public.transferencia
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transferência não encontrada.';
    END IF;

    -- 2. Permissão central: gestor ou chefe do laboratório de ORIGEM
    IF NOT public.tem_permissao(v_transfer.id_lab_origem, 'transferencia.aprovar') THEN
        RAISE EXCEPTION 'Sem permissão para aprovar esta transferência.';
    END IF;

    -- 3. Só aprova se estiver pendente
    IF lower(coalesce(v_transfer.status, '')) <> 'pendente' THEN
        RAISE EXCEPTION 'Esta transferência não está pendente (status atual: %).', v_transfer.status;
    END IF;

    -- 4. Carrega o item de estoque de origem, que precisa ser do
    -- laboratório que está aprovando
    SELECT * INTO v_item_origem
    FROM public.estoquelab
    WHERE id = v_transfer.id_item_estoque
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de estoque de origem não encontrado.';
    END IF;

    IF v_item_origem.id_laboratorio <> v_transfer.id_lab_origem THEN
        RAISE EXCEPTION 'O item pedido não pertence ao laboratório de origem.';
    END IF;

    v_qtd := v_transfer.quantidade_transferida;

    -- 5. Valida saldo suficiente na origem
    IF v_item_origem.quantidade < v_qtd THEN
        RAISE EXCEPTION 'Quantidade insuficiente no estoque de origem (disponível: %, solicitado: %).',
            v_item_origem.quantidade, v_qtd;
    END IF;

    -- A auditoria registra os passos 6 e 7 como transferência.
    PERFORM public.marcar_origem_auditoria('transferencia');

    -- 6. Debita da origem
    UPDATE public.estoquelab
    SET quantidade = quantidade - v_qtd,
        data_atualizacao = now()
    WHERE id = v_item_origem.id;

    -- 7. Credita no destino (soma a item equivalente ou cria um novo)
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

    PERFORM public.marcar_origem_auditoria(NULL);

    -- 8. Marca como aprovada
    UPDATE public.transferencia
    SET status = 'aprovado'
    WHERE id = p_transfer_id;
END;
$$;
