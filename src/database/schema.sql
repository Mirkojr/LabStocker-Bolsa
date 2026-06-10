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
  CONSTRAINT estoquelab_quantidade_check CHECK (quantidade >= 0)
  CONSTRAINT estoquelab_unidade_check CHECK (unidade_medida IN ('un','mL','L','g','kg','mg'))
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
  data_solicitacao timestamp with time zone DEFAULT now(),
  CONSTRAINT transferencia_pkey PRIMARY KEY (id),
  CONSTRAINT transferencia_id_item_estoque_fkey FOREIGN KEY (id_item_estoque) REFERENCES public.estoquelab(id),
  CONSTRAINT transferencia_id_lab_origem_fkey FOREIGN KEY (id_lab_origem) REFERENCES public.laboratorio(id),
  CONSTRAINT transferencia_id_lab_destino_fkey FOREIGN KEY (id_lab_destino) REFERENCES public.laboratorio(id),
  -- [validacao] quantidade positiva e status restrito
  CONSTRAINT transferencia_quantidade_check CHECK (quantidade_transferida > 0),
  CONSTRAINT transferencia_status_check CHECK (status IN ('pendente','aprovado','recusado'))
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