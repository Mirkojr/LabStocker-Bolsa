-- As tabelas e RPCs existentes respeitam tem_permissao().
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- ============================================================
-- LISTA EXATA DE POLÍTICAS (uma política a mais pode liberar acesso)
-- ============================================================
SELECT policies_are('public', 'laboratorio', ARRAY[
  'Leitura publica de laboratorios', 'Admin cadastra laboratorio', 'Admin edita laboratorio', 'Admin exclui laboratorio']);
SELECT policies_are('public', 'reagente', ARRAY[
  'Ver reagentes', 'Cadastrar reagente', 'Editar reagente', 'Excluir reagente']);
SELECT policies_are('public', 'perfis', ARRAY['Ver perfis', 'Atualizar proprio perfil']);
SELECT policies_are('public', 'estoquelab', ARRAY[
  'Ver estoque', 'Inserir estoque', 'Atualizar estoque', 'Excluir estoque']);
SELECT policies_are('public', 'residuo', ARRAY[
  'Ver residuos', 'Inserir residuo', 'Atualizar residuo', 'Excluir residuo']);
SELECT policies_are('public', 'transferencia', ARRAY[
  'Ver transferencias', 'Solicitar transferencia', 'Recusar transferencia']);
SELECT policies_are('public', 'consumo', ARRAY['Ver consumos']);
SELECT policies_are('public', 'Movimentacao', ARRAY[
  'Ver movimentacoes', 'Inserir movimentacoes', 'Atualizar movimentacoes', 'Excluir movimentacoes']);
SELECT policies_are('public', 'feedback', ARRAY['Criar feedback', 'Ver feedbacks']);
SELECT policies_are('public', 'projetos', ARRAY[
  'Criar propria solicitacao', 'Ver solicitacoes', 'Admin gerencia solicitacoes']);
SELECT policies_are('public', 'vinculo_laboratorio', ARRAY['Ver vinculos']);
SELECT policies_are('public', 'administrador', ARRAY['Ver admins']);
SELECT policies_are('public', 'pedido_vinculo', ARRAY['Ver pedidos de vinculo']);
SELECT ok(
  (SELECT bool_and(c.relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'),
  'RLS ligada em todas as tabelas do schema public');

-- ============================================================
-- ESTOQUE
-- ============================================================
SELECT tests.logar('f0000000-0000-0000-0000-000000000001'); -- sem vínculo
SELECT is((SELECT count(*)::int FROM estoquelab), 2, 'qualquer logado lê o estoque de todos os laboratórios');
RESET ROLE;

SELECT tests.anonimo();
SELECT is((SELECT count(*)::int FROM estoquelab), 0, 'visitante sem login não lê estoque');
RESET ROLE;

SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT throws_ok(
  $$INSERT INTO estoquelab (id_laboratorio, id_reagente, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'L')$$,
  '42501', NULL, 'membro não cadastra item de estoque');
UPDATE estoquelab SET quantidade = 999 WHERE id = '30000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is((SELECT quantidade FROM estoquelab WHERE id = '30000000-0000-0000-0000-000000000001'), 10::numeric,
  'membro não altera quantidade direto');

SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor L1
SELECT lives_ok(
  $$INSERT INTO estoquelab (id_laboratorio, id_reagente, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'g')$$,
  'gestor cadastra item no próprio laboratório');
SELECT throws_ok(
  $$INSERT INTO estoquelab (id_laboratorio, id_reagente, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1, 'g')$$,
  '42501', NULL, 'gestor não cadastra item em outro laboratório');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT throws_ok(
  $$INSERT INTO estoquelab (id_laboratorio, id_reagente, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'mg')$$,
  '42501', NULL, 'admin não edita estoque de laboratório');
RESET ROLE;

-- ============================================================
-- CONSUMO
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT lives_ok($$SELECT registrar_consumo('30000000-0000-0000-0000-000000000001', 2, 'Aula')$$,
  'membro registra consumo no próprio laboratório');
SELECT throws_ok($$SELECT registrar_consumo('30000000-0000-0000-0000-000000000002', 1)$$,
  'P0001', 'Sem permissão para consumir este item.', 'membro não consome estoque de outro laboratório');
SELECT throws_ok(
  $$INSERT INTO consumo (id_laboratorio, id_item_estoque, id_reagente, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'L')$$,
  '42501', NULL, 'consumo só entra pela RPC (que debita o estoque)');
RESET ROLE;
SELECT is((SELECT quantidade FROM estoquelab WHERE id = '30000000-0000-0000-0000-000000000001'), 8::numeric,
  'o consumo debitou o estoque');

SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT throws_ok($$SELECT registrar_consumo('30000000-0000-0000-0000-000000000001', 1)$$,
  'P0001', 'Sem permissão para consumir este item.', 'admin não registra consumo');
SELECT is((SELECT count(*)::int FROM consumo), 1, 'admin lê consumos de todos');
RESET ROLE;

SELECT tests.logar('e0000000-0000-0000-0000-000000000002'); -- vencido
SELECT throws_ok($$SELECT registrar_consumo('30000000-0000-0000-0000-000000000001', 1)$$,
  'P0001', 'Sem permissão para consumir este item.', 'vínculo vencido não consome');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe L2
SELECT is((SELECT count(*)::int FROM consumo), 0, 'outro laboratório não vê os consumos de L1');
RESET ROLE;

SELECT tests.anonimo();
SELECT throws_ok($$SELECT registrar_consumo('30000000-0000-0000-0000-000000000001', 1)$$,
  '42501', NULL, 'visitante sem login não chama registrar_consumo');
RESET ROLE;

-- ============================================================
-- RESÍDUO
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT lives_ok(
  $$INSERT INTO residuo (id_laboratorio, descricao, tipo_perigo, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000001', 'Solvente', 'Inflamavel', 1, 'L')$$,
  'membro registra resíduo');
SELECT throws_ok(
  $$INSERT INTO residuo (id_laboratorio, descricao, tipo_perigo, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000002', 'Solvente', 'Inflamavel', 1, 'L')$$,
  '42501', NULL, 'membro não registra resíduo em outro laboratório');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT is((SELECT count(*)::int FROM residuo), 1, 'admin lê resíduos');
SELECT throws_ok(
  $$INSERT INTO residuo (id_laboratorio, descricao, tipo_perigo, quantidade, unidade_medida)
    VALUES ('10000000-0000-0000-0000-000000000001', 'X', 'Toxico', 1, 'L')$$,
  '42501', NULL, 'admin não registra resíduo');
RESET ROLE;

SELECT tests.logar('f0000000-0000-0000-0000-000000000001');
SELECT is((SELECT count(*)::int FROM residuo), 0, 'sem vínculo não vê resíduos');
RESET ROLE;

-- ============================================================
-- TRANSFERÊNCIA
-- ============================================================
-- Membro de L1 pede reagente de L2 (origem = L2, destino = L1)
SELECT tests.logar('e0000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$INSERT INTO transferencia (id, id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
    VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 3)$$,
  'membro pede transferência para o próprio laboratório');
SELECT throws_ok(
  $$INSERT INTO transferencia (id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida, status)
    VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000001', 3, 'aprovado')$$,
  '42501', NULL, 'pedido não pode nascer aprovado');
SELECT throws_ok(
  $$INSERT INTO transferencia (id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
    VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000002', 3)$$,
  '42501', NULL, 'membro não pede em nome de outro laboratório');
UPDATE transferencia SET status = 'aprovado' WHERE id = '40000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is((SELECT status FROM transferencia WHERE id = '40000000-0000-0000-0000-000000000001'), 'pendente',
  'quem pediu não aprova o próprio pedido');

SELECT tests.logar('d0000000-0000-0000-0000-000000000001'); -- gestor de L1 (destino)
SELECT throws_ok($$SELECT aprovar_transferencia('40000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Sem permissão para aprovar esta transferência.', 'gestor do laboratório que recebe não aprova');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe de L2 (origem)
SELECT throws_ok(
  $$UPDATE transferencia SET status = 'aprovado' WHERE id = '40000000-0000-0000-0000-000000000001'$$,
  '42501', NULL, 'aprovar direto na tabela (sem mover estoque) é bloqueado');
SELECT lives_ok($$SELECT aprovar_transferencia('40000000-0000-0000-0000-000000000001')$$,
  'chefe da origem aprova');
RESET ROLE;
SELECT is((SELECT quantidade FROM estoquelab WHERE id = '30000000-0000-0000-0000-000000000002'), 7::numeric,
  'aprovação debita a origem');

-- Recusa
SELECT tests.logar('e0000000-0000-0000-0000-000000000001');
INSERT INTO transferencia (id, id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
VALUES ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1);
RESET ROLE;
SELECT tests.logar('c0000000-0000-0000-0000-000000000002');
SELECT lives_ok(
  $$UPDATE transferencia SET status = 'recusado', motivo_recusa = 'Sem estoque' WHERE id = '40000000-0000-0000-0000-000000000002'$$,
  'chefe da origem recusa com motivo');
SELECT throws_ok(
  $$UPDATE transferencia SET quantidade_transferida = 100 WHERE id = '40000000-0000-0000-0000-000000000002'$$,
  '42501', NULL, 'não altera a quantidade pedida');
RESET ROLE;
SELECT is((SELECT status FROM transferencia WHERE id = '40000000-0000-0000-0000-000000000002'), 'recusado', 'pedido recusado');

SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT is((SELECT count(*)::int FROM transferencia), 2, 'admin lê todas as transferências');
SELECT throws_ok($$SELECT aprovar_transferencia('40000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Sem permissão para aprovar esta transferência.', 'admin não aprova transferência');
RESET ROLE;

-- ============================================================
-- CATÁLOGO DE REAGENTES
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro
SELECT lives_ok($$INSERT INTO reagente (nome) VALUES ('Etanol')$$, 'membro cadastra reagente novo');
SELECT throws_ok($$INSERT INTO reagente (nome) VALUES ('  acetona ')$$,
  '23505', NULL, 'nome duplicado (ignorando caixa e espaços) é recusado');
UPDATE reagente SET composicao_quimica = 'X' WHERE nome = 'Acetona';
RESET ROLE;
SELECT is((SELECT composicao_quimica FROM reagente WHERE nome = 'Acetona'), NULL, 'membro não edita reagente existente');

SELECT tests.logar('f0000000-0000-0000-0000-000000000001'); -- sem vínculo
SELECT throws_ok($$INSERT INTO reagente (nome) VALUES ('Metanol')$$,
  '42501', NULL, 'sem vínculo não cadastra reagente');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- chefe
SELECT lives_ok($$UPDATE reagente SET composicao_quimica = 'C3H6O' WHERE nome = 'Acetona'$$, 'chefe edita reagente');
SELECT throws_ok($$UPDATE reagente SET nome = 'etanol' WHERE nome = 'Acetona'$$,
  '23505', NULL, 'renomear para um nome existente é recusado');
RESET ROLE;
SELECT is((SELECT composicao_quimica FROM reagente WHERE nome = 'Acetona'), 'C3H6O', 'edição do chefe gravada');

-- ============================================================
-- PERFIS E VÍNCULOS (visibilidade)
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT ok((SELECT count(*) FROM perfis WHERE id = 'c0000000-0000-0000-0000-000000000001') = 1, 'membro vê perfil de colega do laboratório');
SELECT is((SELECT count(*)::int FROM perfis WHERE id = 'c0000000-0000-0000-0000-000000000002'), 0, 'membro não vê perfil de quem é de outro laboratório');
SELECT is((SELECT count(*)::int FROM vinculo_laboratorio WHERE id_laboratorio = '10000000-0000-0000-0000-000000000002'), 0, 'membro não vê vínculos de outro laboratório');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT is((SELECT count(*)::int FROM perfis), 9, 'admin vê todos os perfis');
RESET ROLE;

-- ============================================================
-- LABORATÓRIO
-- ============================================================
SELECT tests.logar('c0000000-0000-0000-0000-000000000001');
SELECT throws_ok($$INSERT INTO laboratorio (nome_laboratorio, codigo_sipac) VALUES ('X', 'X')$$,
  '42501', NULL, 'chefe não cadastra laboratório');
RESET ROLE;
SELECT tests.logar('a0000000-0000-0000-0000-000000000001');
SELECT lives_ok($$INSERT INTO laboratorio (nome_laboratorio, codigo_sipac) VALUES ('Lab 3', 'SIPAC-3')$$,
  'admin cadastra laboratório');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
