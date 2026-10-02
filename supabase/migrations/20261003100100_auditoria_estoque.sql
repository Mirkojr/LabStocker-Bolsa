-- ============================================================
-- AUDITORIA DO ESTOQUE, DO CATÁLOGO E DOS RESÍDUOS
-- ------------------------------------------------------------
-- Toda inclusão, alteração e exclusão em estoquelab, reagente e
-- residuo vira uma linha em public.auditoria, com os valores de antes
-- e de depois, quem fez e quando. Quem grava é um trigger, então vale
-- para qualquer caminho (front, RPC ou chamada direta à API).
--
-- A auditoria é imutável: só tem política de leitura e ninguém do app
-- pode inserir, alterar ou apagar linhas nela. O mesmo vale agora para
-- as entradas em movimentacao (só inserção).
--
-- Origem do registro: as RPCs marcam 'consumo' ou 'transferencia' na
-- transação (labstocker.origem); o resto é 'manual'. Correção de
-- quantidade, unidade ou reagente de um item exige motivo, por isso a
-- edição de estoque passa a ser só pela RPC editar_item_estoque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABELA
-- ------------------------------------------------------------
-- id_laboratorio e id_registro sem FK de propósito: a auditoria
-- continua existindo depois que o item (ou o laboratório) é excluído.
-- id_usuario referencia perfis (para mostrar o nome no Histórico);
-- usuário excluído vira NULL, como no consumo.
CREATE TABLE public.auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY,
  tabela text NOT NULL,
  id_registro uuid NOT NULL,
  id_laboratorio uuid,
  acao text NOT NULL,
  origem text NOT NULL DEFAULT 'manual',
  motivo text,
  item_nome text,
  dados_antes jsonb,
  dados_depois jsonb,
  id_usuario uuid,
  data_registro timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT auditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.perfis(id) ON DELETE SET NULL,
  CONSTRAINT auditoria_tabela_check CHECK (tabela IN ('estoquelab', 'reagente', 'residuo')),
  CONSTRAINT auditoria_acao_check CHECK (acao IN ('inclusao', 'alteracao', 'exclusao')),
  CONSTRAINT auditoria_origem_check CHECK (origem IN ('manual', 'consumo', 'transferencia')),
  CONSTRAINT auditoria_motivo_check CHECK (motivo IS NULL OR char_length(motivo) <= 300)
);

CREATE INDEX idx_auditoria_lab_data ON public.auditoria (id_laboratorio, data_registro DESC);
CREATE INDEX idx_auditoria_registro ON public.auditoria (tabela, id_registro);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Linhas de laboratório: quem vê o laboratório. Linhas do catálogo
-- (sem laboratório): quem pode editar o catálogo.
CREATE POLICY "Ver auditoria" ON public.auditoria
  FOR SELECT TO authenticated
  USING (
    CASE
      WHEN id_laboratorio IS NULL THEN public.tem_permissao_global('reagente.editar')
      ELSE public.tem_permissao(id_laboratorio, 'laboratorio.ver')
    END
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.auditoria FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. TRIGGER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes  jsonb;
  v_depois jsonb;
  v_linha  jsonb;
  v_nome   text;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_antes := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_depois := to_jsonb(NEW); END IF;

  -- UPDATE que não mudou nada (além da data de atualização) não é registrado.
  IF TG_OP = 'UPDATE' AND (v_antes - 'data_atualizacao') = (v_depois - 'data_atualizacao') THEN
    RETURN NULL;
  END IF;

  v_linha := coalesce(v_depois, v_antes);
  v_nome := CASE TG_TABLE_NAME
    WHEN 'estoquelab' THEN (SELECT r.nome FROM public.reagente r WHERE r.id = (v_linha->>'id_reagente')::uuid)
    WHEN 'reagente' THEN v_linha->>'nome'
    WHEN 'residuo' THEN v_linha->>'descricao'
  END;

  INSERT INTO public.auditoria
    (tabela, id_registro, id_laboratorio, acao, origem, motivo, item_nome, dados_antes, dados_depois, id_usuario)
  VALUES (
    TG_TABLE_NAME,
    (v_linha->>'id')::uuid,
    (v_linha->>'id_laboratorio')::uuid,
    CASE TG_OP WHEN 'INSERT' THEN 'inclusao' WHEN 'UPDATE' THEN 'alteracao' ELSE 'exclusao' END,
    coalesce(nullif(current_setting('labstocker.origem', true), ''), 'manual'),
    nullif(current_setting('labstocker.motivo', true), ''),
    v_nome,
    v_antes,
    v_depois,
    -- Só referencia quem tem perfil (sem perfil, a auditoria não pode travar a operação).
    (SELECT p.id FROM public.perfis p WHERE p.id = public.usuario_atual())
  );

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_auditoria() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER auditar_estoquelab
  AFTER INSERT OR UPDATE OR DELETE ON public.estoquelab
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditar_reagente
  AFTER INSERT OR UPDATE OR DELETE ON public.reagente
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditar_residuo
  AFTER INSERT OR UPDATE OR DELETE ON public.residuo
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- Marca a origem e o motivo das alterações seguintes nesta transação.
-- Chamada só de dentro das RPCs (SECURITY DEFINER); não fica exposta.
CREATE OR REPLACE FUNCTION public.marcar_origem_auditoria(p_origem text, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('labstocker.origem', coalesce(p_origem, ''), true),
         set_config('labstocker.motivo', coalesce(p_motivo, ''), true);
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_origem_auditoria(text, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. ENTRADAS (movimentacao) SÓ POR INSERÇÃO
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Atualizar movimentacoes" ON public.movimentacao;
DROP POLICY IF EXISTS "Excluir movimentacoes" ON public.movimentacao;
REVOKE UPDATE, DELETE, TRUNCATE ON public.movimentacao FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 4. EDIÇÃO DE ITEM DE ESTOQUE SÓ PELA RPC (com motivo)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Atualizar estoque" ON public.estoquelab;
REVOKE UPDATE ON public.estoquelab FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.editar_item_estoque(
  p_id uuid,
  p_id_reagente uuid,
  p_quantidade numeric,
  p_unidade_medida text,
  p_data_validade date,
  p_observacoes text,
  p_motivo text DEFAULT NULL
)
RETURNS public.estoquelab
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item   public.estoquelab%ROWTYPE;
  v_motivo text := nullif(btrim(p_motivo), '');
BEGIN
  SELECT * INTO v_item FROM public.estoquelab WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado.';
  END IF;

  IF NOT public.tem_permissao(v_item.id_laboratorio, 'estoque.editar') THEN
    RAISE EXCEPTION 'Sem permissão para editar este item.';
  END IF;

  -- Mudar o que está no frasco (quantidade, unidade ou reagente) é uma
  -- correção de inventário: precisa de motivo.
  IF (p_quantidade IS DISTINCT FROM v_item.quantidade
      OR p_unidade_medida IS DISTINCT FROM v_item.unidade_medida
      OR p_id_reagente IS DISTINCT FROM v_item.id_reagente)
     AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste.';
  END IF;

  IF char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'O motivo pode ter até 300 caracteres.';
  END IF;

  PERFORM public.marcar_origem_auditoria('manual', v_motivo);

  UPDATE public.estoquelab
  SET id_reagente = p_id_reagente,
      quantidade = p_quantidade,
      unidade_medida = p_unidade_medida,
      data_validade = p_data_validade,
      observacoes_operacionais = nullif(btrim(p_observacoes), ''),
      data_atualizacao = now()
  WHERE id = p_id
  RETURNING * INTO v_item;

  PERFORM public.marcar_origem_auditoria(NULL);
  RETURN v_item;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.editar_item_estoque(uuid, uuid, numeric, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_item_estoque(uuid, uuid, numeric, text, date, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 5. CONSUMO E TRANSFERÊNCIA MARCAM A ORIGEM
-- ------------------------------------------------------------
-- Mesmo corpo da migration de políticas, com a marcação de origem.
CREATE OR REPLACE FUNCTION public.registrar_consumo(
  p_id_item_estoque uuid,
  p_quantidade numeric,
  p_finalidade text DEFAULT NULL
)
RETURNS public.consumo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     public.estoquelab%ROWTYPE;
  v_consumo  public.consumo%ROWTYPE;
BEGIN
  -- 1. Carrega (e trava) o item de estoque
  SELECT * INTO v_item FROM public.estoquelab WHERE id = p_id_item_estoque FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado.';
  END IF;

  -- 2. Permissão central
  IF NOT public.tem_permissao(v_item.id_laboratorio, 'consumo.registrar') THEN
    RAISE EXCEPTION 'Sem permissão para consumir este item.';
  END IF;

  -- 3. Validações de quantidade
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  IF v_item.quantidade < p_quantidade THEN
    RAISE EXCEPTION 'Quantidade insuficiente em estoque (disponível: %, solicitado: %).',
      v_item.quantidade, p_quantidade;
  END IF;

  -- 4. Debita do estoque (a auditoria registra como consumo)
  PERFORM public.marcar_origem_auditoria('consumo');
  UPDATE public.estoquelab
  SET quantidade = quantidade - p_quantidade,
      data_atualizacao = now()
  WHERE id = p_id_item_estoque;
  PERFORM public.marcar_origem_auditoria(NULL);

  -- 5. Registra o consumo
  INSERT INTO public.consumo
    (id_laboratorio, id_item_estoque, id_reagente, id_usuario, quantidade, unidade_medida, finalidade)
  VALUES
    (v_item.id_laboratorio, p_id_item_estoque, v_item.id_reagente, public.usuario_atual(),
     p_quantidade, v_item.unidade_medida, p_finalidade)
  RETURNING * INTO v_consumo;

  RETURN v_consumo;
END;
$$;

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

    -- 4. Carrega o item de estoque de origem
    SELECT * INTO v_item_origem
    FROM public.estoquelab
    WHERE id = v_transfer.id_item_estoque
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de estoque de origem não encontrado.';
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
