-- ============================================================
-- MIGRAÇÃO 002: Correções do consumo de reagentes
-- ------------------------------------------------------------
-- Depende da 001_consumo_reagentes.sql (rode ela antes).
-- Pode ser executada mais de uma vez sem erro.
--
-- 1. registrar_consumo: usuário sem laboratório (get_my_lab_id()
--    NULL) passava pela checagem de permissão e consumia estoque
--    de qualquer lab. am_i_admin() NULL agora conta como não-admin.
-- 2. consumo.id_item_estoque: ON DELETE SET NULL, para permitir
--    excluir um item de estoque que já foi consumido. O histórico
--    continua com id_reagente e id_laboratorio.
-- 3. consumo.id_usuario: nullable, para que excluir um usuário
--    não falhe (a FK já era ON DELETE SET NULL). O DEFAULT
--    auth.uid() é mantido.
-- 4. registrar_consumo só pode ser chamada por usuário logado.
--    Funções nascem com EXECUTE liberado para PUBLIC, e o Supabase
--    também concede ao papel anon; o GRANT da 001 não tirava isso.
-- ============================================================

-- 1. RPC com a checagem de permissão tratando NULL explicitamente
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
  v_meu_lab  uuid;
  v_admin    boolean;
BEGIN
  v_meu_lab := public.get_my_lab_id();
  v_admin := COALESCE(public.am_i_admin(), false);

  -- 1. Carrega o item de estoque
  SELECT * INTO v_item FROM public.estoquelab WHERE id = p_id_item_estoque;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado.';
  END IF;

  -- 2. Permissão: só o próprio laboratório (dono do item) ou admin.
  -- Sem laboratório vinculado (v_meu_lab NULL) e sem ser admin = sem permissão.
  IF NOT v_admin AND (v_meu_lab IS NULL OR v_item.id_laboratorio <> v_meu_lab) THEN
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

  -- 4. Debita do estoque
  UPDATE public.estoquelab
  SET quantidade = quantidade - p_quantidade,
      data_atualizacao = now()
  WHERE id = p_id_item_estoque;

  -- 5. Registra o consumo (rastreio de quem fez, quando, quanto e por quê)
  INSERT INTO public.consumo
    (id_laboratorio, id_item_estoque, id_reagente, id_usuario, quantidade, unidade_medida, finalidade)
  VALUES
    (v_item.id_laboratorio, p_id_item_estoque, v_item.id_reagente, auth.uid(), p_quantidade, v_item.unidade_medida, p_finalidade)
  RETURNING * INTO v_consumo;

  RETURN v_consumo;
END;
$$;

-- 4. Só usuário logado pode chamar a função
REVOKE EXECUTE ON FUNCTION public.registrar_consumo(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_consumo(uuid, numeric, text) TO authenticated;

-- 2. Item de estoque excluído não apaga nem bloqueia o histórico de consumo
ALTER TABLE public.consumo
  ALTER COLUMN id_item_estoque DROP NOT NULL;

ALTER TABLE public.consumo
  DROP CONSTRAINT IF EXISTS consumo_id_item_estoque_fkey;

ALTER TABLE public.consumo
  ADD CONSTRAINT consumo_id_item_estoque_fkey
  FOREIGN KEY (id_item_estoque) REFERENCES public.estoquelab(id) ON DELETE SET NULL;

-- 3. Usuário excluído vira NULL no consumo ("Usuário removido" no Histórico)
ALTER TABLE public.consumo
  ALTER COLUMN id_usuario DROP NOT NULL;
