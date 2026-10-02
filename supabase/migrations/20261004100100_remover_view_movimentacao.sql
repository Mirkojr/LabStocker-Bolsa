-- ============================================================
-- REMOVE A VIEW DE COMPATIBILIDADE "Movimentacao"
-- ------------------------------------------------------------
-- Criada na migration 20261003100000 para o site antigo continuar
-- funcionando durante a troca do nome da tabela. O front publicado já
-- usa public.movimentacao, então a ponte não é mais necessária.
-- ============================================================

DROP VIEW IF EXISTS public."Movimentacao";
