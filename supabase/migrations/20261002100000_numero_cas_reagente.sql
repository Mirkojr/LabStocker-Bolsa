-- ============================================================
-- NÚMERO CAS NO CATÁLOGO DE REAGENTES
-- ------------------------------------------------------------
-- O número CAS identifica uma substância de forma única, inclusive
-- isômeros (etanol 64-17-5 e éter dimetílico 115-10-6 têm a mesma
-- fórmula, C2H6O). A fórmula continua sendo só informação; quem
-- identifica a substância é o CAS.
--
-- É opcional: misturas, soluções preparadas e kits não têm um CAS
-- único. Quando informado, precisa ter o formato NNNNNNN-NN-N com o
-- dígito verificador correto e não pode repetir no catálogo.
-- ============================================================

-- Dígito verificador: os dígitos antes dele, lidos da direita para a
-- esquerda, são multiplicados por 1, 2, 3...; a soma módulo 10 é o
-- último dígito. Ex.: 64-17-5 → 7×1 + 1×2 + 4×3 + 6×4 = 45 → 5.
CREATE OR REPLACE FUNCTION public.cas_valido(p_cas text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digitos text;
  v_soma int := 0;
  i int;
BEGIN
  IF p_cas IS NULL OR p_cas !~ '^[1-9][0-9]{1,6}-[0-9]{2}-[0-9]$' THEN
    RETURN false;
  END IF;

  v_digitos := replace(p_cas, '-', '');
  FOR i IN 1 .. length(v_digitos) - 1 LOOP
    v_soma := v_soma + substr(v_digitos, length(v_digitos) - i, 1)::int * i;
  END LOOP;

  RETURN v_soma % 10 = right(v_digitos, 1)::int;
END;
$$;

ALTER TABLE public.reagente
  ADD COLUMN IF NOT EXISTS numero_cas text;

ALTER TABLE public.reagente
  DROP CONSTRAINT IF EXISTS reagente_numero_cas_check;
ALTER TABLE public.reagente
  ADD CONSTRAINT reagente_numero_cas_check
  CHECK (numero_cas IS NULL OR public.cas_valido(numero_cas));

-- Vários reagentes sem CAS são permitidos (NULL não conflita).
CREATE UNIQUE INDEX IF NOT EXISTS reagente_numero_cas_unico
  ON public.reagente (numero_cas);

-- Tira espaços e trata texto vazio como "sem CAS" antes de validar.
CREATE OR REPLACE FUNCTION public.normalizar_cas_reagente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.numero_cas := nullif(btrim(NEW.numero_cas), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reagente_normalizar_cas ON public.reagente;
CREATE TRIGGER reagente_normalizar_cas
  BEFORE INSERT OR UPDATE OF numero_cas ON public.reagente
  FOR EACH ROW EXECUTE FUNCTION public.normalizar_cas_reagente();
