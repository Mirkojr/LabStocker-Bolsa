-- Disponibilidade do estoque para outros laboratórios e dono do item nos pedidos.
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- L2 tem, além da Acetona do cenário: um controlado, um vencido e um esgotado.
INSERT INTO public.reagente (id, nome, instituicao_controladora) VALUES
  ('20000000-0000-0000-0000-000000000002', 'Ácido sulfúrico', 'Polícia Federal');
INSERT INTO public.estoquelab (id, id_laboratorio, id_reagente, quantidade, unidade_medida, data_validade, observacoes_operacionais) VALUES
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 4, 'L', NULL, 'Armário de ácidos'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'L', current_date - 1, NULL),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 0, 'L', NULL, NULL);

-- ============================================================
-- estoque_disponivel
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1 olhando L2
SELECT results_eq(
  $$SELECT reagente_nome, quantidade, instituicao_controladora
    FROM estoque_disponivel('10000000-0000-0000-0000-000000000002')$$,
  $$VALUES ('Acetona', 10::numeric, NULL::text), ('Ácido sulfúrico', NULL::numeric, 'Polícia Federal')$$,
  'outro laboratório vê só itens com saldo e na validade; controlado sem quantidade');
SELECT is(
  (SELECT count(*)::int FROM estoquelab WHERE id_laboratorio = '10000000-0000-0000-0000-000000000002'), 0,
  'outro laboratório não lê a tabela (local e observações ficam de fora)');
RESET ROLE;

SELECT tests.logar('c0000000-0000-0000-0000-000000000002'); -- chefe L2 olhando o próprio
SELECT is(
  (SELECT quantidade FROM estoque_disponivel('10000000-0000-0000-0000-000000000002')
   WHERE reagente_nome = 'Ácido sulfúrico'),
  4::numeric, 'o próprio laboratório vê a quantidade do controlado');
RESET ROLE;

SELECT tests.logar('a0000000-0000-0000-0000-000000000001'); -- admin
SELECT is(
  (SELECT quantidade FROM estoque_disponivel('10000000-0000-0000-0000-000000000002')
   WHERE reagente_nome = 'Ácido sulfúrico'),
  4::numeric, 'admin vê a quantidade do controlado');
RESET ROLE;

SELECT tests.logar('f0000000-0000-0000-0000-000000000001'); -- sem vínculo
SELECT throws_ok($$SELECT * FROM estoque_disponivel('10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Só quem tem vínculo com um laboratório pode consultar o estoque dos outros.',
  'quem não tem vínculo não consulta a disponibilidade');
RESET ROLE;

SELECT tests.logar('e0000000-0000-0000-0000-000000000002'); -- vínculo vencido
SELECT throws_ok($$SELECT * FROM estoque_disponivel('10000000-0000-0000-0000-000000000002')$$,
  'P0001', NULL, 'vínculo vencido não consulta a disponibilidade');
RESET ROLE;

SELECT tests.anonimo();
SELECT throws_ok($$SELECT * FROM estoque_disponivel('10000000-0000-0000-0000-000000000002')$$,
  '42501', NULL, 'visitante sem login não consulta');
RESET ROLE;

-- ============================================================
-- PEDIDOS: o item precisa ser do laboratório de origem
-- ============================================================
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro L1
SELECT lives_ok(
  $$INSERT INTO transferencia (id, id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
    VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
            '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 1)$$,
  'membro pede o controlado de L2');
SELECT is(
  (SELECT r.nome FROM transferencia t JOIN estoquelab e ON e.id = t.id_item_estoque
   JOIN reagente r ON r.id = e.id_reagente WHERE t.id = '40000000-0000-0000-0000-000000000001'),
  'Ácido sulfúrico', 'quem pediu vê o item do próprio pedido');
SELECT is((SELECT count(*)::int FROM estoquelab WHERE id_laboratorio = '10000000-0000-0000-0000-000000000002'), 1,
  'e só esse item do outro laboratório');
RESET ROLE;

-- Lab 3, onde o membro de L1 também é gestor: pedir para L1 dizendo
-- que a origem é L3, mas com um item de L2.
INSERT INTO public.laboratorio (id, nome_laboratorio, codigo_sipac)
VALUES ('10000000-0000-0000-0000-000000000003', 'Lab 3', 'SIPAC-3');
INSERT INTO public.vinculo_laboratorio (id_usuario, id_laboratorio, papel, concedido_em)
VALUES ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'gestor', now() - interval '1 day');

SELECT tests.logar('e0000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$INSERT INTO transferencia (id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
    VALUES ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
            '10000000-0000-0000-0000-000000000001', 1)$$,
  '42501', NULL, 'pedido com item de outro laboratório que não a origem é recusado');
RESET ROLE;

-- Mesmo que um pedido assim já exista, a aprovação recusa.
INSERT INTO transferencia (id, id_item_estoque, id_lab_origem, id_lab_destino, quantidade_transferida)
VALUES ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 1);
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- gestor de L3
SELECT throws_ok($$SELECT aprovar_transferencia('40000000-0000-0000-0000-000000000009')$$,
  'P0001', 'O item pedido não pertence ao laboratório de origem.',
  'aprovação não move item de um terceiro laboratório');
RESET ROLE;
SELECT is((SELECT quantidade FROM estoquelab WHERE id = '30000000-0000-0000-0000-000000000003'), 4::numeric,
  'estoque de L2 intacto');

SELECT * FROM finish();
ROLLBACK;
