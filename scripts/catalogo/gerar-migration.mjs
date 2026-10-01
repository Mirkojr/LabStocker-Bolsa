// Gera a migration de carga do catálogo a partir de catalogo-conferido.csv
// (a saída de conferir-pubchem.mjs).
//
// Todas as linhas precisam estar com situacao "ok". Se alguma estiver
// "revisar", o script para: resolva em reagentes.csv (coluna cas_revisado,
// ou corrigindo a linha, ou tirando o reagente da lista) e rode a
// conferência de novo.
//
// Uso: node scripts/catalogo/gerar-migration.mjs [AAAAMMDDHHMMSS]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PASTA = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(PASTA, "..", "..", "supabase", "migrations");

const linhas = readFileSync(join(PASTA, "catalogo-conferido.csv"), "utf8")
  .replace(String.fromCharCode(0xfeff), "")
  .split(/\r?\n/)
  .filter((l) => l.trim());
const campos = linhas.shift().split(";");
const itens = linhas.map((l) =>
  Object.fromEntries(l.split(";").map((v, i) => [campos[i], v.trim()]))
);

const pendentes = itens.filter((i) => i.situacao !== "ok");
if (pendentes.length) {
  console.error(
    `${pendentes.length} linhas para revisar. Resolva em reagentes.csv e confira de novo:`
  );
  pendentes.forEach((p) => console.error(`- ${p.nome}: ${p.situacao} ${p.observacao}`));
  process.exit(1);
}

const carga = itens;
const texto = (v) => (v ? `'${v.replace(/'/g, "''")}'` : "NULL");
const valores = carga
  .map((i) => `  (${[i.nome, i.numero_cas, i.formula, i.controle].map(texto).join(", ")})`)
  .join(",\n");

const agora = new Date();
const carimbo = process.argv[2] ?? agora.toISOString().replace(/\D/g, "").slice(0, 14);

const sql = `-- ============================================================
-- CARGA INICIAL DO CATÁLOGO DE REAGENTES (${carga.length} reagentes)
-- ------------------------------------------------------------
-- Gerada por scripts/catalogo/gerar-migration.mjs a partir de
-- scripts/catalogo/catalogo-conferido.csv. Não edite à mão: corrija a
-- lista e gere de novo.
--
-- CAS e fórmula conferidos no PubChem; órgão controlador tirado da
-- Portaria MJSP 204/2022 (Polícia Federal, Listas I a VI) e da
-- Portaria 118-COLOG/2019 (Exército, produtos químicos).
--
-- Não apaga nem renomeia nada. Reagente que já existe com o mesmo nome
-- (ignorando caixa e espaços) ganha o CAS, e a fórmula e o controle só
-- quando estiverem vazios. Os demais são inseridos, a não ser que o CAS
-- já esteja no catálogo com outro nome.
-- ============================================================

CREATE TEMP TABLE carga_catalogo (
  nome text NOT NULL,
  numero_cas text,
  formula text,
  controle text
) ON COMMIT DROP;

INSERT INTO carga_catalogo (nome, numero_cas, formula, controle) VALUES
${valores};

-- 1. Completa os reagentes que já existem. Se houver duplicados antigos
-- com o mesmo nome, só o mais antigo recebe o CAS.
UPDATE public.reagente r
SET numero_cas = coalesce(r.numero_cas, c.numero_cas),
    composicao_quimica = coalesce(nullif(btrim(r.composicao_quimica), ''), c.formula),
    instituicao_controladora = coalesce(nullif(btrim(r.instituicao_controladora), ''), c.controle)
FROM carga_catalogo c
WHERE r.id = (
    SELECT x.id FROM public.reagente x
    WHERE public.normalizar_nome_reagente(x.nome) = public.normalizar_nome_reagente(c.nome)
    ORDER BY x.data_criacao NULLS LAST, x.id
    LIMIT 1
  )
  AND (
    c.numero_cas IS NULL
    OR r.numero_cas IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.reagente y WHERE y.numero_cas = c.numero_cas)
  );

-- 2. Insere os que faltam.
INSERT INTO public.reagente (nome, numero_cas, composicao_quimica, instituicao_controladora)
SELECT c.nome, c.numero_cas, c.formula, c.controle
FROM carga_catalogo c
WHERE NOT EXISTS (
    SELECT 1 FROM public.reagente r
    WHERE public.normalizar_nome_reagente(r.nome) = public.normalizar_nome_reagente(c.nome)
  )
  AND (
    c.numero_cas IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.reagente r WHERE r.numero_cas = c.numero_cas)
  );

-- 3. Avisa (sem alterar) quando o controle já cadastrado difere das
-- portarias. Aparece na saída do "supabase db push"; a correção é feita
-- pela tela de Reagentes por quem conhece o caso.
DO $$
DECLARE
  d record;
BEGIN
  FOR d IN
    SELECT r.nome, r.instituicao_controladora AS cadastrado, c.controle AS portaria
    FROM public.reagente r
    JOIN carga_catalogo c
      ON public.normalizar_nome_reagente(r.nome) = public.normalizar_nome_reagente(c.nome)
      OR r.numero_cas = c.numero_cas
    WHERE coalesce(nullif(btrim(r.instituicao_controladora), ''), '-') <> coalesce(c.controle, '-')
    ORDER BY r.nome
  LOOP
    RAISE NOTICE 'Controle diferente das portarias: % (cadastrado: %, portarias: %)',
      d.nome, coalesce(d.cadastrado, 'nenhum'), coalesce(d.portaria, 'nenhum');
  END LOOP;
END;
$$;
`;

const arquivo = join(MIGRATIONS, `${carimbo}_carga_catalogo_reagentes.sql`);
writeFileSync(arquivo, sql);
console.log(`${carga.length} reagentes em ${arquivo}`);
