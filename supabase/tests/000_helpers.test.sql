-- Funções de apoio dos testes (schema "tests"). Este arquivo roda
-- primeiro e NÃO desfaz o que cria: os outros arquivos usam estas
-- funções dentro das próprias transações (que terminam em ROLLBACK).
-- Só existe no banco local de testes (supabase test db).

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;

-- Age como o usuário informado (papel "authenticated" do Supabase).
CREATE OR REPLACE FUNCTION tests.logar(p_usuario uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_usuario,
      'role', 'authenticated',
      'email', (SELECT email FROM auth.users WHERE id = p_usuario)
    )::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- Age como visitante sem login.
CREATE OR REPLACE FUNCTION tests.anonimo()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

CREATE OR REPLACE FUNCTION tests.criar_usuario(p_id uuid, p_email text)
RETURNS uuid
LANGUAGE sql
AS $$
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (p_id, p_email, json_build_object('nome', split_part(p_email, '@', 1))::jsonb)
  RETURNING id;
$$;

-- Cenário padrão usado pelos testes:
--   L1: chefe, gestor, membro, expirado (vencido) e revogado
--   L2: chefe2
--   admin (sem vínculo), fora e novo (sem vínculo)
--   um item de estoque em cada laboratório
CREATE OR REPLACE FUNCTION tests.cenario()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.laboratorio (id, nome_laboratorio, codigo_sipac) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Lab 1', 'SIPAC-1'),
    ('10000000-0000-0000-0000-000000000002', 'Lab 2', 'SIPAC-2');

  PERFORM tests.criar_usuario('a0000000-0000-0000-0000-000000000001', 'admin@ufc.br');
  PERFORM tests.criar_usuario('c0000000-0000-0000-0000-000000000001', 'chefe@ufc.br');
  PERFORM tests.criar_usuario('c0000000-0000-0000-0000-000000000002', 'chefe2@ufc.br');
  PERFORM tests.criar_usuario('d0000000-0000-0000-0000-000000000001', 'gestor@ufc.br');
  PERFORM tests.criar_usuario('e0000000-0000-0000-0000-000000000001', 'membro@ufc.br');
  PERFORM tests.criar_usuario('e0000000-0000-0000-0000-000000000002', 'expirado@ufc.br');
  PERFORM tests.criar_usuario('e0000000-0000-0000-0000-000000000003', 'revogado@ufc.br');
  PERFORM tests.criar_usuario('f0000000-0000-0000-0000-000000000001', 'fora@ufc.br');
  PERFORM tests.criar_usuario('f0000000-0000-0000-0000-000000000002', 'novo@ufc.br');

  INSERT INTO public.administrador (id_usuario, observacao)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'teste');

  INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, concedido_em, expira_em, revogado_em) VALUES
    ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'chefe', now() - interval '30 days', NULL, NULL),
    ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'chefe', now() - interval '30 days', NULL, NULL),
    ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'gestor', now() - interval '30 days', NULL, NULL),
    ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'membro', now() - interval '30 days', NULL, NULL),
    ('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'membro', now() - interval '30 days', now() - interval '1 day', NULL),
    ('e0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'membro', now() - interval '30 days', NULL, now() - interval '1 day');

  -- Os testes partem de um catálogo conhecido, sem a carga inicial de
  -- reagentes (as transações dos testes terminam em ROLLBACK).
  DELETE FROM public.reagente;
  INSERT INTO public.reagente (id, nome) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Acetona');

  INSERT INTO public.estoquelab (id, id_laboratorio, id_reagente, quantidade, unidade_medida) VALUES
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 10, 'L'),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 10, 'L');
END;
$$;

BEGIN;
SELECT plan(1);
SELECT has_function('tests', 'cenario', 'funções de apoio dos testes instaladas');
SELECT * FROM finish();
ROLLBACK;
