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
  CONSTRAINT perfis_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id)
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
  CONSTRAINT estoquelab_id_reagente_fkey FOREIGN KEY (id_reagente) REFERENCES public.reagente(id)
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
  CONSTRAINT residuo_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id)
);

-- 3. TABELAS QUE DEPENDEM DO ESTOQUE
CREATE TABLE public.transferencia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_item_estoque uuid NOT NULL,
  id_lab_origem uuid NOT NULL,
  id_lab_destino uuid NOT NULL,
  quantidade_transferida numeric NOT NULL,
  status text DEFAULT 'Pendente'::text,
  data_solicitacao timestamp with time zone DEFAULT now(),
  CONSTRAINT transferencia_pkey PRIMARY KEY (id),
  CONSTRAINT transferencia_id_item_estoque_fkey FOREIGN KEY (id_item_estoque) REFERENCES public.estoquelab(id),
  CONSTRAINT transferencia_id_lab_origem_fkey FOREIGN KEY (id_lab_origem) REFERENCES public.laboratorio(id),
  CONSTRAINT transferencia_id_lab_destino_fkey FOREIGN KEY (id_lab_destino) REFERENCES public.laboratorio(id)
);

CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  status text DEFAULT 'Pendente'::text,
  data_envio timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
