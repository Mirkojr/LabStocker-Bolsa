-- Listagem da equipe (ativos + histórico) com nomes.
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- Chefe revoga o membro: ele sai da equipe, mas o nome continua no histórico
SELECT tests.logar('c0000000-0000-0000-0000-000000000001');
SELECT revogar_vinculo(
  (SELECT id FROM vinculo_laboratorio WHERE id_usuario = 'e0000000-0000-0000-0000-000000000001' AND revogado_em IS NULL),
  'Saiu');
SELECT is(
  (SELECT nome FROM vinculos_do_laboratorio('10000000-0000-0000-0000-000000000001')
   WHERE id_usuario = 'e0000000-0000-0000-0000-000000000001'),
  'membro', 'ex-integrante aparece com nome no histórico');
SELECT is(
  (SELECT revogado_por_nome FROM vinculos_do_laboratorio('10000000-0000-0000-0000-000000000001')
   WHERE id_usuario = 'e0000000-0000-0000-0000-000000000001'),
  'chefe Usuário', 'mostra quem revogou');
SELECT is((SELECT count(*)::int FROM perfis WHERE id = 'e0000000-0000-0000-0000-000000000001'), 0,
  'a tabela perfis continua sem mostrar ex-integrantes');
RESET ROLE;

-- Quem não vê o laboratório não recebe nada
SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe de L2
SELECT is((SELECT count(*)::int FROM vinculos_do_laboratorio('10000000-0000-0000-0000-000000000001')), 0,
  'chefe de outro laboratório não vê a equipe de L1');
RESET ROLE;

SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- o próprio ex-membro
SELECT is((SELECT count(*)::int FROM vinculos_do_laboratorio('10000000-0000-0000-0000-000000000001')), 0,
  'ex-membro não vê mais a equipe');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT ok((SELECT count(*) FROM vinculos_do_laboratorio('10000000-0000-0000-0000-000000000001')) >= 5,
  'admin vê a equipe de qualquer laboratório');
RESET ROLE;

SELECT tests.anonimo();
SELECT throws_ok($$SELECT * FROM vinculos_do_laboratorio('10000000-0000-0000-0000-000000000001')$$,
  '42501', NULL, 'visitante sem login não chama a função');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
