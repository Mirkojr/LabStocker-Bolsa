// Confere a lista de reagentes (reagentes.csv) no PubChem e gera
// catalogo-conferido.csv para revisão.
//
// Para cada reagente: procura o composto pelo nome em inglês, pega o número
// CAS mais citado nas fontes do PubChem e compara a fórmula da lista com a do
// PubChem (contando os átomos, já que o PubChem escreve na notação de Hill:
// NaOH vira HNaO). O que não bater fica marcado como "revisar".
//
// As respostas do PubChem ficam em .cache-pubchem.json (fora do git), uma
// entrada por nome em inglês, gravada assim que o item é conferido. Se o
// script parar no meio, a próxima execução continua de onde parou. Mudar a
// fórmula ou o controle na lista não exige consultar de novo; para refazer
// uma consulta, apague a entrada (ou o arquivo inteiro).
//
// Uso: node scripts/catalogo/conferir-pubchem.mjs
// Precisa de internet. O PubChem aceita até 5 requisições por segundo.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PASTA = dirname(fileURLToPath(import.meta.url));
const ARQUIVO_CACHE = join(PASTA, ".cache-pubchem.json");
const API = "https://pubchem.ncbi.nlm.nih.gov/rest";
const INTERVALO_MS = 350;
const BOM = String.fromCharCode(0xfeff);

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Mesma regra de cas_valido() no banco e validarCAS() no front.
function casValido(cas) {
  if (!/^[1-9]\d{1,6}-\d{2}-\d$/.test(cas)) return false;
  const d = cas.replace(/-/g, "");
  let soma = 0;
  for (let i = 1; i < d.length; i++) soma += Number(d[d.length - 1 - i]) * i;
  return soma % 10 === Number(d[d.length - 1]);
}

// Conta os átomos de uma fórmula: aceita parênteses, colchetes e partes
// separadas por "·" ou "." com coeficiente (CuSO4·5H2O).
export function contarAtomos(formula) {
  const total = {};
  for (const parte of formula.replace(/[+-]/g, "").split(/[·.]/)) {
    const m = parte.match(/^(\d+)(.*)$/);
    const coef = m ? Number(m[1]) : 1;
    const grupo = m ? m[2] : parte;
    for (const [el, n] of Object.entries(contarGrupo(grupo))) {
      total[el] = (total[el] || 0) + n * coef;
    }
  }
  return total;
}

function contarGrupo(texto) {
  const pilha = [{}];
  const re = /([A-Z][a-z]?)(\d*)|([([])|([)\]])(\d*)/g;
  let m;
  while ((m = re.exec(texto))) {
    if (m[1]) {
      const topo = pilha[pilha.length - 1];
      topo[m[1]] = (topo[m[1]] || 0) + Number(m[2] || 1);
    } else if (m[3]) {
      pilha.push({});
    } else {
      const dentro = pilha.pop();
      const mult = Number(m[5] || 1);
      const topo = pilha[pilha.length - 1];
      for (const [el, n] of Object.entries(dentro)) topo[el] = (topo[el] || 0) + n * mult;
    }
  }
  return pilha[0];
}

const mesmaComposicao = (a, b) => {
  const ca = contarAtomos(a);
  const cb = contarAtomos(b);
  const els = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  return [...els].every((el) => ca[el] === cb[el]);
};

async function buscar(caminho) {
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    await esperar(INTERVALO_MS);
    const resp = await fetch(API + caminho).catch(() => null);
    const corpo = resp ? await resp.json().catch(() => null) : null;
    // Só "NotFound" quer dizer que o nome não existe. Quando está sobrecarregado,
    // o PubChem às vezes responde com outros códigos ("ServerBusy").
    if (corpo?.Fault?.Code?.endsWith(".NotFound")) return null;
    if (resp?.ok && corpo && !corpo.Fault) return corpo;
    // Ocupado ou falha de rede: espera cada vez mais e tenta de novo.
    await esperar(2000 * 2 ** (tentativa - 1));
  }
  throw new Error(`PubChem não respondeu: ${caminho}`);
}

// Junta todos os textos de uma seção do PUG-View.
function textos(no, saida = []) {
  if (Array.isArray(no)) no.forEach((n) => textos(n, saida));
  else if (no && typeof no === "object") {
    if (typeof no.String === "string") saida.push(no.String);
    Object.values(no).forEach((v) => textos(v, saida));
  }
  return saida;
}

async function casDoComposto(cid) {
  const view = await buscar(`/pug_view/data/compound/${cid}/JSON?heading=CAS`);
  const contagem = new Map();
  for (const t of textos(view?.Record?.Section ?? [])) {
    const cas = t.trim();
    if (casValido(cas)) contagem.set(cas, (contagem.get(cas) || 0) + 1);
  }
  const ordenados = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  return ordenados.map(([cas, n]) => ({ cas, n }));
}

// Alguns registros não têm a seção CAS; aí o CAS só aparece nos sinônimos.
async function casDosSinonimos(cid) {
  const sin = await buscar(`/pug/compound/cid/${cid}/synonyms/JSON`);
  const lista = sin?.InformationList?.Information?.[0]?.Synonym ?? [];
  return [...new Set(lista.filter(casValido))].map((cas) => ({ cas, n: 1 }));
}

// O que o PubChem diz sobre um nome. É isto que vai para o cache.
async function consultarPubchem(nomeIngles) {
  const ids = await buscar(`/pug/compound/name/${encodeURIComponent(nomeIngles)}/cids/JSON`);
  const cids = ids?.IdentifierList?.CID ?? [];
  if (cids.length === 0) return { encontrado: false };

  const cid = cids[0];
  const prop = await buscar(`/pug/compound/cid/${cid}/property/MolecularFormula,Title/JSON`);
  const { MolecularFormula: formula = "", Title: titulo = "" } =
    prop?.PropertyTable?.Properties?.[0] ?? {};
  if (!formula) throw new Error(`PubChem sem fórmula para o CID ${cid}`);

  let listaCas = await casDoComposto(cid);
  const casDosSinonimosUsado = listaCas.length === 0;
  if (casDosSinonimosUsado) listaCas = await casDosSinonimos(cid);

  return {
    encontrado: true,
    cid,
    totalCids: cids.length,
    formula,
    titulo,
    listaCas,
    casDosSinonimos: casDosSinonimosUsado,
  };
}

// Compara o item da lista com a resposta do PubChem.
function avaliar(item, pc) {
  if (!pc.encontrado) {
    return { ...item, situacao: "revisar", observacao: "não encontrado no PubChem" };
  }

  const avisos = [];
  const notas = [];
  if (!mesmaComposicao(item.formula, pc.formula)) {
    avisos.push(`fórmula diferente: lista ${item.formula}, PubChem ${pc.formula}`);
  }

  // Dúvidas sobre o CAS: valem até alguém decidir na coluna cas_revisado.
  const duvidasCas = [];
  if (pc.totalCids > 1) {
    duvidasCas.push(`${pc.totalCids} compostos com esse nome; usado o CID ${pc.cid}`);
  }
  if (pc.listaCas.length === 0) duvidasCas.push("sem CAS no PubChem");
  else if (pc.casDosSinonimos) {
    duvidasCas.push(`CAS só nos sinônimos do PubChem: ${pc.listaCas.map((c) => c.cas).join(", ")}`);
  } else if (pc.listaCas.length > 1 && pc.listaCas[1].n * 2 > pc.listaCas[0].n) {
    duvidasCas.push(`CAS incerto: ${pc.listaCas.map((c) => `${c.cas} (${c.n})`).join(", ")}`);
  }

  let numeroCas = pc.listaCas[0]?.cas ?? "";
  if (item.cas_revisado) {
    if (!casValido(item.cas_revisado)) {
      avisos.push(`cas_revisado inválido: ${item.cas_revisado}`);
    } else {
      numeroCas = item.cas_revisado;
      const sugerido = pc.listaCas[0]?.cas;
      notas.push(
        `CAS revisado${sugerido && sugerido !== numeroCas ? ` (PubChem sugeria ${sugerido})` : ""}: ${item.nota_revisao || "sem nota"}`
      );
    }
  } else {
    avisos.push(...duvidasCas);
  }

  return {
    ...item,
    numero_cas: numeroCas,
    cid: pc.cid,
    titulo_pubchem: pc.titulo,
    formula_pubchem: pc.formula,
    situacao: avisos.length ? "revisar" : "ok",
    observacao: [...avisos, ...notas].join("; "),
  };
}

function lerCache() {
  if (!existsSync(ARQUIVO_CACHE)) return {};
  try {
    return JSON.parse(readFileSync(ARQUIVO_CACHE, "utf8"));
  } catch {
    console.warn("Cache ilegível; começando do zero.");
    return {};
  }
}

function lerCsv(caminho) {
  const [cabecalho, ...linhas] = readFileSync(caminho, "utf8")
    .replace(BOM, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const campos = cabecalho.split(";");
  return linhas.map((l, i) => {
    const valores = l.split(";");
    // Um ";" sobrando num texto desloca as colunas sem dar erro nenhum.
    if (valores.length !== campos.length) {
      throw new Error(
        `${caminho}, linha ${i + 2}: ${valores.length} colunas, esperado ${campos.length}. Tire o ";" do texto.`
      );
    }
    return Object.fromEntries(valores.map((v, j) => [campos[j], v.trim()]));
  });
}

function escreverCsv(caminho, linhas, campos) {
  const corpo = linhas.map((l) =>
    campos.map((c) => String(l[c] ?? "").replace(/;/g, ",")).join(";")
  );
  // BOM para o Excel abrir os acentos certo.
  writeFileSync(caminho, BOM + [campos.join(";"), ...corpo].join("\n") + "\n");
}

async function main() {
  const itens = lerCsv(join(PASTA, "reagentes.csv"));
  const cache = lerCache();
  const total = itens.length;
  const resultado = [];
  let falhas = 0;

  for (const [i, item] of itens.entries()) {
    const chave = item.nome_pubchem.toLowerCase();
    const prefixo = `[${String(i + 1).padStart(3)}/${total}] ${item.nome}`;

    let pc = cache[chave];
    let origem = "cache";
    if (!pc) {
      try {
        pc = await consultarPubchem(item.nome_pubchem);
        origem = "PubChem";
        cache[chave] = pc;
        writeFileSync(ARQUIVO_CACHE, JSON.stringify(cache, null, 1));
      } catch (e) {
        // Falha de rede não vai para o cache: a próxima execução tenta de novo.
        falhas++;
        resultado.push({
          ...item,
          situacao: "revisar",
          observacao: `${e.message}; rode a conferência de novo`,
        });
        console.log(`${prefixo}: FALHOU (${e.message})`);
        continue;
      }
    }

    const r = avaliar(item, pc);
    resultado.push(r);
    console.log(`${prefixo}: ${r.situacao}${r.numero_cas ? ` ${r.numero_cas}` : ""} (${origem})`);
  }

  // CAS repetido na própria lista (ex.: dois nomes para a mesma substância).
  const porCas = new Map();
  for (const r of resultado.filter((r) => r.numero_cas)) {
    porCas.set(r.numero_cas, [...(porCas.get(r.numero_cas) ?? []), r]);
  }
  for (const [cas, grupo] of porCas) {
    if (grupo.length < 2) continue;
    for (const r of grupo) {
      r.situacao = "revisar";
      const outros = grupo.filter((o) => o !== r).map((o) => o.nome);
      r.observacao = [r.observacao, `CAS ${cas} repetido em: ${outros.join(", ")}`]
        .filter(Boolean)
        .join("; ");
    }
  }

  escreverCsv(join(PASTA, "catalogo-conferido.csv"), resultado, [
    "nome",
    "numero_cas",
    "formula",
    "controle",
    "fonte_controle",
    "situacao",
    "observacao",
    "cid",
    "titulo_pubchem",
    "formula_pubchem",
  ]);

  const revisar = resultado.filter((r) => r.situacao === "revisar");
  console.log(`\n${resultado.length} reagentes, ${revisar.length} para revisar.`);
  for (const r of revisar) console.log(`- ${r.nome}: ${r.observacao}`);
  if (falhas) {
    console.log(`\n${falhas} consultas falharam. Rode de novo: só elas serão refeitas.`);
    process.exitCode = 1;
  }
}

// Só roda quando chamado direto (o gerador da migration importa contarAtomos).
const chamadoDireto =
  process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (chamadoDireto) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
