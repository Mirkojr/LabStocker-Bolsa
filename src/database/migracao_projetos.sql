-- Migração: cria a tabela public.projetos (sistema de Autorizações) + RLS.
-- Rode este script no SQL Editor do Supabase (uma vez).
--
-- IMPORTANTE: crie também, em Storage, um bucket PRIVADO chamado
-- "documentos-projetos" (os ofícios contêm CPF e não devem ser públicos).
-- O frontend usa createSignedUrl para gerar links temporários.

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.projetos (
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
  CONSTRAINT projetos_status_check CHECK (status IN ('pendente', 'aprovado', 'recusado'))
);

-- 2. RLS
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Criar propria solicitacao" ON public.projetos;
CREATE POLICY "Criar propria solicitacao" ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR responsavel_email = auth.email());

DROP POLICY IF EXISTS "Ver solicitacoes" ON public.projetos;
CREATE POLICY "Ver solicitacoes" ON public.projetos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR responsavel_email = auth.email() OR am_i_admin());

DROP POLICY IF EXISTS "Admin gerencia solicitacoes" ON public.projetos;
CREATE POLICY "Admin gerencia solicitacoes" ON public.projetos
  FOR UPDATE TO authenticated
  USING (am_i_admin()) WITH CHECK (am_i_admin());
