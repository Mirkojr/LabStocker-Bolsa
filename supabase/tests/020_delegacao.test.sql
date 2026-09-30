-- Regras de delegação: conceder, revogar, transferir chefia, definir chefe.
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- Ativo = não revogado e dentro da validade
CREATE TEMP VIEW papel_atual AS
SELECT p.email, v.id_laboratorio, v.papel::text AS papel
FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
WHERE vinculo_ativo(v);
GRANT SELECT ON papel_atual TO authenticated;

-- ============================================================
-- CONCEDER
-- ============================================================
SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- chefe L1

SELECT lives_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'novo@ufc.br', 'membro')$$,
  'chefe concede membro');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'fora@ufc.br', 'chefe')$$,
  'P0001', 'A chefia só é definida pelo admin ou transferida pelo chefe atual.',
  'ninguém concede chefe por conceder_vinculo');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000002', 'fora@ufc.br', 'membro')$$,
  'P0001', 'Sem permissão para conceder papéis neste laboratório.',
  'chefe de L1 não concede em L2');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'chefe@ufc.br', 'membro')$$,
  'P0001', 'Você não pode alterar o próprio vínculo.',
  'ninguém altera o próprio vínculo');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'naoexiste@ufc.br', 'membro')$$,
  'P0001', NULL,
  'e-mail sem conta gera erro');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'fora@ufc.br', 'membro', now() - interval '1 hour')$$,
  'P0001', 'A data de validade precisa estar no futuro.',
  'validade no passado é recusada');

-- Promover membro a gestor: o vínculo antigo é revogado, não apagado
SELECT lives_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'novo@ufc.br', 'gestor')$$,
  'chefe promove membro a gestor');
SELECT is(
  (SELECT count(*)::int FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario WHERE p.email = 'novo@ufc.br'),
  2, 'a troca de papel mantém o vínculo antigo no histórico');
SELECT is(
  (SELECT motivo_revogacao FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
   WHERE p.email = 'novo@ufc.br' AND v.papel = 'membro'),
  'Papel alterado', 'o vínculo antigo registra o motivo');
SELECT is(
  (SELECT revogado_por FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
   WHERE p.email = 'novo@ufc.br' AND v.papel = 'membro'),
  'c0000000-0000-0000-0000-000000000001'::uuid, 'o vínculo antigo registra quem revogou');
SELECT is(
  (SELECT concedido_por FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
   WHERE p.email = 'novo@ufc.br' AND v.revogado_em IS NULL),
  'c0000000-0000-0000-0000-000000000001'::uuid, 'o vínculo novo registra quem concedeu');

-- Reativar quem tinha vínculo vencido
SELECT lives_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'expirado@ufc.br', 'membro', now() + interval '30 days')$$,
  'chefe renova vínculo vencido');
SELECT is(
  (SELECT motivo_revogacao FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
   WHERE p.email = 'expirado@ufc.br' AND v.revogado_em IS NOT NULL),
  'Vínculo expirado', 'o vínculo vencido é fechado como expirado, sem apagar');
RESET ROLE;

-- Gestor
SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor L1
SELECT lives_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'fora@ufc.br', 'membro')$$,
  'gestor concede membro');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'chefe2@ufc.br', 'gestor')$$,
  'P0001', 'Você não pode conceder um papel igual ou acima do seu.',
  'gestor não concede gestor');
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'novo@ufc.br', 'membro')$$,
  'P0001', 'Você não pode alterar o vínculo de quem tem papel igual ou acima do seu.',
  'gestor não rebaixa outro gestor');
RESET ROLE;

-- Membro, admin, sem vínculo
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'chefe2@ufc.br', 'membro')$$,
  'P0001', 'Sem permissão para conceder papéis neste laboratório.',
  'membro não concede nada');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'chefe2@ufc.br', 'membro')$$,
  'P0001', 'Sem permissão para conceder papéis neste laboratório.',
  'admin não concede membro/gestor (só define chefe)');
RESET ROLE;

SELECT tests.logar('e0000000-0000-0000-0000-000000000003'); -- revogado
SELECT throws_ok(
  $$SELECT conceder_vinculo('10000000-0000-0000-0000-000000000001', 'chefe2@ufc.br', 'membro')$$,
  'P0001', 'Sem permissão para conceder papéis neste laboratório.',
  'vínculo revogado não concede nada');
RESET ROLE;

-- Ninguém escreve direto na tabela
SELECT tests.logar('c0000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$INSERT INTO vinculo_laboratorio (id_usuario, id_laboratorio, papel)
    VALUES ('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'chefe')$$,
  '42501', NULL, 'INSERT direto em vinculo_laboratorio é bloqueado');
SELECT throws_ok(
  $$UPDATE vinculo_laboratorio SET papel = 'chefe'$$,
  '42501', NULL, 'UPDATE direto em vinculo_laboratorio é bloqueado');
SELECT throws_ok(
  $$DELETE FROM vinculo_laboratorio$$,
  '42501', NULL, 'DELETE direto em vinculo_laboratorio é bloqueado');
RESET ROLE;

-- ============================================================
-- REVOGAR
-- ============================================================
CREATE TEMP TABLE vid AS
SELECT p.email, v.id FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
WHERE v.revogado_em IS NULL AND v.id_laboratorio = '10000000-0000-0000-0000-000000000001';
GRANT SELECT ON vid TO authenticated;

SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor
SELECT throws_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'novo@ufc.br')),
  'P0001', 'Sem permissão para revogar este vínculo.', 'gestor não revoga gestor');
SELECT throws_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'chefe@ufc.br')),
  'P0001', 'Sem permissão para revogar este vínculo.', 'gestor não revoga o chefe');
SELECT lives_ok(
  format('SELECT revogar_vinculo(%L, %L)', (SELECT id FROM vid WHERE email = 'fora@ufc.br'), 'Saiu do projeto'),
  'gestor revoga membro');
RESET ROLE;

SELECT is(
  (SELECT row(revogado_por, motivo_revogacao)::text FROM vinculo_laboratorio WHERE id = (SELECT id FROM vid WHERE email = 'fora@ufc.br')),
  row('d0000000-0000-0000-0000-000000000001'::uuid, 'Saiu do projeto')::text,
  'revogação registra quem e por quê, e o registro continua na tabela');
SELECT is((SELECT count(*)::int FROM papel_atual WHERE email = 'fora@ufc.br'), 0,
  'vínculo revogado deixa de estar ativo');

SELECT tests.logar('d0000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'fora@ufc.br')),
  'P0001', 'Este vínculo já foi revogado.', 'não revoga duas vezes');
SELECT throws_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'gestor@ufc.br')),
  'P0001', 'Você não pode revogar o próprio vínculo.', 'não revoga o próprio vínculo');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe de L2
SELECT throws_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'membro@ufc.br')),
  'P0001', 'Sem permissão para revogar este vínculo.', 'chefe de outro laboratório não revoga');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT throws_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'membro@ufc.br')),
  'P0001', 'Sem permissão para revogar este vínculo.', 'admin não revoga membro');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- chefe L1
SELECT lives_ok(
  format('SELECT revogar_vinculo(%L)', (SELECT id FROM vid WHERE email = 'novo@ufc.br')),
  'chefe revoga gestor');
RESET ROLE;

-- ============================================================
-- TRANSFERIR CHEFIA
-- ============================================================
SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor
SELECT throws_ok(
  $$SELECT transferir_chefia('10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Só o chefe do laboratório pode transferir a chefia.', 'gestor não transfere chefia');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- chefe L1
SELECT throws_ok(
  $$SELECT transferir_chefia('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  'P0001', 'O novo chefe precisa ter vínculo ativo neste laboratório.', 'novo chefe precisa ter vínculo no laboratório');
SELECT throws_ok(
  $$SELECT transferir_chefia('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003')$$,
  'P0001', 'O novo chefe precisa ter vínculo ativo neste laboratório.', 'vínculo revogado não recebe chefia');
SELECT lives_ok(
  $$SELECT transferir_chefia('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001')$$,
  'chefe transfere a chefia para um membro');
RESET ROLE;

SELECT is((SELECT papel FROM papel_atual WHERE email = 'membro@ufc.br' AND id_laboratorio = '10000000-0000-0000-0000-000000000001'),
  'chefe', 'o novo chefe assume');
SELECT is((SELECT papel FROM papel_atual WHERE email = 'chefe@ufc.br' AND id_laboratorio = '10000000-0000-0000-0000-000000000001'),
  'gestor', 'o chefe antigo vira gestor');
SELECT is((SELECT count(*)::int FROM papel_atual WHERE papel = 'chefe' AND id_laboratorio = '10000000-0000-0000-0000-000000000001'),
  1, 'continua existindo um único chefe');
SELECT is(
  (SELECT count(*)::int FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario
   WHERE p.email IN ('chefe@ufc.br', 'membro@ufc.br') AND v.motivo_revogacao = 'Chefia transferida'),
  2, 'os vínculos anteriores ficam no histórico como "Chefia transferida"');

-- O novo chefe pode revogar o ex-chefe (agora gestor)
SELECT tests.logar('e0000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  format('SELECT revogar_vinculo(%L)', (
    SELECT v.id FROM vinculo_laboratorio v
    WHERE v.id_usuario = 'c0000000-0000-0000-0000-000000000001' AND v.revogado_em IS NULL)),
  'novo chefe revoga o ex-chefe');
RESET ROLE;

-- ============================================================
-- DEFINIR CHEFE (admin)
-- ============================================================
SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe de L2
SELECT throws_ok(
  $$SELECT definir_chefe('10000000-0000-0000-0000-000000000002', 'fora@ufc.br')$$,
  'P0001', 'Só um admin pode definir o chefe de um laboratório.', 'chefe não usa definir_chefe');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT lives_ok(
  $$SELECT definir_chefe('10000000-0000-0000-0000-000000000002', 'fora@ufc.br', 'Troca de coordenação')$$,
  'admin troca o chefe de L2 (pessoa sem vínculo)');
SELECT throws_ok(
  $$SELECT definir_chefe('10000000-0000-0000-0000-000000000002', 'fora@ufc.br')$$,
  'P0001', 'Esta pessoa já é chefe deste laboratório.', 'não redefine quem já é chefe');
RESET ROLE;

SELECT is((SELECT papel FROM papel_atual WHERE email = 'fora@ufc.br' AND id_laboratorio = '10000000-0000-0000-0000-000000000002'),
  'chefe', 'novo chefe de L2 definido pelo admin');
SELECT is((SELECT count(*)::int FROM papel_atual WHERE email = 'chefe2@ufc.br'),
  0, 'chefe anterior perde o vínculo quando o admin troca');
SELECT is(
  (SELECT motivo_revogacao FROM vinculo_laboratorio v JOIN perfis p ON p.id = v.id_usuario WHERE p.email = 'chefe2@ufc.br'),
  'Troca de coordenação', 'motivo da troca fica registrado');

-- Admin revoga um chefe (laboratório fica sem chefe)
SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  format('SELECT revogar_vinculo(%L)', (
    SELECT v.id FROM vinculo_laboratorio v
    WHERE v.id_laboratorio = '10000000-0000-0000-0000-000000000002' AND v.papel = 'chefe' AND v.revogado_em IS NULL)),
  'admin revoga chefe');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM papel_atual WHERE id_laboratorio = '10000000-0000-0000-0000-000000000002' AND papel = 'chefe'),
  0, 'laboratório fica sem chefe até o admin definir outro');

-- Chefia nunca tem validade
SELECT throws_ok(
  $$INSERT INTO vinculo_laboratorio (id_usuario, id_laboratorio, papel, expira_em)
    VALUES ('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'chefe', now() + interval '1 day')$$,
  '23514', NULL, 'vínculo de chefe com validade é rejeitado pelo banco');

SELECT * FROM finish();
ROLLBACK;
