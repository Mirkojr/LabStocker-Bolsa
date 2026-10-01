-- Carga inicial do catálogo (migration ..._carga_catalogo_reagentes.sql).
-- Não usa tests.cenario(), que apaga o catálogo.
BEGIN;
SELECT no_plan();

SELECT ok((SELECT count(*) FROM reagente WHERE numero_cas IS NOT NULL) >= 276,
  'a carga traz pelo menos 276 reagentes com CAS');

SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'Acetona'), '67-64-1', 'acetona com CAS');
SELECT is((SELECT instituicao_controladora FROM reagente WHERE nome = 'Acetona'), 'Polícia Federal',
  'acetona controlada pela PF (Lista II)');
SELECT is((SELECT instituicao_controladora FROM reagente WHERE nome = 'Permanganato de potássio'),
  'Polícia Federal', 'permanganato controlado pela PF (Lista VI)');
SELECT is((SELECT instituicao_controladora FROM reagente WHERE nome = 'Ácido nítrico'), 'Exército',
  'ácido nítrico controlado pelo Exército');
SELECT is((SELECT instituicao_controladora FROM reagente WHERE nome = 'Etanol'), NULL,
  'etanol não é controlado (a Lista VII da PF só vale para exportação)');

-- Isômeros: mesma fórmula, CAS diferentes
SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'Etanol'), '64-17-5', 'etanol 64-17-5');
SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'Éter etílico'), '60-29-7', 'éter etílico 60-29-7');
SELECT is((SELECT numero_cas FROM reagente WHERE nome = 'n-Butanol'), '71-36-3',
  'n-butanol 71-36-3 (mesma fórmula do éter etílico, C4H10O)');

-- Hidratos são substâncias diferentes do sal anidro
SELECT isnt((SELECT numero_cas FROM reagente WHERE nome = 'Sulfato de cobre(II)'),
  (SELECT numero_cas FROM reagente WHERE nome = 'Sulfato de cobre(II) pentaidratado'),
  'sulfato de cobre anidro e pentaidratado têm CAS diferentes');

SELECT is((SELECT count(*)::int FROM reagente WHERE numero_cas IS NOT NULL AND NOT cas_valido(numero_cas)),
  0, 'todos os CAS da carga são válidos');

SELECT * FROM finish();
ROLLBACK;
