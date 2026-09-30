-- ============================================================
-- POLÍTICAS E RPCs USANDO O MODELO DE PERMISSÕES
-- ------------------------------------------------------------
-- Troca todas as checagens "id_laboratorio = get_my_lab_id() OR
-- am_i_admin()" por tem_permissao() / eh_admin(), e auth.uid() /
-- auth.email() por usuario_atual() / email_atual().
--
-- Regras (ver tem_permissao):
--   estoque       leitura para qualquer logado; escrita gestor+
--   consumo       registro membro+; leitura de quem vê o lab
--   resíduo       membro+ no próprio lab; admin só lê
--   transferência pedido membro+ (lab que recebe); aprovar/recusar
--                 gestor+ (lab de origem)
--   reagente      qualquer vínculo cadastra (sem duplicar nome);
--                 editar/excluir chefe ou admin
--   admin         gerencia laboratórios e lê tudo; não opera estoque
-- ============================================================

-- Políticas de RLS se somam: basta UMA liberar o acesso. Para não
-- sobrar nenhuma política antiga (inclusive criada à mão com outro
-- nome no painel), todas as políticas destas tabelas são removidas
-- antes de recriar as novas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('laboratorio', 'reagente', 'perfis', 'estoquelab', 'residuo',
                        'transferencia', 'feedback', 'projetos', 'Movimentacao', 'consumo')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- Garante a RLS ligada (se foi desligada pelo painel, as políticas
-- não teriam efeito nenhum).
ALTER TABLE public.laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reagente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoquelab ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residuo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Movimentacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumo ENABLE ROW LEVEL SECURITY;

-- Leitura pública da lista de laboratórios (tela de cadastro) e do
-- estoque/catálogo para usuários logados.
CREATE POLICY "Leitura publica de laboratorios" ON public.laboratorio
  FOR SELECT TO public USING (true);
CREATE POLICY "Ver estoque" ON public.estoquelab
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ver reagentes" ON public.reagente
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- LABORATÓRIO
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admin gerencia laboratorios" ON public.laboratorio;

CREATE POLICY "Admin cadastra laboratorio" ON public.laboratorio
  FOR INSERT TO authenticated WITH CHECK (public.eh_admin());
CREATE POLICY "Admin edita laboratorio" ON public.laboratorio
  FOR UPDATE TO authenticated USING (public.eh_admin()) WITH CHECK (public.eh_admin());
CREATE POLICY "Admin exclui laboratorio" ON public.laboratorio
  FOR DELETE TO authenticated USING (public.eh_admin());

-- ------------------------------------------------------------
-- PERFIS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Acesso perfis" ON public.perfis;
DROP POLICY IF EXISTS "Atualizar proprio perfil" ON public.perfis;

CREATE POLICY "Ver perfis" ON public.perfis
  FOR SELECT TO authenticated
  USING (
    id = public.usuario_atual()
    OR public.eh_admin()
    OR public.compartilha_laboratorio(id)
  );

-- Colunas editáveis já restritas a nome/sobrenome (migration de
-- segurança). O cargo é alterado pela RPC definir_cargo.
CREATE POLICY "Atualizar proprio perfil" ON public.perfis
  FOR UPDATE TO authenticated
  USING (id = public.usuario_atual())
  WITH CHECK (id = public.usuario_atual());

-- ------------------------------------------------------------
-- REAGENTE (catálogo global)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Cadastrar reagente" ON public.reagente;
DROP POLICY IF EXISTS "Admin edita reagente" ON public.reagente;
DROP POLICY IF EXISTS "Admin exclui reagente" ON public.reagente;

CREATE POLICY "Cadastrar reagente" ON public.reagente
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao_global('reagente.cadastrar'));
CREATE POLICY "Editar reagente" ON public.reagente
  FOR UPDATE TO authenticated
  USING (public.tem_permissao_global('reagente.editar'))
  WITH CHECK (public.tem_permissao_global('reagente.editar'));
CREATE POLICY "Excluir reagente" ON public.reagente
  FOR DELETE TO authenticated
  USING (public.tem_permissao_global('reagente.editar'));

-- Nome normalizado: minúsculas, sem espaços duplicados nas pontas/meio.
CREATE OR REPLACE FUNCTION public.normalizar_nome_reagente(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')));
$$;

-- Impede cadastrar (ou renomear para) um nome que já existe no catálogo.
-- Não mexe em duplicados antigos que já estejam no banco.
CREATE OR REPLACE FUNCTION public.checar_reagente_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.normalizar_nome_reagente(NEW.nome) = '' THEN
    RAISE EXCEPTION 'Informe o nome do reagente.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND public.normalizar_nome_reagente(NEW.nome) = public.normalizar_nome_reagente(OLD.nome) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reagente r
    WHERE r.id <> NEW.id
      AND public.normalizar_nome_reagente(r.nome) = public.normalizar_nome_reagente(NEW.nome)
  ) THEN
    RAISE EXCEPTION 'Já existe um reagente com o nome "%" no catálogo.', btrim(NEW.nome)
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reagente_sem_duplicado ON public.reagente;
CREATE TRIGGER reagente_sem_duplicado
  BEFORE INSERT OR UPDATE OF nome ON public.reagente
  FOR EACH ROW EXECUTE FUNCTION public.checar_reagente_duplicado();

CREATE INDEX IF NOT EXISTS idx_reagente_nome_normalizado
  ON public.reagente (public.normalizar_nome_reagente(nome));

-- ------------------------------------------------------------
-- ESTOQUE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Inserir estoque proprio lab" ON public.estoquelab;
DROP POLICY IF EXISTS "Atualizar estoque proprio lab" ON public.estoquelab;
DROP POLICY IF EXISTS "Excluir estoque proprio lab" ON public.estoquelab;

CREATE POLICY "Inserir estoque" ON public.estoquelab
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao(id_laboratorio, 'estoque.editar'));
CREATE POLICY "Atualizar estoque" ON public.estoquelab
  FOR UPDATE TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'estoque.editar'))
  WITH CHECK (public.tem_permissao(id_laboratorio, 'estoque.editar'));
CREATE POLICY "Excluir estoque" ON public.estoquelab
  FOR DELETE TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'estoque.editar'));

-- ------------------------------------------------------------
-- MOVIMENTAÇÃO (entradas de estoque)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Ver movimentacoes" ON public."Movimentacao";
DROP POLICY IF EXISTS "Inserir movimentacoes" ON public."Movimentacao";
DROP POLICY IF EXISTS "Atualizar movimentacoes" ON public."Movimentacao";
DROP POLICY IF EXISTS "Excluir movimentacoes" ON public."Movimentacao";

CREATE POLICY "Ver movimentacoes" ON public."Movimentacao"
  FOR SELECT TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'laboratorio.ver'));
CREATE POLICY "Inserir movimentacoes" ON public."Movimentacao"
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao(id_laboratorio, 'estoque.editar'));
CREATE POLICY "Atualizar movimentacoes" ON public."Movimentacao"
  FOR UPDATE TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'estoque.editar'))
  WITH CHECK (public.tem_permissao(id_laboratorio, 'estoque.editar'));
CREATE POLICY "Excluir movimentacoes" ON public."Movimentacao"
  FOR DELETE TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'estoque.editar'));

-- ------------------------------------------------------------
-- RESÍDUO
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Acesso total residuos" ON public.residuo;

CREATE POLICY "Ver residuos" ON public.residuo
  FOR SELECT TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'laboratorio.ver'));
CREATE POLICY "Inserir residuo" ON public.residuo
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao(id_laboratorio, 'residuo.registrar'));
CREATE POLICY "Atualizar residuo" ON public.residuo
  FOR UPDATE TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'residuo.registrar'))
  WITH CHECK (public.tem_permissao(id_laboratorio, 'residuo.registrar'));
CREATE POLICY "Excluir residuo" ON public.residuo
  FOR DELETE TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'residuo.registrar'));

-- ------------------------------------------------------------
-- CONSUMO
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Ver consumos" ON public.consumo;
DROP POLICY IF EXISTS "Inserir consumo proprio lab" ON public.consumo;

-- Inserção só pela RPC registrar_consumo (que debita o estoque).
REVOKE INSERT, UPDATE, DELETE ON public.consumo FROM anon, authenticated;

CREATE POLICY "Ver consumos" ON public.consumo
  FOR SELECT TO authenticated
  USING (public.tem_permissao(id_laboratorio, 'laboratorio.ver'));

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

  -- 4. Debita do estoque
  UPDATE public.estoquelab
  SET quantidade = quantidade - p_quantidade,
      data_atualizacao = now()
  WHERE id = p_id_item_estoque;

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

-- ------------------------------------------------------------
-- TRANSFERÊNCIA
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Gerenciar transferencias" ON public.transferencia;

CREATE POLICY "Ver transferencias" ON public.transferencia
  FOR SELECT TO authenticated
  USING (
    public.tem_permissao(id_lab_origem, 'laboratorio.ver')
    OR public.tem_permissao(id_lab_destino, 'laboratorio.ver')
  );

-- Pedido: feito por membro+ do laboratório que vai RECEBER, sempre pendente.
CREATE POLICY "Solicitar transferencia" ON public.transferencia
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao(id_lab_destino, 'transferencia.solicitar')
    AND id_lab_origem <> id_lab_destino
    AND lower(coalesce(status, 'pendente')) = 'pendente'
    AND motivo_recusa IS NULL
  );

-- Recusa: gestor+ do laboratório de ORIGEM, só de pedido pendente e só
-- para 'recusado'. A aprovação é feita pela RPC aprovar_transferencia.
REVOKE UPDATE ON public.transferencia FROM anon, authenticated;
GRANT UPDATE (status, motivo_recusa) ON public.transferencia TO authenticated;

CREATE POLICY "Recusar transferencia" ON public.transferencia
  FOR UPDATE TO authenticated
  USING (
    public.tem_permissao(id_lab_origem, 'transferencia.aprovar')
    AND lower(coalesce(status, '')) = 'pendente'
  )
  WITH CHECK (
    public.tem_permissao(id_lab_origem, 'transferencia.aprovar')
    AND status = 'recusado'
  );

REVOKE DELETE ON public.transferencia FROM anon, authenticated;

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

    -- 8. Marca como aprovada
    UPDATE public.transferencia
    SET status = 'aprovado'
    WHERE id = p_transfer_id;
END;
$$;

-- ------------------------------------------------------------
-- FEEDBACK
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Criar feedback" ON public.feedback;
DROP POLICY IF EXISTS "Ver feedbacks" ON public.feedback;

CREATE POLICY "Criar feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = public.usuario_atual());
CREATE POLICY "Ver feedbacks" ON public.feedback
  FOR SELECT TO authenticated USING (user_id = public.usuario_atual() OR public.eh_admin());

-- ------------------------------------------------------------
-- PROJETOS (autorizações)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Criar propria solicitacao" ON public.projetos;
DROP POLICY IF EXISTS "Ver solicitacoes" ON public.projetos;
DROP POLICY IF EXISTS "Admin gerencia solicitacoes" ON public.projetos;

CREATE POLICY "Criar propria solicitacao" ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.usuario_atual() OR responsavel_email = public.email_atual());
CREATE POLICY "Ver solicitacoes" ON public.projetos
  FOR SELECT TO authenticated
  USING (user_id = public.usuario_atual() OR responsavel_email = public.email_atual() OR public.eh_admin());
CREATE POLICY "Admin gerencia solicitacoes" ON public.projetos
  FOR UPDATE TO authenticated
  USING (public.eh_admin()) WITH CHECK (public.eh_admin());

-- ------------------------------------------------------------
-- STORAGE (documentos das autorizações)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admin envia documentos projetos" ON storage.objects;
CREATE POLICY "Admin envia documentos projetos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-projetos' AND public.eh_admin());

DROP POLICY IF EXISTS "Admin atualiza documentos projetos" ON storage.objects;
CREATE POLICY "Admin atualiza documentos projetos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-projetos' AND public.eh_admin())
  WITH CHECK (bucket_id = 'documentos-projetos' AND public.eh_admin());

DROP POLICY IF EXISTS "Admin remove documentos projetos" ON storage.objects;
CREATE POLICY "Admin remove documentos projetos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-projetos' AND public.eh_admin());

DROP POLICY IF EXISTS "Ler documentos do proprio projeto ou admin" ON storage.objects;
CREATE POLICY "Ler documentos do proprio projeto ou admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-projetos' AND (
      public.eh_admin() OR
      EXISTS (
        SELECT 1 FROM public.projetos p
        WHERE (p.pdf_assinado_url = name OR p.documento_url = name)
          AND (p.user_id = public.usuario_atual() OR p.responsavel_email = public.email_atual())
      )
    )
  );

-- ------------------------------------------------------------
-- PERMISSÕES DAS FUNÇÕES NOVAS / RECRIADAS
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.checar_reagente_duplicado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_consumo(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aprovar_transferencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_consumo(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_transferencia(uuid) TO authenticated;
