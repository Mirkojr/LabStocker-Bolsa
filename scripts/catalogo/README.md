# Carga do catálogo de reagentes

Monta a carga inicial do catálogo (`public.reagente`) com nome, número CAS, fórmula e órgão controlador, conferidos em fontes oficiais.

## Arquivos

| Arquivo | O que é |
|---|---|
| `reagentes.csv` | A lista de entrada: nome em português, nome em inglês para buscar no PubChem, fórmula na notação usual, órgão controlador e, quando foi preciso decidir, o CAS revisado com a justificativa. É o único arquivo editado à mão. |
| `conferir-pubchem.mjs` | Busca cada reagente no PubChem, pega o CAS e compara a fórmula. Gera `catalogo-conferido.csv`. Guarda as respostas em `.cache-pubchem.json` (fora do git), então uma execução interrompida continua de onde parou. |
| `catalogo-conferido.csv` | A lista conferida, gerada pelo script (não edite). A coluna `situacao` diz se a linha está `ok` ou se precisa `revisar`, e a `observacao` diz por quê. |
| `gerar-migration.mjs` | Transforma a lista revisada numa migration em `supabase/migrations/`. |

## Passo a passo

1. Edite `reagentes.csv` (separado por `;`; não use `;` dentro dos textos).
2. Confira no PubChem (precisa de internet; da primeira vez leva uns 10 minutos, depois só consulta o que mudou):
   ```bash
   node scripts/catalogo/conferir-pubchem.mjs
   ```
3. Resolva as linhas marcadas `revisar`, sempre em `reagentes.csv`:
   - nome em inglês que o PubChem não achou ou que caiu no composto errado: troque o `nome_pubchem`;
   - fórmula diferente: corrija a `formula` (ou o `nome_pubchem`, se o composto é que está errado);
   - CAS incerto ou ausente: escolha o CAS em `cas_revisado` e explique em `nota_revisao`;
   - reagente que não deve entrar: apague a linha.

   Rode a conferência de novo até não sobrar nada para revisar.
4. Gere a migration (o carimbo de data define a ordem entre as migrations):
   ```bash
   node scripts/catalogo/gerar-migration.mjs AAAAMMDDHHMMSS
   ```
   O script recusa a lista enquanto houver linha para revisar.
5. Teste com `npm run db:reset` e `npm run test:db`, e siga o fluxo normal de migration (PR, depois `supabase db push`). A migration avisa, na saída do `db push`, os reagentes já cadastrados cujo controle difere das portarias; esses ela não altera.

## De onde vêm os dados

- **CAS e fórmula:** [PubChem](https://pubchem.ncbi.nlm.nih.gov/) (NIH). O CAS escolhido é o mais citado entre as fontes do PubChem para o composto. A fórmula da lista é comparada com a do PubChem contando os átomos, porque o PubChem usa a notação de Hill (NaOH aparece como HNaO). A fórmula gravada no catálogo é a da lista, na notação usual.
- **Polícia Federal:** [Portaria MJSP nº 204/2022, Anexo I](https://www.gov.br/pf/pt-br/assuntos/produtos-quimicos/legislacao/listas204.pdf), Listas I a VI. A Lista VII não é usada: ela só vale para exportação à Bolívia, à Colômbia e ao Peru.
- **Exército:** [Portaria nº 118-COLOG/2019, Anexo I](https://www.gov.br/siscomex/pt-br/arquivos-e-imagens/2019/10/Portaria-no-118-COLOG-de-4-Out-2019-Lista-de-PCE.pdf), produtos químicos (tipo 7).

A coluna `fonte_controle` guarda a lista e o código de cada produto controlado. Ela não vai para o banco: serve para quem revisa conferir na portaria.

## Limites

- As listas mudam. Antes de cada carga, confira se as portarias citadas continuam em vigor.
- O controle depende da concentração. Na PF, por exemplo, as Listas IV e V valem a partir de 10%, e soluções de solventes da Lista II com até 60% são isentas. O catálogo marca a substância. A concentração de cada frasco é responsabilidade de quem cadastra o estoque.
- Misturas sem CAS único (éter de petróleo, xilol, vaselina, ágar, Triton) ficam fora desta carga e podem ser cadastradas pela tela, sem CAS.
