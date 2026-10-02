-- ============================================================
-- TABELA "Movimentacao" PASSA A SE CHAMAR movimentacao
-- ------------------------------------------------------------
-- Era a única tabela com nome entre aspas e com maiúscula, o que
-- obrigava a escrever public."Movimentacao" em todo SQL. Agora segue
-- o padrão das outras (minúsculas, sem aspas).
--
-- As políticas e os índices acompanham a tabela no RENAME. As
-- constraints são renomeadas só se tiverem o nome antigo (projetos
-- criados antes das migrations podem ter outros nomes).
--
-- Ponte temporária: a view "Movimentacao" deixa o site que já está
-- publicado funcionando até o front novo (que usa movimentacao) entrar
-- no ar. Ela usa as permissões de quem consulta (security_invoker),
-- então a RLS da tabela continua valendo. Remover numa migration
-- seguinte, depois do deploy.
-- ============================================================

ALTER TABLE public."Movimentacao" RENAME TO movimentacao;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conrelid = 'public.movimentacao'::regclass AND conname = 'Movimentacao_pkey') THEN
    ALTER TABLE public.movimentacao RENAME CONSTRAINT "Movimentacao_pkey" TO movimentacao_pkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conrelid = 'public.movimentacao'::regclass AND conname = 'Movimentacao_id_laboratorio_fkey') THEN
    ALTER TABLE public.movimentacao
      RENAME CONSTRAINT "Movimentacao_id_laboratorio_fkey" TO movimentacao_id_laboratorio_fkey;
  END IF;
END;
$$;

CREATE VIEW public."Movimentacao" WITH (security_invoker = true) AS
  SELECT * FROM public.movimentacao;

REVOKE ALL ON public."Movimentacao" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public."Movimentacao" TO authenticated;

COMMENT ON VIEW public."Movimentacao" IS
  'Ponte temporária para o front antigo; remover depois do deploy que usa public.movimentacao.';
