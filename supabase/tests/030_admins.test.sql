-- Gestão de admins e criação do primeiro admin.
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- Não-admin não gerencia admins
SELECT tests.logar('c0000000-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT conceder_admin('fora@ufc.br')$$,
  'P0001', 'Só um admin pode cadastrar outros admins.', 'chefe não cria admin');
SELECT throws_ok($$SELECT revogar_admin('a0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Só um admin pode revogar admins.', 'chefe não revoga admin');
SELECT throws_ok($$INSERT INTO administrador (id_usuario) VALUES ('c0000000-0000-0000-0000-000000000001')$$,
  '42501', NULL, 'INSERT direto em administrador é bloqueado');
SELECT is((SELECT count(*)::int FROM administrador), 0, 'não-admin não enxerga a lista de admins');
RESET ROLE;

-- Admin gerencia admins
SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT revogar_admin('a0000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Não é possível revogar o último admin do sistema.', 'não revoga o último admin');
SELECT lives_ok($$SELECT conceder_admin('fora@ufc.br')$$, 'admin cria outro admin');
SELECT throws_ok($$SELECT conceder_admin('fora@ufc.br')$$,
  'P0001', 'Esta pessoa já é admin.', 'não duplica admin');
SELECT is((SELECT count(*)::int FROM administrador WHERE revogado_em IS NULL), 2, 'admin vê a lista de admins');
SELECT lives_ok($$SELECT revogar_admin('a0000000-0000-0000-0000-000000000001', 'Fim do mandato')$$,
  'admin pode revogar a si mesmo se não for o último');
RESET ROLE;

SELECT is(
  (SELECT row(revogado_por, motivo_revogacao)::text FROM administrador WHERE id_usuario = 'a0000000-0000-0000-0000-000000000001'),
  row('a0000000-0000-0000-0000-000000000001'::uuid, 'Fim do mandato')::text,
  'revogação de admin fica registrada');
SELECT is(eh_admin('a0000000-0000-0000-0000-000000000001'), false, 'admin revogado deixa de ser admin');
SELECT is(eh_admin('f0000000-0000-0000-0000-000000000001'), true, 'novo admin passa a valer');
SELECT is(
  (SELECT concedido_por FROM administrador WHERE id_usuario = 'f0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'::uuid, 'registra quem concedeu o admin');

-- Primeiro admin: bloqueado para usuários comuns e quando já existe admin
SELECT tests.logar('c0000000-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT criar_primeiro_admin('chefe@ufc.br')$$,
  '42501', NULL, 'usuário logado não executa criar_primeiro_admin');
RESET ROLE;

SELECT throws_ok($$SELECT criar_primeiro_admin('chefe@ufc.br')$$,
  'P0001', 'Já existe admin cadastrado. Novos admins são concedidos pela interface.',
  'criar_primeiro_admin recusa quando já há admin');

UPDATE administrador SET revogado_em = now() WHERE revogado_em IS NULL;
SELECT lives_ok($$SELECT criar_primeiro_admin('chefe@ufc.br')$$,
  'sem nenhum admin ativo, o comando de instalação cria o primeiro');
SELECT is(eh_admin('c0000000-0000-0000-0000-000000000001'), true, 'primeiro admin criado');

SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT criar_primeiro_admin('gestor@ufc.br')$$,
  'P0001', 'Já existe admin cadastrado. Novos admins são concedidos pela interface.',
  'service_role (script de instalação) também respeita a regra');
RESET ROLE;

-- Cargo: informativo, editável pelo próprio usuário e pelo admin
SELECT tests.logar('e0000000-0000-0000-0000-000000000001');
SELECT lives_ok($$SELECT definir_cargo('e0000000-0000-0000-0000-000000000001', 'Discente')$$,
  'usuário define o próprio cargo');
SELECT throws_ok($$SELECT definir_cargo('d0000000-0000-0000-0000-000000000001', 'Docente')$$,
  'P0001', 'Sem permissão para alterar o cargo deste usuário.', 'usuário não altera cargo de outro');
SELECT throws_ok($$SELECT definir_cargo('e0000000-0000-0000-0000-000000000001', 'Reitor')$$,
  '23514', NULL, 'cargo fora da lista é rejeitado');
SELECT throws_ok($$UPDATE perfis SET cargo = 'Docente' WHERE id = 'e0000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'cargo não é alterado por UPDATE direto');
SELECT throws_ok($$UPDATE perfis SET is_admin = true WHERE id = 'e0000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'usuário não se torna admin editando o perfil');
SELECT throws_ok($$UPDATE perfis SET id_laboratorio = '10000000-0000-0000-0000-000000000002' WHERE id = 'e0000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'usuário não troca de laboratório editando o perfil');
SELECT lives_ok($$UPDATE perfis SET nome = 'Maria' WHERE id = 'e0000000-0000-0000-0000-000000000001'$$,
  'usuário edita o próprio nome');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- agora admin
SELECT lives_ok($$SELECT definir_cargo('e0000000-0000-0000-0000-000000000001', 'Técnico')$$,
  'admin altera o cargo de outro usuário');
RESET ROLE;
SELECT is((SELECT cargo FROM perfis WHERE id = 'e0000000-0000-0000-0000-000000000001'), 'Técnico', 'cargo gravado');
SELECT is(tem_permissao('10000000-0000-0000-0000-000000000001', 'estoque.editar', 'e0000000-0000-0000-0000-000000000001'),
  false, 'cargo não dá permissão: membro "Técnico" continua sem editar estoque');

SELECT * FROM finish();
ROLLBACK;
