-- ============================================================
-- MIGRAÇÃO: Consumo de reagentes + vínculo com resíduo
-- ------------------------------------------------------------
-- Rode este script no SQL Editor do Supabase (é idempotente
-- na maior parte; se rodar duas vezes, os CREATE TABLE vão
-- falhar com "already exists" — normal, pode ignorar).
-- ============================================================

-- 1. TABELA CONSUMO
-- id_usuario referencia PERFIS (não auth.users) de propósito:
-- assim o Supabase consegue fazer o "embed" direto
-- (consumo.select("*, perfis(nome, sobrenome)")), igual já é
-- feito com estoquelab -> reagente(nome).
CREATE TABLE public.consumo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_laboratorio uuid NOT NULL,
  id_item_estoque uuid NOT NULL,
  id_reagente uuid NOT NULL,
  id_usuario uuid NOT NULL DEFAULT auth.uid(),
  quantidade numeric NOT NULL,
  unidade_medida text NOT NULL,
  finalidade text,
  data_consumo timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consumo_pkey PRIMARY KEY (id),
  CONSTRAINT consumo_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id),
  CONSTRAINT consumo_id_item_estoque_fkey FOREIGN KEY (id_item_estoque) REFERENCES public.estoquelab(id),
  CONSTRAINT consumo_id_reagente_fkey FOREIGN KEY (id_reagente) REFERENCES public.reagente(id),
  CONSTRAINT consumo_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.perfis(id) ON DELETE SET NULL,
  -- [validacao] quantidade positiva e finalidade com tamanho razoavel
  CONSTRAINT consumo_quantidade_check CHECK (quantidade > 0),
  CONSTRAINT consumo_finalidade_check CHECK (finalidade IS NULL OR char_length(finalidade) <= 300)
);

CREATE INDEX idx_consumo_lab ON public.consumo (id_laboratorio);
CREATE INDEX idx_consumo_usuario ON public.consumo (id_usuario);
CREATE INDEX idx_consumo_item_estoque ON public.consumo (id_item_estoque);

-- 2. RASTREABILIDADE NO RESÍDUO
-- id_consumo é NULLABLE de proposito: nem todo residuo nasce de
-- um consumo individual rastreado (limpeza de bancada, descarte
-- em lote, etc). id_usuario tambem referencia perfis, mesmo motivo.
ALTER TABLE public.residuo
  ADD COLUMN id_consumo uuid REFERENCES public.consumo(id) ON DELETE SET NULL,
  ADD COLUMN id_usuario uuid REFERENCES public.perfis(id) ON DELETE SET NULL DEFAULT auth.uid();

CREATE INDEX idx_residuo_consumo ON public.residuo (id_consumo);
CREATE INDEX idx_residuo_usuario ON public.residuo (id_usuario);

-- 3. RPC: registrar_consumo(p_id_item_estoque, p_quantidade, p_finalidade)
-- ------------------------------------------------------------
-- Segue o MESMO padrao de aprovar_transferencia.sql:
--   1. valida que o item pertence ao lab do usuario (ou admin)
--   2. valida saldo suficiente
--   3. DEBITA o estoque
--   4. insere o registro de consumo (usuario = auth.uid())
--   5. retorna a linha criada, para o front decidir se pergunta
--      sobre o residuo e ja pre-preencher o formulario.
-- SECURITY DEFINER: necessario para debitar o estoque mesmo com RLS ativa.
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
BEGIN
  v_meu_lab := public.get_my_lab_id();

  -- 1. Carrega o item de estoque
  SELECT * INTO v_item FROM public.estoquelab WHERE id = p_id_item_estoque;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque não encontrado.';
  END IF;

  -- 2. Permissão: só o próprio laboratório (dono do item) ou admin
  IF NOT (v_item.id_laboratorio = v_meu_lab OR public.am_i_admin()) THEN
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

GRANT EXECUTE ON FUNCTION public.registrar_consumo(uuid, numeric, text) TO authenticated;

-- 4. RLS: CONSUMO
ALTER TABLE public.consumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver consumos" ON public.consumo
    FOR SELECT TO authenticated
    USING (id_laboratorio = get_my_lab_id() OR am_i_admin());

-- Inserts normalmente passam pela RPC (SECURITY DEFINER), mas mantemos
-- a policy por consistência e para permitir insert direto se necessario.
CREATE POLICY "Inserir consumo proprio lab" ON public.consumo
    FOR INSERT TO authenticated
    WITH CHECK (id_laboratorio = get_my_lab_id() OR am_i_admin());
