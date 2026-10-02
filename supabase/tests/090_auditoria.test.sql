-- Auditoria imutável do estoque e tabela movimentacao renomeada.
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- Começa sem as linhas geradas pelo próprio cenário.
DELETE FROM public.auditoria;

-- ============================================================
-- TABELA RENOMEADA
-- ============================================================
SELECT has_table('public', 'movimentacao', 'tabela movimentacao em minúsculas');
SELECT hasnt_table('public', 'Movimentacao', 'não existe mais tabela "Movimentacao"');
SELECT hasnt_view('public', 'Movimentacao', 'view de compatibilidade removida');

SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor L1
SELECT lives_ok(
  $$INSERT INTO movimentacao (id_laboratorio, tipo, item_nome, quantidade, unidade)
    VALUES ('10000000-0000-0000-0000-000000000001', 'ENTRADA', 'Acetona', 1, 'L')$$,
  'gestor registra entrada em movimentacao');
SELECT throws_ok(
  $$INSERT INTO movimentacao (id_laboratorio, tipo, item_nome, quantidade, unidade)
    VALUES ('10000000-0000-0000-0000-000000000002', 'ENTRADA', 'Acetona', 1, 'L')$$,
  '42501', NULL, 'gestor não registra entrada em outro laboratório');
SELECT throws_ok($$UPDATE movimentacao SET quantidade = 99$$, '42501', NULL,
  'entrada não pode ser alterada');
SELECT throws_ok($$DELETE FROM movimentacao$$, '42501', NULL, 'entrada não pode ser apagada');
RESET ROLE;

-- ============================================================
-- EDIÇÃO PELA RPC
-- ============================================================
SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor L1
SELECT throws_ok(
  $$UPDATE estoquelab SET observacoes_operacionais = 'x' WHERE id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'gestor não edita estoque direto (só pela RPC)');
SELECT throws_ok(
  $$SELECT editar_item_estoque('30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 8, 'L', NULL, NULL)$$,
  'P0001', 'Informe o motivo do ajuste.', 'mudar a quantidade sem motivo é recusado');
SELECT throws_ok(
  $$SELECT editar_item_estoque('30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 8, 'L', NULL, NULL, '   ')$$,
  'P0001', 'Informe o motivo do ajuste.', 'motivo só com espaços é recusado');
SELECT lives_ok(
  $$SELECT editar_item_estoque('30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 10, 'L', '2030-01-01', 'Armário 2')$$,
  'mudar só validade e local não pede motivo');
SELECT lives_ok(
  $$SELECT editar_item_estoque('30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 8, 'L', '2030-01-01', 'Armário 2', 'Contagem do inventário')$$,
  'gestor corrige a quantidade com motivo');
SELECT throws_ok(
  $$SELECT editar_item_estoque('30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001', 1, 'L', NULL, NULL, 'teste')$$,
  'P0001', 'Sem permissão para editar este item.', 'gestor não edita item de outro laboratório');
RESET ROLE;

SELECT is((SELECT quantidade FROM estoquelab WHERE id = '30000000-0000-0000-0000-000000000001'), 8::numeric,
  'quantidade corrigida');
SELECT results_eq(
  $$SELECT acao, origem, motivo, item_nome, id_usuario,
           (dados_antes->>'quantidade')::numeric, (dados_depois->>'quantidade')::numeric
    FROM auditoria WHERE id_registro = '30000000-0000-0000-0000-000000000001' ORDER BY id DESC LIMIT 1$$,
  $$VALUES ('alteracao', 'manual', 'Contagem do inventário', 'Acetona',
            'd0000000-0000-0000-0000-000000000001'::uuid, 10::numeric, 8::numeric)$$,
  'auditoria guarda antes, depois, motivo e quem corrigiu');
SELECT is((SELECT count(*)::int FROM auditoria WHERE id_registro = '30000000-0000-0000-0000-000000000001'), 2,
  'cada edição vira uma linha (sem motivo quando não pede)');

-- Salvar sem mudar nada não gera linha.
SELECT tests.logar('d0000000-0000-0000-0000-000000000001');
SELECT editar_item_estoque('30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', 8, 'L', '2030-01-01', 'Armário 2');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM auditoria WHERE id_registro = '30000000-0000-0000-0000-000000000001'), 2,
  'salvar sem mudança não registra');

SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT throws_ok(
  $$SELECT editar_item_estoque('30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', 1, 'L', NULL, NULL, 'teste')$$,
  'P0001', 'Sem permissão para editar este item.', 'membro não edita item');
RESET ROLE;

-- ============================================================
-- CONSUMO E TRANSFERÊNCIA
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT registrar_consumo('30000000-0000-0000-0000-000000000001', 1, 'Aula');
RESET ROLE;
SELECT results_eq(
  $$SELECT origem, motivo, id_usuario FROM auditoria
    WHERE id_registro = '30000000-0000-0000-0000-000000000001' ORDER BY id DESC LIMIT 1$$,
  $$VALUES ('consumo', NULL::text, 'e0000000-0000-0000-0000-000000000001'::uuid)$$,
  'consumo aparece na auditoria com origem consumo');

INSERT INTO transferencia (id, id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1);
SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe L2 (origem)
SELECT aprovar_transferencia('40000000-0000-0000-0000-000000000001');
RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM auditoria WHERE origem = 'transferencia' AND tabela = 'estoquelab'),
  2, 'transferência aprovada registra a saída e a entrada');

-- Depois da RPC, uma exclusão comum volta a ser manual.
SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor L1
INSERT INTO estoquelab (id, id_laboratorio, id_reagente, quantidade, unidade_medida)
VALUES ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001', 3, 'g');
DELETE FROM estoquelab WHERE id = '30000000-0000-0000-0000-000000000009';
RESET ROLE;
SELECT results_eq(
  $$SELECT acao, origem FROM auditoria WHERE id_registro = '30000000-0000-0000-0000-000000000009' ORDER BY id$$,
  $$VALUES ('inclusao', 'manual'), ('exclusao', 'manual')$$,
  'cadastro e exclusão de item ficam registrados');
SELECT is(
  (SELECT (dados_antes->>'quantidade')::numeric FROM auditoria
   WHERE id_registro = '30000000-0000-0000-0000-000000000009' AND acao = 'exclusao'),
  3::numeric, 'exclusão guarda o item como era');

-- ============================================================
-- IMUTÁVEL E VISÍVEL SÓ PARA QUEM VÊ O LABORATÓRIO
-- ============================================================
SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- chefe L1
SELECT throws_ok($$UPDATE auditoria SET motivo = 'apagado'$$, '42501', NULL, 'chefe não altera a auditoria');
SELECT throws_ok($$DELETE FROM auditoria$$, '42501', NULL, 'chefe não apaga a auditoria');
SELECT throws_ok(
  $$INSERT INTO auditoria (tabela, id_registro, acao) VALUES ('estoquelab', gen_random_uuid(), 'exclusao')$$,
  '42501', NULL, 'chefe não insere na auditoria');
SELECT throws_ok($$SELECT public.marcar_origem_auditoria('consumo')$$, '42501', NULL,
  'app não consegue marcar a origem');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT throws_ok($$DELETE FROM auditoria$$, '42501', NULL, 'admin não apaga a auditoria');
RESET ROLE;

SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT ok((SELECT count(*) FROM auditoria WHERE id_laboratorio = '10000000-0000-0000-0000-000000000001') > 0,
  'membro vê a auditoria do próprio laboratório');
SELECT is((SELECT count(*)::int FROM auditoria WHERE id_laboratorio = '10000000-0000-0000-0000-000000000002'), 0,
  'membro não vê a auditoria de outro laboratório');
RESET ROLE;

SELECT tests.logar('f0000000-0000-0000-0000-000000000001'); -- sem vínculo
SELECT is((SELECT count(*)::int FROM auditoria), 0, 'quem não tem vínculo não vê auditoria');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
