// Formulário do modal "Novo item no estoque": busca do reagente no catálogo
// (nome, fórmula ou CAS), unidade em botões e aviso de validade.
// A página (estoque.js) cuida de salvar; este módulo só lê e preenche o form.
import { escapeHtml } from "../../shared/utils/dom.js";
import { formatarFormulaQuimica, formatarQuantidade } from "../../shared/utils/formatters.js";
import { UNIDADES } from "../../shared/constants.js";

// Unidades na ordem em que se pensa nelas: volume, massa, unidade.
const ORDEM_UNIDADES = ["mL", "L", "mg", "g", "kg", "un"].filter((u) => UNIDADES.includes(u));
const MAX_RESULTADOS = 6;
const DIAS_AVISO_VALIDADE = 30;

const $ = (id) => document.getElementById(id);
const el = {
  titulo: $("estoque-modal-titulo"),
  lab: $("estoque-modal-lab"),
  salvar: $("estoque-salvar"),
  idReagente: $("estoque-reagente"),
  procura: $("estoque-reagente-procura"),
  busca: $("estoque-reagente-busca"),
  resultados: $("estoque-reagente-resultados"),
  opcoes: $("estoque-reagente-opcoes"),
  rodape: $("estoque-reagente-rodape"),
  escolhido: $("estoque-reagente-escolhido"),
  jaTem: $("estoque-ja-tem"),
  quantidade: $("estoque-quantidade"),
  unidades: $("estoque-unidades"),
  validade: $("estoque-validade"),
  validadeAviso: $("estoque-validade-aviso"),
  semValidade: $("estoque-sem-validade"),
  observacoes: $("estoque-observacoes"),
};

let catalogo = []; // [{ id, nome, composicao_quimica, numero_cas, instituicao_controladora }]
let itensDoLab = () => []; // itens de estoque do laboratório (para "já tem" e para ordenar)
let resultados = [];
let ativo = -1;
let escolhido = null;
let editando = false;

// Sem acento e em minúsculas, mantendo o tamanho do texto (os índices do
// texto normalizado servem para destacar o trecho no nome original).
function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function definirCatalogo(lista) {
  catalogo = (lista || []).map((r) => ({
    ...r,
    _nome: normalizar(r.nome),
    _formula: normalizar(r.composicao_quimica).replace(/\s/g, ""),
  }));
}

export function definirItensDoLab(fn) {
  itensDoLab = fn;
}

export function nomeReagenteEscolhido() {
  return escolhido?.nome || "";
}

// Saldo do reagente no laboratório, somado por unidade: "800 mL e 3 g".
function saldoNoLab(idReagente) {
  const porUnidade = new Map();
  for (const item of itensDoLab()) {
    if (item.id_reagente !== idReagente) continue;
    const u = item.unidade_medida;
    porUnidade.set(u, (porUnidade.get(u) || 0) + Number(item.quantidade || 0));
  }
  return [...porUnidade].map(([u, q]) => formatarQuantidade(q, u)).join(" e ");
}

function buscar(termo) {
  const t = normalizar(termo).trim();
  const noLab = new Set(itensDoLab().map((i) => i.id_reagente));
  if (!t) {
    // Campo vazio: os reagentes que o laboratório já tem.
    return catalogo
      .filter((r) => noLab.has(r.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  const semEspaco = t.replace(/\s/g, "");
  const achados = [];
  for (const r of catalogo) {
    let nota;
    if (r._nome.startsWith(t)) nota = 3;
    else if (r._nome.includes(t)) nota = 2;
    else if (r._formula === semEspaco)
      nota = 2; // fórmula exata antes de trechos dela
    else if (r._formula && r._formula.includes(semEspaco)) nota = 1;
    else if (r.numero_cas && r.numero_cas.startsWith(termo.trim())) nota = 1;
    else continue;
    achados.push({ r, nota: nota + (noLab.has(r.id) ? 10 : 0) });
  }
  achados.sort((a, b) => b.nota - a.nota || a.r.nome.localeCompare(b.r.nome, "pt-BR"));
  return achados.map((a) => a.r);
}

function destacar(reagente, termo) {
  const t = normalizar(termo).trim();
  const i = t ? reagente._nome.indexOf(t) : -1;
  if (i < 0) return escapeHtml(reagente.nome);
  const n = reagente.nome;
  return (
    escapeHtml(n.slice(0, i)) +
    `<mark>${escapeHtml(n.slice(i, i + t.length))}</mark>` +
    escapeHtml(n.slice(i + t.length))
  );
}

function dadosReagente(r) {
  const partes = [];
  if (r.composicao_quimica) partes.push(formatarFormulaQuimica(r.composicao_quimica));
  if (r.numero_cas) partes.push(`CAS ${escapeHtml(r.numero_cas)}`);
  return partes.join(", ") || "Sem fórmula nem CAS no catálogo";
}

function seloControle(r) {
  return r.instituicao_controladora
    ? `<span class="controle-reagente"><i class="bi bi-file-earmark-lock"></i>${escapeHtml(r.instituicao_controladora)}</span>`
    : "";
}

function abrirLista(aberta) {
  el.resultados.classList.toggle("d-none", !aberta);
  el.busca.setAttribute("aria-expanded", String(aberta));
  if (!aberta) el.busca.removeAttribute("aria-activedescendant");
}

function renderResultados() {
  const termo = el.busca.value;
  resultados = buscar(termo);
  const visiveis = resultados.slice(0, MAX_RESULTADOS);
  ativo = visiveis.length ? 0 : -1;

  el.opcoes.innerHTML = visiveis
    .map((r, i) => {
      const saldo = saldoNoLab(r.id);
      return `
        <li class="resultado" role="option" id="estoque-op-${i}" data-indice="${i}" aria-selected="${i === ativo}">
          <span class="nome">${destacar(r, termo)}</span>
          <span class="dados">${dadosReagente(r)}</span>
          <span class="lado">${saldo ? `<span class="no-lab">${escapeHtml(saldo)} no estoque</span>` : ""}${seloControle(r)}</span>
        </li>`;
    })
    .join("");

  const cadastrar =
    '<a href="../reagentes/reagentes.html" target="_blank" rel="noopener">Cadastrar no catálogo</a>';
  if (!termo.trim()) {
    el.rodape.innerHTML = visiveis.length
      ? `Já usados neste laboratório. Digite para buscar nos ${catalogo.length} do catálogo.`
      : `Digite para buscar nos ${catalogo.length} reagentes do catálogo.`;
  } else if (!visiveis.length) {
    el.rodape.innerHTML = `Nada encontrado para "${escapeHtml(termo.trim())}". ${cadastrar}`;
  } else {
    const resto = resultados.length - visiveis.length;
    el.rodape.innerHTML = `${resto > 0 ? `Mais ${resto} resultados. ` : ""}Não achou? ${cadastrar}`;
  }
  marcarAtivo();
  abrirLista(true);
}

function marcarAtivo() {
  el.opcoes.querySelectorAll(".resultado").forEach((li, i) => {
    li.setAttribute("aria-selected", String(i === ativo));
    if (i === ativo) li.scrollIntoView({ block: "nearest" });
  });
  if (ativo >= 0) el.busca.setAttribute("aria-activedescendant", `estoque-op-${ativo}`);
}

function escolher(r) {
  escolhido = r;
  el.idReagente.value = r.id;
  el.busca.classList.remove("is-invalid");
  abrirLista(false);

  const controle = r.instituicao_controladora
    ? `<div class="aviso-controle"><i class="bi bi-file-earmark-lock me-1"></i>Produto controlado: ${escapeHtml(r.instituicao_controladora)}.</div>`
    : "";
  el.escolhido.innerHTML = `
    <span class="nome">${escapeHtml(r.nome)}</span>
    <span class="dados">${dadosReagente(r)}</span>
    <button type="button" class="trocar" id="estoque-trocar" aria-label="Trocar o reagente ${escapeHtml(r.nome)}">Trocar</button>
    ${controle}`;
  el.escolhido.classList.remove("d-none");
  el.procura.classList.add("d-none");

  mostrarJaTem(r);

  // Primeiro frasco desse reagente já cadastrado define a unidade sugerida.
  if (!unidadeEscolhida()) {
    const existente = itensDoLab().find((i) => i.id_reagente === r.id);
    if (existente) marcarUnidade(existente.unidade_medida);
  }
}

function mostrarJaTem(r) {
  const itens = editando ? [] : itensDoLab().filter((i) => i.id_reagente === r.id);
  if (!itens.length) {
    el.jaTem.classList.add("d-none");
    el.jaTem.textContent = "";
    return;
  }
  const saldo = saldoNoLab(r.id);
  const onde =
    itens.length === 1 && itens[0].observacoes_operacionais
      ? `, em ${itens[0].observacoes_operacionais}`
      : "";
  el.jaTem.innerHTML =
    `<i class="bi bi-info-circle me-1"></i>Este laboratório já tem <strong>${escapeHtml(saldo)}</strong> ` +
    `de ${escapeHtml(r.nome)}${escapeHtml(onde)}. O novo frasco entra como um item separado.`;
  el.jaTem.classList.remove("d-none");
}

function trocar() {
  escolhido = null;
  el.idReagente.value = "";
  el.escolhido.classList.add("d-none");
  el.escolhido.innerHTML = "";
  el.jaTem.classList.add("d-none");
  el.procura.classList.remove("d-none");
  el.busca.value = "";
  el.busca.focus();
  renderResultados();
}

// ---------- Unidade ----------
function renderUnidades() {
  el.unidades.innerHTML = ORDEM_UNIDADES.map(
    (u) => `
      <input type="radio" name="estoque-unidade" id="estoque-unidade-${u}" value="${u}">
      <label for="estoque-unidade-${u}">${u}</label>`
  ).join("");
}

function unidadeEscolhida() {
  return el.unidades.querySelector("input:checked")?.value || "";
}

function marcarUnidade(u) {
  const radio = el.unidades.querySelector(`input[value="${CSS.escape(u || "")}"]`);
  if (radio) radio.checked = true;
  el.unidades.classList.remove("is-invalid");
}

// ---------- Validade ----------
function atualizarAvisoValidade() {
  const aviso = el.validadeAviso;
  aviso.className = "vence";
  aviso.textContent = "";
  if (el.semValidade.checked || !el.validade.value) return;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${el.validade.value}T00:00:00`);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias < 0) {
    aviso.classList.add("vencida");
    aviso.innerHTML = '<i class="bi bi-exclamation-octagon-fill me-1"></i>Essa data já passou.';
  } else if (dias < DIAS_AVISO_VALIDADE) {
    aviso.classList.add("breve");
    const texto = dias === 0 ? "Vence hoje." : `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}.`;
    aviso.innerHTML = `<i class="bi bi-hourglass-split me-1"></i>${texto}`;
  }
}

function alternarSemValidade() {
  el.validade.disabled = el.semValidade.checked;
  if (el.semValidade.checked) el.validade.value = "";
  atualizarAvisoValidade();
}

// ---------- Abrir, ler e validar ----------
function limpar() {
  escolhido = null;
  el.idReagente.value = "";
  el.busca.value = "";
  el.busca.classList.remove("is-invalid");
  el.escolhido.classList.add("d-none");
  el.escolhido.innerHTML = "";
  el.jaTem.classList.add("d-none");
  el.procura.classList.remove("d-none");
  abrirLista(false);
  el.quantidade.value = "";
  el.quantidade.classList.remove("is-invalid");
  el.unidades.querySelectorAll("input").forEach((r) => (r.checked = false));
  el.unidades.classList.remove("is-invalid");
  el.validade.value = "";
  el.semValidade.checked = false;
  el.validade.disabled = false;
  el.observacoes.value = "";
  atualizarAvisoValidade();
}

export function prepararNovo(nomeLab) {
  editando = false;
  limpar();
  el.titulo.textContent = "Novo item no estoque";
  el.lab.textContent = nomeLab || "";
  el.salvar.textContent = "Adicionar ao estoque";
}

export function prepararEdicao(
  nomeLab,
  { reagenteId, quantidade, unidade, validade, observacoes }
) {
  editando = true;
  limpar();
  el.titulo.textContent = "Editar item";
  el.lab.textContent = nomeLab || "";
  el.salvar.textContent = "Salvar alterações";
  const r = catalogo.find((x) => x.id === reagenteId);
  if (r) escolher(r);
  el.quantidade.value = quantidade;
  marcarUnidade(unidade);
  el.validade.value = validade || "";
  el.semValidade.checked = !validade;
  el.validade.disabled = !validade;
  el.observacoes.value = observacoes || "";
  atualizarAvisoValidade();
}

// Foco inicial ao abrir: a busca (novo) ou a quantidade (edição).
export function focarInicio() {
  (escolhido ? el.quantidade : el.busca).focus();
}

export function lerDados() {
  return {
    id_reagente: el.idReagente.value,
    quantidade: parseFloat(el.quantidade.value),
    unidade_medida: unidadeEscolhida(),
    data_validade: el.semValidade.checked ? null : el.validade.value || null,
    observacoes_operacionais: el.observacoes.value.trim() || null,
  };
}

// Marca os campos com problema e devolve a primeira mensagem (ou null).
export function validar(dados, qtdMax) {
  const erros = [];
  if (!dados.id_reagente) {
    el.busca.classList.add("is-invalid");
    erros.push([el.busca, "Escolha o reagente no catálogo."]);
  }
  if (!(dados.quantidade > 0) || dados.quantidade > qtdMax) {
    el.quantidade.classList.add("is-invalid");
    erros.push([
      el.quantidade,
      `Informe uma quantidade maior que zero e até ${qtdMax.toLocaleString("pt-BR")}.`,
    ]);
  }
  if (!UNIDADES.includes(dados.unidade_medida)) {
    el.unidades.classList.add("is-invalid");
    erros.push([el.unidades.querySelector("input"), "Escolha a unidade."]);
  }
  if (!erros.length) return null;
  erros[0][0]?.focus();
  return erros[0][1];
}

// ---------- Eventos ----------
renderUnidades();

el.busca.addEventListener("focus", renderResultados);
el.busca.addEventListener("input", renderResultados);
el.busca.addEventListener("blur", () => setTimeout(() => abrirLista(false), 120));
el.busca.addEventListener("keydown", (e) => {
  const total = Math.min(resultados.length, MAX_RESULTADOS);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    // Com a lista fechada, a seta só a abre (com o primeiro item ativo).
    if (el.resultados.classList.contains("d-none")) {
      renderResultados();
      return;
    }
    if (!total) return;
    ativo = (ativo + (e.key === "ArrowDown" ? 1 : -1) + total) % total;
    marcarAtivo();
  } else if (e.key === "Enter") {
    e.preventDefault(); // não envia o formulário enquanto escolhe
    if (ativo >= 0 && resultados[ativo]) {
      escolher(resultados[ativo]);
      el.quantidade.focus();
    }
  } else if (e.key === "Escape" && !el.resultados.classList.contains("d-none")) {
    e.stopPropagation(); // fecha só a lista, não o modal
    abrirLista(false);
  }
});

// mousedown (e não click) para escolher antes do blur fechar a lista
el.opcoes.addEventListener("mousedown", (e) => {
  const li = e.target.closest(".resultado");
  if (!li) return;
  e.preventDefault();
  escolher(resultados[Number(li.dataset.indice)]);
  el.quantidade.focus();
});

el.escolhido.addEventListener("click", (e) => {
  if (e.target.closest(".trocar")) trocar();
});

el.quantidade.addEventListener("input", () => el.quantidade.classList.remove("is-invalid"));
el.unidades.addEventListener("change", () => el.unidades.classList.remove("is-invalid"));
el.validade.addEventListener("input", atualizarAvisoValidade);
el.validade.addEventListener("change", atualizarAvisoValidade);
el.semValidade.addEventListener("change", alternarSemValidade);
