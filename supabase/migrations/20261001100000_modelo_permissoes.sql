-- ============================================================
-- MODELO DE PERMISSÕES: vínculos usuário–laboratório e admins
-- ------------------------------------------------------------
-- Papéis por laboratório (membro < gestor < chefe) guardados em
-- vinculo_laboratorio; admin do sistema em administrador. Nenhum
-- registro é apagado: conceder cria uma linha, revogar preenche
-- revogado_em/revogado_por.
--
-- Toda checagem de permissão passa por tem_permissao(). As políticas
-- de RLS e as RPCs usam só essa função (e eh_admin()).
--
-- Dependência do Supabase Auth isolada em usuario_atual() e
-- email_atual(). Para rodar em Postgres puro, só elas (e o trigger
-- de criação de perfil em auth.users) precisam mudar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ISOLAMENTO DO SUPABASE AUTH
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_atual()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.email_atual()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.email();
$$;

-- ------------------------------------------------------------
-- 2. TIPOS E TABELAS
-- ------------------------------------------------------------
-- A ordem do enum define a hierarquia: membro < gestor < chefe.
CREATE TYPE public.papel_laboratorio AS ENUM ('membro', 'gestor', 'chefe');

CREATE TABLE public.vinculo_laboratorio (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL,
  id_laboratorio uuid NOT NULL,
  papel public.papel_laboratorio NOT NULL,
  concedido_por uuid,
  concedido_em timestamp with time zone NOT NULL DEFAULT now(),
  expira_em timestamp with time zone,
  observacao text,
  revogado_por uuid,
  revogado_em timestamp with time zone,
  motivo_revogacao text,
  CONSTRAINT vinculo_laboratorio_pkey PRIMARY KEY (id),
  CONSTRAINT vinculo_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.perfis(id) ON DELETE CASCADE,
  CONSTRAINT vinculo_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id) ON DELETE CASCADE,
  CONSTRAINT vinculo_concedido_por_fkey FOREIGN KEY (concedido_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
  CONSTRAINT vinculo_revogado_por_fkey FOREIGN KEY (revogado_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
  -- Chefia não expira: só termina por transferência ou ação do admin
  CONSTRAINT vinculo_chefe_sem_validade CHECK (papel <> 'chefe' OR expira_em IS NULL),
  CONSTRAINT vinculo_revogacao_coerente CHECK (revogado_em IS NULL OR revogado_em >= concedido_em),
  CONSTRAINT vinculo_observacao_check CHECK (observacao IS NULL OR char_length(observacao) <= 300),
  CONSTRAINT vinculo_motivo_check CHECK (motivo_revogacao IS NULL OR char_length(motivo_revogacao) <= 300)
);

-- No máximo um vínculo não revogado por usuário e laboratório,
-- e no máximo um chefe não revogado por laboratório.
CREATE UNIQUE INDEX vinculo_unico_aberto ON public.vinculo_laboratorio (id_usuario, id_laboratorio)
  WHERE revogado_em IS NULL;
CREATE UNIQUE INDEX vinculo_chefe_unico ON public.vinculo_laboratorio (id_laboratorio)
  WHERE papel = 'chefe' AND revogado_em IS NULL;
CREATE INDEX idx_vinculo_usuario ON public.vinculo_laboratorio (id_usuario);
CREATE INDEX idx_vinculo_laboratorio ON public.vinculo_laboratorio (id_laboratorio);

CREATE TABLE public.administrador (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL,
  concedido_por uuid,
  concedido_em timestamp with time zone NOT NULL DEFAULT now(),
  observacao text,
  revogado_por uuid,
  revogado_em timestamp with time zone,
  motivo_revogacao text,
  CONSTRAINT administrador_pkey PRIMARY KEY (id),
  CONSTRAINT administrador_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.perfis(id) ON DELETE CASCADE,
  CONSTRAINT administrador_concedido_por_fkey FOREIGN KEY (concedido_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
  CONSTRAINT administrador_revogado_por_fkey FOREIGN KEY (revogado_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
  CONSTRAINT administrador_revogacao_coerente CHECK (revogado_em IS NULL OR revogado_em >= concedido_em),
  CONSTRAINT administrador_motivo_check CHECK (motivo_revogacao IS NULL OR char_length(motivo_revogacao) <= 300)
);

CREATE UNIQUE INDEX administrador_unico_ativo ON public.administrador (id_usuario)
  WHERE revogado_em IS NULL;

-- Pedido de acesso a um laboratório. Estrutura preparada para uma
-- próxima etapa; ainda não há tela nem RPC que use esta tabela.
CREATE TABLE public.pedido_vinculo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL,
  id_laboratorio uuid NOT NULL,
  mensagem text,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  decidido_por uuid,
  decidido_em timestamp with time zone,
  CONSTRAINT pedido_vinculo_pkey PRIMARY KEY (id),
  CONSTRAINT pedido_vinculo_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.perfis(id) ON DELETE CASCADE,
  CONSTRAINT pedido_vinculo_id_laboratorio_fkey FOREIGN KEY (id_laboratorio) REFERENCES public.laboratorio(id) ON DELETE CASCADE,
  CONSTRAINT pedido_vinculo_decidido_por_fkey FOREIGN KEY (decidido_por) REFERENCES public.perfis(id) ON DELETE SET NULL,
  CONSTRAINT pedido_vinculo_status_check CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado')),
  CONSTRAINT pedido_vinculo_mensagem_check CHECK (mensagem IS NULL OR char_length(mensagem) <= 300)
);

CREATE UNIQUE INDEX pedido_vinculo_pendente_unico ON public.pedido_vinculo (id_usuario, id_laboratorio)
  WHERE status = 'pendente';

-- Cargo: dado informativo do perfil. NÃO define permissão.
ALTER TABLE public.perfis
  ADD COLUMN cargo text,
  ADD CONSTRAINT perfis_cargo_check CHECK (cargo IS NULL OR cargo IN ('Técnico', 'Docente', 'Discente'));

CREATE INDEX idx_perfis_email_lower ON public.perfis (lower(email));

-- ------------------------------------------------------------
-- 3. VERIFICAÇÃO CENTRAL DE PERMISSÕES
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vinculo_ativo(v public.vinculo_laboratorio)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT v.revogado_em IS NULL AND (v.expira_em IS NULL OR v.expira_em > now());
$$;

CREATE OR REPLACE FUNCTION public.eh_admin(p_usuario uuid DEFAULT public.usuario_atual())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.administrador a
    WHERE a.id_usuario = p_usuario AND a.revogado_em IS NULL
  );
$$;

-- Papel ativo do usuário no laboratório (NULL = sem vínculo ativo).
CREATE OR REPLACE FUNCTION public.papel_no_laboratorio(
  p_laboratorio uuid,
  p_usuario uuid DEFAULT public.usuario_atual()
)
RETURNS public.papel_laboratorio
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.papel
  FROM public.vinculo_laboratorio v
  WHERE v.id_usuario = p_usuario
    AND v.id_laboratorio = p_laboratorio
    AND v.revogado_em IS NULL
    AND (v.expira_em IS NULL OR v.expira_em > now())
  LIMIT 1;
$$;

-- Ações conhecidas pelo sistema. Novas features adicionam a ação
-- aqui e na matriz de tem_permissao().
CREATE OR REPLACE FUNCTION public.acoes_laboratorio()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'laboratorio.ver',
    'consumo.registrar',
    'residuo.registrar',
    'transferencia.solicitar',
    'transferencia.aprovar',
    'estoque.editar',
    'membros.gerenciar',
    'chefia.transferir'
  ];
$$;

-- ÚNICO lugar que decide se o usuário pode fazer uma ação num
-- laboratório. Qualquer valor desconhecido/NULL resulta em false.
--   laboratorio.ver         membro+ ou admin (admin só lê)
--   consumo.registrar       membro+
--   residuo.registrar       membro+
--   transferencia.solicitar membro+ (no laboratório que vai receber)
--   transferencia.aprovar   gestor+ (no laboratório de origem)
--   estoque.editar          gestor+
--   membros.gerenciar       gestor+ (gestor só mexe em membros; ver RPCs)
--   chefia.transferir       chefe
CREATE OR REPLACE FUNCTION public.tem_permissao(
  p_laboratorio uuid,
  p_acao text,
  p_usuario uuid DEFAULT public.usuario_atual()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_papel public.papel_laboratorio;
BEGIN
  IF p_usuario IS NULL OR p_laboratorio IS NULL OR p_acao IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (p_acao = ANY (public.acoes_laboratorio())) THEN
    RAISE EXCEPTION 'Ação de permissão desconhecida: %', p_acao;
  END IF;

  v_papel := public.papel_no_laboratorio(p_laboratorio, p_usuario);

  RETURN CASE p_acao
    WHEN 'laboratorio.ver' THEN v_papel IS NOT NULL OR public.eh_admin(p_usuario)
    WHEN 'consumo.registrar' THEN v_papel >= 'membro'
    WHEN 'residuo.registrar' THEN v_papel >= 'membro'
    WHEN 'transferencia.solicitar' THEN v_papel >= 'membro'
    WHEN 'transferencia.aprovar' THEN v_papel >= 'gestor'
    WHEN 'estoque.editar' THEN v_papel >= 'gestor'
    WHEN 'membros.gerenciar' THEN v_papel >= 'gestor'
    WHEN 'chefia.transferir' THEN v_papel = 'chefe'
  END IS TRUE;
END;
$$;

-- Permissões fora de um laboratório específico (catálogo global).
--   reagente.cadastrar  qualquer vínculo ativo, ou admin
--   reagente.editar     chefe de algum laboratório, ou admin
CREATE OR REPLACE FUNCTION public.tem_permissao_global(
  p_acao text,
  p_usuario uuid DEFAULT public.usuario_atual()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_usuario IS NULL OR p_acao IS NULL THEN
    RETURN false;
  END IF;

  IF public.eh_admin(p_usuario) THEN
    RETURN p_acao IN ('reagente.cadastrar', 'reagente.editar');
  END IF;

  RETURN CASE p_acao
    WHEN 'reagente.cadastrar' THEN EXISTS (
      SELECT 1 FROM public.vinculo_laboratorio v
      WHERE v.id_usuario = p_usuario AND public.vinculo_ativo(v)
    )
    WHEN 'reagente.editar' THEN EXISTS (
      SELECT 1 FROM public.vinculo_laboratorio v
      WHERE v.id_usuario = p_usuario AND v.papel = 'chefe' AND public.vinculo_ativo(v)
    )
    ELSE NULL
  END IS TRUE;
END;
$$;

-- Dois usuários compartilham algum laboratório com vínculo ativo?
-- Usado para decidir quem vê o perfil de quem.
CREATE OR REPLACE FUNCTION public.compartilha_laboratorio(
  p_outro uuid,
  p_usuario uuid DEFAULT public.usuario_atual()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_usuario IS NOT NULL AND p_outro IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.vinculo_laboratorio a
    JOIN public.vinculo_laboratorio b ON b.id_laboratorio = a.id_laboratorio
    WHERE a.id_usuario = p_usuario AND public.vinculo_ativo(a)
      AND b.id_usuario = p_outro AND public.vinculo_ativo(b)
  );
$$;

-- Vínculos ativos do usuário logado, com as ações permitidas em cada
-- laboratório. O front usa isto só para montar a tela; quem garante a
-- regra é a RLS/RPC (mesma função tem_permissao).
CREATE OR REPLACE FUNCTION public.minhas_permissoes()
RETURNS TABLE (
  id_laboratorio uuid,
  nome_laboratorio text,
  papel public.papel_laboratorio,
  expira_em timestamp with time zone,
  acoes text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.nome_laboratorio,
    v.papel,
    v.expira_em,
    ARRAY(
      SELECT a FROM unnest(public.acoes_laboratorio()) a
      WHERE public.tem_permissao(l.id, a)
    )
  FROM public.vinculo_laboratorio v
  JOIN public.laboratorio l ON l.id = v.id_laboratorio
  WHERE v.id_usuario = public.usuario_atual() AND public.vinculo_ativo(v)
  ORDER BY l.nome_laboratorio;
$$;

-- Compatibilidade com o front atual (será removida junto com
-- perfis.id_laboratorio / perfis.is_admin).
CREATE OR REPLACE FUNCTION public.am_i_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.eh_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_my_lab_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id_laboratorio
  FROM public.vinculo_laboratorio v
  LEFT JOIN public.perfis p ON p.id = v.id_usuario
  WHERE v.id_usuario = public.usuario_atual() AND public.vinculo_ativo(v)
  ORDER BY (v.id_laboratorio = p.id_laboratorio) DESC NULLS LAST, v.concedido_em
  LIMIT 1;
$$;

-- ------------------------------------------------------------
-- 4. RPCs DE DELEGAÇÃO (único caminho de escrita nas tabelas acima)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_usuario_por_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT p.id INTO v_id FROM public.perfis p
  WHERE lower(p.email) = lower(btrim(p_email))
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com o e-mail %. A pessoa precisa criar a conta primeiro.', btrim(p_email);
  END IF;

  RETURN v_id;
END;
$$;

-- Fecha um vínculo não revogado que já venceu, para liberar o índice
-- de "um vínculo aberto por usuário e laboratório".
CREATE OR REPLACE FUNCTION public.fechar_vinculo_vencido(p_usuario uuid, p_laboratorio uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.vinculo_laboratorio
  SET revogado_em = greatest(expira_em, concedido_em),
      motivo_revogacao = 'Vínculo expirado'
  WHERE id_usuario = p_usuario
    AND id_laboratorio = p_laboratorio
    AND revogado_em IS NULL
    AND expira_em IS NOT NULL
    AND expira_em <= now();
$$;

-- Concede (ou altera) o papel de alguém no laboratório.
--   chefe  concede gestor ou membro
--   gestor concede só membro, e não altera quem já é gestor ou chefe
--   ninguém concede chefe por aqui (definir_chefe / transferir_chefia)
CREATE OR REPLACE FUNCTION public.conceder_vinculo(
  p_laboratorio uuid,
  p_email text,
  p_papel public.papel_laboratorio,
  p_expira_em timestamp with time zone DEFAULT NULL
)
RETURNS public.vinculo_laboratorio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_meu_papel public.papel_laboratorio;
  v_alvo uuid;
  v_atual public.vinculo_laboratorio%ROWTYPE;
  v_novo public.vinculo_laboratorio%ROWTYPE;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.';
  END IF;

  IF p_papel IS NULL OR p_papel = 'chefe' THEN
    RAISE EXCEPTION 'A chefia só é definida pelo admin ou transferida pelo chefe atual.';
  END IF;

  v_meu_papel := public.papel_no_laboratorio(p_laboratorio, v_eu);

  IF v_meu_papel IS NULL OR v_meu_papel < 'gestor' THEN
    RAISE EXCEPTION 'Sem permissão para conceder papéis neste laboratório.';
  END IF;

  IF p_papel >= v_meu_papel THEN
    RAISE EXCEPTION 'Você não pode conceder um papel igual ou acima do seu.';
  END IF;

  IF p_expira_em IS NOT NULL AND p_expira_em <= now() THEN
    RAISE EXCEPTION 'A data de validade precisa estar no futuro.';
  END IF;

  v_alvo := public.buscar_usuario_por_email(p_email);

  IF v_alvo = v_eu THEN
    RAISE EXCEPTION 'Você não pode alterar o próprio vínculo.';
  END IF;

  PERFORM public.fechar_vinculo_vencido(v_alvo, p_laboratorio);

  SELECT * INTO v_atual FROM public.vinculo_laboratorio
  WHERE id_usuario = v_alvo AND id_laboratorio = p_laboratorio AND revogado_em IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_atual.papel >= v_meu_papel THEN
      RAISE EXCEPTION 'Você não pode alterar o vínculo de quem tem papel igual ou acima do seu.';
    END IF;

    UPDATE public.vinculo_laboratorio
    SET revogado_em = now(), revogado_por = v_eu, motivo_revogacao = 'Papel alterado'
    WHERE id = v_atual.id;
  END IF;

  INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, concedido_por, expira_em)
  VALUES (v_alvo, p_laboratorio, p_papel, v_eu, p_expira_em)
  RETURNING * INTO v_novo;

  RETURN v_novo;
END;
$$;

-- Revoga um vínculo, mantendo o registro.
--   admin  revoga chefes
--   chefe  revoga gestores e membros do seu laboratório
--   gestor revoga só membros
CREATE OR REPLACE FUNCTION public.revogar_vinculo(p_vinculo uuid, p_motivo text DEFAULT NULL)
RETURNS public.vinculo_laboratorio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_alvo public.vinculo_laboratorio%ROWTYPE;
  v_meu_papel public.papel_laboratorio;
  v_pode boolean;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.';
  END IF;

  SELECT * INTO v_alvo FROM public.vinculo_laboratorio WHERE id = p_vinculo FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo não encontrado.';
  END IF;

  IF v_alvo.revogado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Este vínculo já foi revogado.';
  END IF;

  IF v_alvo.id_usuario = v_eu THEN
    RAISE EXCEPTION 'Você não pode revogar o próprio vínculo.';
  END IF;

  IF v_alvo.papel = 'chefe' THEN
    v_pode := public.eh_admin(v_eu);
  ELSE
    v_meu_papel := public.papel_no_laboratorio(v_alvo.id_laboratorio, v_eu);
    v_pode := v_meu_papel IS NOT NULL AND v_meu_papel >= 'gestor' AND v_alvo.papel < v_meu_papel;
  END IF;

  IF NOT v_pode THEN
    RAISE EXCEPTION 'Sem permissão para revogar este vínculo.';
  END IF;

  UPDATE public.vinculo_laboratorio
  SET revogado_em = now(), revogado_por = v_eu, motivo_revogacao = NULLIF(btrim(p_motivo), '')
  WHERE id = p_vinculo
  RETURNING * INTO v_alvo;

  RETURN v_alvo;
END;
$$;

-- O chefe passa a chefia para alguém com vínculo ativo no laboratório.
-- O chefe antigo vira gestor.
CREATE OR REPLACE FUNCTION public.transferir_chefia(p_laboratorio uuid, p_novo_chefe uuid)
RETURNS public.vinculo_laboratorio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_meu public.vinculo_laboratorio%ROWTYPE;
  v_dele public.vinculo_laboratorio%ROWTYPE;
  v_novo public.vinculo_laboratorio%ROWTYPE;
BEGIN
  IF NOT public.tem_permissao(p_laboratorio, 'chefia.transferir', v_eu) THEN
    RAISE EXCEPTION 'Só o chefe do laboratório pode transferir a chefia.';
  END IF;

  IF p_novo_chefe IS NULL OR p_novo_chefe = v_eu THEN
    RAISE EXCEPTION 'Escolha outra pessoa para assumir a chefia.';
  END IF;

  SELECT * INTO v_dele FROM public.vinculo_laboratorio
  WHERE id_usuario = p_novo_chefe AND id_laboratorio = p_laboratorio AND public.vinculo_ativo(vinculo_laboratorio)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O novo chefe precisa ter vínculo ativo neste laboratório.';
  END IF;

  SELECT * INTO v_meu FROM public.vinculo_laboratorio
  WHERE id_usuario = v_eu AND id_laboratorio = p_laboratorio AND papel = 'chefe' AND revogado_em IS NULL
  FOR UPDATE;

  UPDATE public.vinculo_laboratorio
  SET revogado_em = now(), revogado_por = v_eu, motivo_revogacao = 'Chefia transferida'
  WHERE id IN (v_meu.id, v_dele.id);

  INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, concedido_por, observacao)
  VALUES (v_eu, p_laboratorio, 'gestor', v_eu, 'Ex-chefe, após transferir a chefia');

  INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, concedido_por, observacao)
  VALUES (p_novo_chefe, p_laboratorio, 'chefe', v_eu, 'Chefia recebida por transferência')
  RETURNING * INTO v_novo;

  RETURN v_novo;
END;
$$;

-- Admin define (ou troca) o chefe de um laboratório. O chefe anterior,
-- se houver, perde a chefia e fica sem vínculo nesse laboratório.
CREATE OR REPLACE FUNCTION public.definir_chefe(
  p_laboratorio uuid,
  p_email text,
  p_motivo text DEFAULT NULL
)
RETURNS public.vinculo_laboratorio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_alvo uuid;
  v_novo public.vinculo_laboratorio%ROWTYPE;
BEGIN
  IF NOT public.eh_admin(v_eu) THEN
    RAISE EXCEPTION 'Só um admin pode definir o chefe de um laboratório.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.laboratorio WHERE id = p_laboratorio) THEN
    RAISE EXCEPTION 'Laboratório não encontrado.';
  END IF;

  v_alvo := public.buscar_usuario_por_email(p_email);

  -- Chefe atual sai (se for outra pessoa)
  UPDATE public.vinculo_laboratorio
  SET revogado_em = now(), revogado_por = v_eu,
      motivo_revogacao = coalesce(NULLIF(btrim(p_motivo), ''), 'Chefia redefinida pelo admin')
  WHERE id_laboratorio = p_laboratorio AND papel = 'chefe' AND revogado_em IS NULL
    AND id_usuario <> v_alvo;

  -- Vínculo atual do novo chefe (se houver) é substituído
  PERFORM public.fechar_vinculo_vencido(v_alvo, p_laboratorio);

  IF EXISTS (
    SELECT 1 FROM public.vinculo_laboratorio
    WHERE id_usuario = v_alvo AND id_laboratorio = p_laboratorio AND papel = 'chefe' AND revogado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta pessoa já é chefe deste laboratório.';
  END IF;

  UPDATE public.vinculo_laboratorio
  SET revogado_em = now(), revogado_por = v_eu, motivo_revogacao = 'Promovido a chefe pelo admin'
  WHERE id_usuario = v_alvo AND id_laboratorio = p_laboratorio AND revogado_em IS NULL;

  INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, concedido_por, observacao)
  VALUES (v_alvo, p_laboratorio, 'chefe', v_eu, 'Chefia definida pelo admin')
  RETURNING * INTO v_novo;

  RETURN v_novo;
END;
$$;

CREATE OR REPLACE FUNCTION public.conceder_admin(p_email text)
RETURNS public.administrador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_alvo uuid;
  v_novo public.administrador%ROWTYPE;
BEGIN
  IF NOT public.eh_admin(v_eu) THEN
    RAISE EXCEPTION 'Só um admin pode cadastrar outros admins.';
  END IF;

  v_alvo := public.buscar_usuario_por_email(p_email);

  IF public.eh_admin(v_alvo) THEN
    RAISE EXCEPTION 'Esta pessoa já é admin.';
  END IF;

  INSERT INTO public.administrador (id_usuario, concedido_por)
  VALUES (v_alvo, v_eu)
  RETURNING * INTO v_novo;

  RETURN v_novo;
END;
$$;

CREATE OR REPLACE FUNCTION public.revogar_admin(p_usuario uuid, p_motivo text DEFAULT NULL)
RETURNS public.administrador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
  v_alvo public.administrador%ROWTYPE;
BEGIN
  IF NOT public.eh_admin(v_eu) THEN
    RAISE EXCEPTION 'Só um admin pode revogar admins.';
  END IF;

  -- Trava a tabela de admins ativos para a contagem abaixo ser confiável
  PERFORM 1 FROM public.administrador WHERE revogado_em IS NULL FOR UPDATE;

  SELECT * INTO v_alvo FROM public.administrador
  WHERE id_usuario = p_usuario AND revogado_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta pessoa não é admin.';
  END IF;

  IF (SELECT count(*) FROM public.administrador WHERE revogado_em IS NULL) <= 1 THEN
    RAISE EXCEPTION 'Não é possível revogar o último admin do sistema.';
  END IF;

  UPDATE public.administrador
  SET revogado_em = now(), revogado_por = v_eu, motivo_revogacao = NULLIF(btrim(p_motivo), '')
  WHERE id = v_alvo.id
  RETURNING * INTO v_alvo;

  RETURN v_alvo;
END;
$$;

-- Cria o PRIMEIRO admin. Só funciona se não houver nenhum admin ativo
-- e só pode ser chamada com a service_role (script npm run criar-admin)
-- ou por quem tem acesso direto ao banco (SQL Editor / psql).
CREATE OR REPLACE FUNCTION public.criar_primeiro_admin(p_email text)
RETURNS public.administrador
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alvo uuid;
  v_novo public.administrador%ROWTYPE;
BEGIN
  LOCK TABLE public.administrador IN EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.administrador WHERE revogado_em IS NULL) THEN
    RAISE EXCEPTION 'Já existe admin cadastrado. Novos admins são concedidos pela interface.';
  END IF;

  v_alvo := public.buscar_usuario_por_email(p_email);

  INSERT INTO public.administrador (id_usuario, observacao)
  VALUES (v_alvo, 'Primeiro admin, criado na instalação')
  RETURNING * INTO v_novo;

  RETURN v_novo;
END;
$$;

-- Cargo do perfil: editável pelo próprio usuário e pelo admin.
CREATE OR REPLACE FUNCTION public.definir_cargo(p_usuario uuid, p_cargo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu uuid := public.usuario_atual();
BEGIN
  IF v_eu IS NULL OR NOT (p_usuario = v_eu OR public.eh_admin(v_eu)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o cargo deste usuário.';
  END IF;

  UPDATE public.perfis SET cargo = NULLIF(btrim(p_cargo), '') WHERE id = p_usuario;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 5. MIGRAÇÃO DOS DADOS EXISTENTES
-- ------------------------------------------------------------
-- perfis.id_laboratorio vira vínculo de membro; perfis.is_admin vira
-- linha em administrador. Idempotente: não duplica quem já migrou.
-- Laboratórios ficam sem chefe até o admin definir.
CREATE OR REPLACE FUNCTION public.migrar_permissoes_legadas()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, observacao)
  SELECT p.id, p.id_laboratorio, 'membro', 'Migrado do modelo antigo (perfis.id_laboratorio)'
  FROM public.perfis p
  WHERE p.id_laboratorio IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.vinculo_laboratorio v
      WHERE v.id_usuario = p.id AND v.id_laboratorio = p.id_laboratorio
    );

  INSERT INTO public.administrador (id_usuario, observacao)
  SELECT p.id, 'Migrado do modelo antigo (perfis.is_admin)'
  FROM public.perfis p
  WHERE p.is_admin IS TRUE
    AND NOT EXISTS (SELECT 1 FROM public.administrador a WHERE a.id_usuario = p.id);
$$;

SELECT public.migrar_permissoes_legadas();

-- ------------------------------------------------------------
-- 6. ACESSO ÀS NOVAS TABELAS E FUNÇÕES
-- ------------------------------------------------------------
ALTER TABLE public.vinculo_laboratorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_vinculo ENABLE ROW LEVEL SECURITY;

-- Escrita só pelas RPCs (SECURITY DEFINER); leitura via políticas.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.vinculo_laboratorio, public.administrador, public.pedido_vinculo
  FROM anon, authenticated;

CREATE POLICY "Ver vinculos" ON public.vinculo_laboratorio
  FOR SELECT TO authenticated
  USING (id_usuario = public.usuario_atual() OR public.tem_permissao(id_laboratorio, 'laboratorio.ver'));

CREATE POLICY "Ver admins" ON public.administrador
  FOR SELECT TO authenticated
  USING (id_usuario = public.usuario_atual() OR public.eh_admin());

CREATE POLICY "Ver pedidos de vinculo" ON public.pedido_vinculo
  FOR SELECT TO authenticated
  USING (id_usuario = public.usuario_atual() OR public.tem_permissao(id_laboratorio, 'membros.gerenciar') OR public.eh_admin());

-- Funções nascem executáveis por PUBLIC: fechar e liberar só o necessário.
REVOKE EXECUTE ON FUNCTION
  public.vinculo_ativo(public.vinculo_laboratorio),
  public.eh_admin(uuid),
  public.papel_no_laboratorio(uuid, uuid),
  public.tem_permissao(uuid, text, uuid),
  public.tem_permissao_global(text, uuid),
  public.compartilha_laboratorio(uuid, uuid),
  public.minhas_permissoes(),
  public.buscar_usuario_por_email(text),
  public.fechar_vinculo_vencido(uuid, uuid),
  public.conceder_vinculo(uuid, text, public.papel_laboratorio, timestamp with time zone),
  public.revogar_vinculo(uuid, text),
  public.transferir_chefia(uuid, uuid),
  public.definir_chefe(uuid, text, text),
  public.conceder_admin(text),
  public.revogar_admin(uuid, text),
  public.criar_primeiro_admin(text),
  public.definir_cargo(uuid, text),
  public.migrar_permissoes_legadas(),
  public.am_i_admin(),
  public.get_my_lab_id()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.vinculo_ativo(public.vinculo_laboratorio),
  public.eh_admin(uuid),
  public.papel_no_laboratorio(uuid, uuid),
  public.tem_permissao(uuid, text, uuid),
  public.tem_permissao_global(text, uuid),
  public.compartilha_laboratorio(uuid, uuid),
  public.minhas_permissoes(),
  public.conceder_vinculo(uuid, text, public.papel_laboratorio, timestamp with time zone),
  public.revogar_vinculo(uuid, text),
  public.transferir_chefia(uuid, uuid),
  public.definir_chefe(uuid, text, text),
  public.conceder_admin(text),
  public.revogar_admin(uuid, text),
  public.definir_cargo(uuid, text),
  public.am_i_admin(),
  public.get_my_lab_id()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.criar_primeiro_admin(text) TO service_role;
