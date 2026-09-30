-- ============================================================
-- BASE: estado do banco antes das migrations numeradas.
-- ------------------------------------------------------------
-- Junta, na ordem de execução, os scripts que antes eram rodados à
-- mão no SQL Editor: schema, funções auxiliares, RPC de aprovação de
-- transferência, trigger de perfil, políticas de RLS, bucket e
-- políticas de Storage.
--
-- Bancos que já foram montados com esses scripts NÃO devem rodar
-- esta migration: marque-a como aplicada (veja supabase/README.md).
-- ============================================================

-- >>> schema.sql
-- 1. TABELAS BASE (Não dependem de ninguém)
CREATE TABLE public.laboratorio (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_laboratorio text NOT NULL,
  codigo_sipac text NOT NULL UNIQUE,
  data_criacao timestamp with time zone DEFAULT now(),
  CONSTRAINT laboratorio_pkey PRIMARY KEY (id)
);

CREATE TABLE public.reagente (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  composicao_quimica text,
  data_criacao timestamp with time zone DEFAULT now(),
  instituicao_controladora text,
  CONSTRAINT reagente_pkey PRIMARY KEY (id)
);

-- 2. TABELAS QUE DEPENDEM DAS BASES
CREATE TABLE public.perfis (
  id uuid NOT NULL,
  nome text NOT NULL,
  sobrenome text NOT NULL,
  tipo_identificador text NOT NULL,
  identificador text NOT NULL,
  id_laboratorio uuid,
  is_admin boolean DEFAULT false,
  email text,
  CONSTRAINT perfis_pkey PRIMARY KEY (id),
  CONSTRAINT perfis_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT perfis_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id),
  -- [validacao] formato de e-mail
  CONSTRAINT perfis_email_check CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE TABLE public.estoquelab (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_laboratorio uuid NOT NULL,
  id_reagente uuid NOT NULL,
  quantidade numeric NOT NULL,
  unidade_medida text NOT NULL,
  data_validade date,
  observacoes_operacionais text,
  data_atualizacao timestamp with time zone DEFAULT now(),
  CONSTRAINT estoquelab_pkey PRIMARY KEY (id),
  CONSTRAINT estoquelab_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id),
  CONSTRAINT estoquelab_id_reagente_fkey FOREIGN KEY (id_reagente) REFERENCES public.reagente(id),
  -- [validacao] quantidade nao-negativa
  CONSTRAINT estoquelab_quantidade_check CHECK (quantidade >= 0),
  CONSTRAINT estoquelab_unidade_check CHECK (unidade_medida IN ('un','mL','L','g','kg','mg')),
  CONSTRAINT estoquelab_observacoes_check CHECK (observacoes_operacionais IS NULL OR char_length(observacoes_operacionais) <= 500)
);

CREATE TABLE public.residuo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_laboratorio uuid NOT NULL,
  descricao text NOT NULL,
  tipo_perigo text NOT NULL,
  quantidade numeric NOT NULL,
  unidade_medida text NOT NULL,
  status text DEFAULT 'Em Aberto'::text,
  data_criacao timestamp with time zone DEFAULT now(),
  CONSTRAINT residuo_pkey PRIMARY KEY (id),
  CONSTRAINT residuo_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id),
  -- [validacao] quantidade nao-negativa
  CONSTRAINT residuo_quantidade_check CHECK (quantidade >= 0)
);

-- 3. TABELAS QUE DEPENDEM DO ESTOQUE
CREATE TABLE public.transferencia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_item_estoque uuid NOT NULL,
  id_lab_origem uuid NOT NULL,
  id_lab_destino uuid NOT NULL,
  quantidade_transferida numeric NOT NULL,
  status text DEFAULT 'pendente'::text, -- [validacao] grafia padronizada em minusculo
  motivo_recusa text, -- [novo] motivo informado quando a solicitacao e recusada
  data_solicitacao timestamp with time zone DEFAULT now(),
  CONSTRAINT transferencia_pkey PRIMARY KEY (id),
  CONSTRAINT transferencia_id_item_estoque_fkey FOREIGN KEY (id_item_estoque) REFERENCES public.estoquelab(id),
  CONSTRAINT transferencia_id_lab_origem_fkey FOREIGN KEY (id_lab_origem) REFERENCES public.laboratorio(id),
  CONSTRAINT transferencia_id_lab_destino_fkey FOREIGN KEY (id_lab_destino) REFERENCES public.laboratorio(id),
  -- [validacao] quantidade positiva e status restrito
  CONSTRAINT transferencia_quantidade_check CHECK (quantidade_transferida > 0),
  CONSTRAINT transferencia_status_check CHECK (status IN ('pendente','aprovado','recusado')),
  -- [validacao] tamanho do motivo de recusa
  CONSTRAINT transferencia_motivo_recusa_check CHECK (motivo_recusa IS NULL OR char_length(motivo_recusa) <= 300)
);

CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  status text DEFAULT 'pendente'::text,
  data_envio timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 4. SOLICITACOES DE AUTORIZACAO (PROJETOS)
CREATE TABLE public.projetos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  responsavel_nome text NOT NULL,
  responsavel_siape text,
  responsavel_cpf text,
  responsavel_email text NOT NULL,
  responsavel_telefone text,
  titulo_projeto text NOT NULL,
  orgao_financiador text,
  registro_numero text,
  periodo_execucao text,
  lab_nome text,
  lab_sipac text,
  produtos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  motivo_recusa text,
  -- Campos preenchidos pelo admin durante a aprovacao
  cargo_responsavel text,
  departamento_responsavel text,
  unidade_academica text,
  local_atividades text,
  depto_atividades text,
  orgao_controlador text,
  documento_url text,
  pdf_assinado_url text,
  CONSTRAINT projetos_pkey PRIMARY KEY (id),
  CONSTRAINT projetos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT projetos_status_check CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  -- [validacao] formato de e-mail e CPF
  CONSTRAINT projetos_email_check CHECK (responsavel_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT projetos_cpf_check CHECK (responsavel_cpf IS NULL OR responsavel_cpf ~ '^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$')
);

-- 5. MOVIMENTACOES DE ESTOQUE (entradas / compras) - usada pela linha do tempo do Historico
-- ATENCAO: o app acessa esta tabela como "Movimentacao" (M maiusculo), por isso o nome
-- e criado ENTRE ASPAS para preservar a grafia exata.
CREATE TABLE public."Movimentacao" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_laboratorio uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'ENTRADA'::text,
  item_nome text,
  quantidade numeric,
  unidade text,
  observacao text,
  data_movimentacao timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "Movimentacao_pkey" PRIMARY KEY (id),
  CONSTRAINT "Movimentacao_id_laboratorio_fkey" FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id) ON DELETE CASCADE,
  -- [validacao] quantidade nao-negativa
  CONSTRAINT movimentacao_quantidade_check CHECK (quantidade IS NULL OR quantidade >= 0)
);

CREATE INDEX idx_movimentacao_lab ON public."Movimentacao" (id_laboratorio);

-- >>> funcoes_auxiliares.sql
CREATE OR REPLACE FUNCTION public.get_my_lab_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id_laboratorio FROM public.perfis WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.am_i_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT is_admin FROM public.perfis WHERE id = auth.uid();
$$;

-- >>> funcao_aprovar_transferencia.sql
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
    SET status = 'aprovado'
    WHERE id = p_transfer_id;
END;
$$;

-- Permite que usuários autenticados chamem a função via API.
GRANT EXECUTE ON FUNCTION public.aprovar_transferencia(uuid) TO authenticated;

-- >>> criar_perfil_trigger.sql
-- 1. Função que cria o perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, sobrenome, tipo_identificador, identificador, id_laboratorio, is_admin, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo'),
    COALESCE(NEW.raw_user_meta_data->>'sobrenome', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'tipo_identificador', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'identificador', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_laboratorio', '')::uuid,
    false,
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger que dispara a função quando um usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- >>> policies.sql
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

-- >>> bucket documentos-projetos
-- Bucket PRIVADO usado pelas autorizações de projeto (antes criado à mão)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-projetos', 'documentos-projetos', false)
ON CONFLICT (id) DO NOTHING;

-- >>> storage_policies.sql
-- Storage policies para o bucket PRIVADO "documentos-projetos".
-- Pre-requisito: crie o bucket em Storage com a opcao "Public" DESMARCADA.
-- Rode este script no SQL Editor do Supabase.
--
-- Regras:
--  * Somente admin (am_i_admin()) faz upload/atualiza os documentos.
--  * Leitura (necessaria para gerar signed URLs): admin OU o dono da
--    solicitacao cujo arquivo corresponde ao documento/pdf salvo.
--
-- Obs.: o nome do objeto (coluna "name") e exatamente o valor salvo em
-- projetos.documento_url / projetos.pdf_assinado_url (uploadData.path).

-- Upload (admin)
DROP POLICY IF EXISTS "Admin envia documentos projetos" ON storage.objects;
CREATE POLICY "Admin envia documentos projetos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-projetos' AND am_i_admin());

-- Atualizacao/sobrescrita (admin)
DROP POLICY IF EXISTS "Admin atualiza documentos projetos" ON storage.objects;
CREATE POLICY "Admin atualiza documentos projetos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-projetos' AND am_i_admin())
  WITH CHECK (bucket_id = 'documentos-projetos' AND am_i_admin());

-- Remocao (admin)
DROP POLICY IF EXISTS "Admin remove documentos projetos" ON storage.objects;
CREATE POLICY "Admin remove documentos projetos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-projetos' AND am_i_admin());

-- Leitura (admin ou dono da solicitacao correspondente)
DROP POLICY IF EXISTS "Ler documentos do proprio projeto ou admin" ON storage.objects;
CREATE POLICY "Ler documentos do proprio projeto ou admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-projetos' AND (
      am_i_admin() OR
      EXISTS (
        SELECT 1 FROM public.projetos p
        WHERE (p.pdf_assinado_url = name OR p.documento_url = name)
          AND (p.user_id = auth.uid() OR p.responsavel_email = auth.email())
      )
    )
  );
