-- Migração dos dados do modelo antigo (perfis.id_laboratorio / is_admin).
BEGIN;
SELECT no_plan();

INSERT INTO public.laboratorio (id, nome_laboratorio, codigo_sipac) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Lab 1', 'SIPAC-1');

SELECT tests.criar_usuario('e0000000-0000-0000-0000-000000000001', 'antigo@ufc.br');
SELECT tests.criar_usuario('a0000000-0000-0000-0000-000000000001', 'antigoadmin@ufc.br');
SELECT tests.criar_usuario('f0000000-0000-0000-0000-000000000001', 'semlab@ufc.br');

UPDATE perfis SET id_laboratorio = '10000000-0000-0000-0000-000000000001'
WHERE id = 'e0000000-0000-0000-0000-000000000001';
UPDATE perfis SET is_admin = true
WHERE id = 'a0000000-0000-0000-0000-000000000001';

SELECT lives_ok($$SELECT migrar_permissoes_legadas()$$, 'migração roda');

SELECT is(
  papel_no_laboratorio('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001')::text,
  'membro', 'quem tinha laboratório vira membro dele');
SELECT is(eh_admin('a0000000-0000-0000-0000-000000000001'), true, 'is_admin vira admin');
SELECT is((SELECT count(*)::int FROM vinculo_laboratorio WHERE id_usuario = 'f0000000-0000-0000-0000-000000000001'), 0,
  'quem não tinha laboratório continua sem vínculo');
SELECT is((SELECT count(*)::int FROM vinculo_laboratorio WHERE papel = 'chefe'), 0,
  'laboratórios ficam sem chefe até o admin definir');
SELECT is((SELECT concedido_por FROM vinculo_laboratorio WHERE id_usuario = 'e0000000-0000-0000-0000-000000000001'), NULL,
  'vínculo migrado não tem concedente');

SELECT lives_ok($$SELECT migrar_permissoes_legadas()$$, 'rodar de novo não dá erro');
SELECT is((SELECT count(*)::int FROM vinculo_laboratorio), 1, 'rodar de novo não duplica vínculos');
SELECT is((SELECT count(*)::int FROM administrador), 1, 'rodar de novo não duplica admins');

-- Novo cadastro NÃO ganha acesso por escolher o laboratório no cadastro
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
  'f0000000-0000-0000-0000-000000000009', 'intruso@ufc.br',
  '{"nome":"X","id_laboratorio":"10000000-0000-0000-0000-000000000001"}');
SELECT is(
  tem_permissao('10000000-0000-0000-0000-000000000001', 'laboratorio.ver', 'f0000000-0000-0000-0000-000000000009'),
  false, 'escolher o laboratório no cadastro não dá acesso a ele');

SELECT * FROM finish();
ROLLBACK;
