-- ============================================================
-- EQUIPE DO LABORATÓRIO (ativos e histórico) COM NOMES
-- ------------------------------------------------------------
-- A RLS de perfis só mostra colegas com vínculo ATIVO. No histórico
-- da equipe aparecem também ex-integrantes e quem concedeu/revogou
-- (às vezes um admin de fora do laboratório). Esta função devolve
-- esses nomes sem abrir a tabela perfis, e só para quem pode ver o
-- laboratório (tem_permissao 'laboratorio.ver').
-- ============================================================

CREATE OR REPLACE FUNCTION public.vinculos_do_laboratorio(p_laboratorio uuid)
RETURNS TABLE (
  id uuid,
  id_usuario uuid,
  papel public.papel_laboratorio,
  concedido_em timestamp with time zone,
  expira_em timestamp with time zone,
  observacao text,
  revogado_em timestamp with time zone,
  motivo_revogacao text,
  nome text,
  sobrenome text,
  email text,
  cargo text,
  concedido_por_nome text,
  revogado_por_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id, v.id_usuario, v.papel, v.concedido_em, v.expira_em, v.observacao,
    v.revogado_em, v.motivo_revogacao,
    u.nome, u.sobrenome, u.email, u.cargo,
    NULLIF(btrim(concat_ws(' ', c.nome, c.sobrenome)), ''),
    NULLIF(btrim(concat_ws(' ', r.nome, r.sobrenome)), '')
  FROM public.vinculo_laboratorio v
  LEFT JOIN public.perfis u ON u.id = v.id_usuario
  LEFT JOIN public.perfis c ON c.id = v.concedido_por
  LEFT JOIN public.perfis r ON r.id = v.revogado_por
  WHERE v.id_laboratorio = p_laboratorio
    AND public.tem_permissao(p_laboratorio, 'laboratorio.ver')
  ORDER BY v.concedido_em DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.vinculos_do_laboratorio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vinculos_do_laboratorio(uuid) TO authenticated;
