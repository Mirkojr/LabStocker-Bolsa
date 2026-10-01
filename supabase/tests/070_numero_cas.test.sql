-- Número CAS no catálogo: formato, dígito verificador e unicidade.
BEGIN;
SELECT no_plan();
SELECT tests.cenario();

-- Dígito verificador
SELECT is(cas_valido('64-17-5'), true, 'etanol: CAS válido');
SELECT is(cas_valido('115-10-6'), true, 'éter dimetílico: CAS válido');
SELECT is(cas_valido('7732-18-5'), true, 'água: CAS válido');
SELECT is(cas_valido('64-17-6'), false, 'dígito verificador errado é recusado');
SELECT is(cas_valido('6417-5'), false, 'formato sem o grupo do meio é recusado');
SELECT is(cas_valido('064-17-5'), false, 'zero à esquerda é recusado');
SELECT is(cas_valido(NULL), false, 'nulo não é um CAS válido');

-- Cadastro pelo membro (qualquer vínculo cadastra no catálogo)
SELECT tests.logar('e0000000-0000-0000-0000-000000000001');
SELECT lives_ok($$INSERT INTO reagente (nome, composicao_quimica, numero_cas) VALUES ('Etanol', 'C2H6O', ' 64-17-5 ')$$,
  'cadastra reagente com CAS');
SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'Etanol'), '64-17-5', 'espaços em volta do CAS são removidos');
SELECT lives_ok($$INSERT INTO reagente (nome, composicao_quimica, numero_cas) VALUES ('Éter dimetílico', 'C2H6O', '115-10-6')$$,
  'isômero com a mesma fórmula e outro CAS é aceito');
SELECT throws_ok($$INSERT INTO reagente (nome, numero_cas) VALUES ('Álcool etílico', '64-17-5')$$,
  '23505', NULL, 'mesmo CAS com outro nome é recusado');
SELECT throws_ok($$INSERT INTO reagente (nome, numero_cas) VALUES ('Metanol', '67-56-2')$$,
  '23514', NULL, 'CAS com dígito verificador errado é recusado');
SELECT lives_ok($$INSERT INTO reagente (nome, numero_cas) VALUES ('Solução tampão pH 7', '')$$,
  'texto vazio vira reagente sem CAS');
SELECT lives_ok($$INSERT INTO reagente (nome) VALUES ('Mistura sulfocrômica')$$,
  'vários reagentes sem CAS são aceitos');
SELECT is((SELECT count(*)::int FROM reagente WHERE numero_cas IS NULL AND nome IN ('Solução tampão pH 7', 'Mistura sulfocrômica')),
  2, 'reagentes sem CAS ficam com nulo');
RESET ROLE;

-- Só quem edita o catálogo corrige o CAS de um reagente existente
SELECT tests.logar('e0000000-0000-0000-0000-000000000001'); -- membro
UPDATE reagente SET numero_cas = '67-64-1' WHERE nome = 'Acetona';
RESET ROLE;
SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'Acetona'), NULL, 'membro não altera o CAS');

SELECT tests.logar('c0000000-0000-0000-0000-000000000001'); -- chefe
SELECT lives_ok($$UPDATE reagente SET numero_cas = '67-64-1' WHERE nome = 'Acetona'$$, 'chefe informa o CAS');
RESET ROLE;
SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'Acetona'), '67-64-1', 'CAS gravado');

SELECT * FROM finish();
ROLLBACK;
