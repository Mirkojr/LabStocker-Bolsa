-- Matriz de permissões da função central tem_permissao().
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- Atalhos de leitura
CREATE TEMP VIEW ids AS SELECT
  '10000000-0000-0000-0000-000000000001'::uuid AS l1,
  '10000000-0000-0000-0000-000000000002'::uuid AS l2,
  'a0000000-0000-0000-0000-000000000001'::uuid AS admin,
  'c0000000-0000-0000-0000-000000000001'::uuid AS chefe,
  'd0000000-0000-0000-0000-000000000001'::uuid AS gestor,
  'e0000000-0000-0000-0000-000000000001'::uuid AS membro,
  'e0000000-0000-0000-0000-000000000002'::uuid AS expirado,
  'e0000000-0000-0000-0000-000000000003'::uuid AS revogado,
  'f0000000-0000-0000-0000-000000000001'::uuid AS fora;

-- Resultado esperado por papel, na ordem de acoes_laboratorio():
-- laboratorio.ver, consumo.registrar, residuo.registrar, transferencia.solicitar,
-- transferencia.aprovar, estoque.editar, membros.gerenciar, chefia.transferir
SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, membro) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[true, true, true, true, false, false, false, false],
  'membro: vê, consome, registra resíduo e pede transferência; não aprova nem edita estoque'
);

SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, gestor) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[true, true, true, true, true, true, true, false],
  'gestor: tudo menos transferir a chefia'
);

SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, chefe) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[true, true, true, true, true, true, true, true],
  'chefe: tudo no próprio laboratório'
);

SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, admin) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[true, false, false, false, false, false, false, false],
  'admin: só leitura dentro dos laboratórios'
);

SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, fora) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[false, false, false, false, false, false, false, false],
  'sem vínculo: nada'
);

SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, expirado) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[false, false, false, false, false, false, false, false],
  'vínculo vencido não dá acesso'
);

SELECT is(
  (SELECT array_agg(tem_permissao(l1, a, revogado) ORDER BY o) FROM ids, unnest(acoes_laboratorio()) WITH ORDINALITY AS t(a, o)),
  ARRAY[false, false, false, false, false, false, false, false],
  'vínculo revogado não dá acesso'
);

SELECT is((SELECT tem_permissao(l2, 'consumo.registrar', chefe) FROM ids), false,
  'papel não vaza para outro laboratório');

SELECT is((SELECT tem_permissao(NULL, 'laboratorio.ver', chefe) FROM ids), false,
  'laboratório NULL resulta em false');
SELECT is((SELECT tem_permissao(l1, 'laboratorio.ver', NULL) FROM ids), false,
  'usuário NULL resulta em false');
SELECT is((SELECT tem_permissao(l1, NULL, chefe) FROM ids), false,
  'ação NULL resulta em false');
SELECT throws_ok(
  $$SELECT tem_permissao('10000000-0000-0000-0000-000000000001', 'estoque.apagar_tudo', 'c0000000-0000-0000-0000-000000000001')$$,
  'P0001', NULL, 'ação desconhecida gera erro (pega erro de digitação)'
);

-- Validade no futuro ainda vale
UPDATE vinculo_laboratorio SET expira_em = now() + interval '1 day'
WHERE id_usuario = 'e0000000-0000-0000-0000-000000000001';
SELECT is((SELECT tem_permissao(l1, 'consumo.registrar', membro) FROM ids), true,
  'vínculo com validade futura ainda dá acesso');

-- Permissões globais (catálogo)
SELECT is((SELECT tem_permissao_global('reagente.cadastrar', membro) FROM ids), true, 'membro cadastra reagente');
SELECT is((SELECT tem_permissao_global('reagente.editar', membro) FROM ids), false, 'membro não edita reagente');
SELECT is((SELECT tem_permissao_global('reagente.editar', gestor) FROM ids), false, 'gestor não edita reagente');
SELECT is((SELECT tem_permissao_global('reagente.editar', chefe) FROM ids), true, 'chefe edita reagente');
SELECT is((SELECT tem_permissao_global('reagente.editar', admin) FROM ids), true, 'admin edita reagente');
SELECT is((SELECT tem_permissao_global('reagente.cadastrar', fora) FROM ids), false, 'sem vínculo não cadastra reagente');
SELECT is((SELECT tem_permissao_global('reagente.cadastrar', expirado) FROM ids), false, 'vínculo vencido não cadastra reagente');

-- Sessão: o default p_usuario vem do usuário logado
SELECT tests.logar('d0000000-0000-0000-0000-000000000001');
SELECT is(tem_permissao('10000000-0000-0000-0000-000000000001', 'estoque.editar'), true,
  'sem p_usuario, usa o usuário logado');
SELECT is(
  (SELECT papel::text FROM minhas_permissoes() WHERE id_laboratorio = '10000000-0000-0000-0000-000000000001'),
  'gestor', 'minhas_permissoes mostra o papel do logado');
SELECT ok(
  (SELECT 'estoque.editar' = ANY (acoes) AND NOT ('chefia.transferir' = ANY (acoes))
   FROM minhas_permissoes() WHERE id_laboratorio = '10000000-0000-0000-0000-000000000001'),
  'minhas_permissoes usa a mesma matriz de tem_permissao');
SELECT is(get_my_lab_id(), '10000000-0000-0000-0000-000000000001'::uuid,
  'get_my_lab_id (compatibilidade) devolve o laboratório do vínculo');
SELECT is(am_i_admin(), false, 'am_i_admin (compatibilidade) lê a tabela administrador');
RESET ROLE;

SELECT tests.anonimo();
SELECT throws_ok($$SELECT tem_permissao('10000000-0000-0000-0000-000000000001', 'laboratorio.ver')$$,
  '42501', NULL, 'visitante sem login não executa tem_permissao');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
