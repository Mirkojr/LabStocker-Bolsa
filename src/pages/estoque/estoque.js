import { getCurrentLabId } from "../../shared/sessionManager.js";
import { obterLaboratorioAtivo, aplicarPermissoes } from "../../shared/permissoes.js";
import { showToast } from "../../shared/utils/toast.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { UNIDADES } from "../../shared/constants.js";
import {
  excluirItemestoque,
  listarestoquePorlaboratorio,
  registrarMovimentacaoEntradaestoque,
  salvarItemestoque,
} from "../../shared/services/estoqueService.js";
import { listarreagentesParaestoque } from "../../shared/services/reagentesService.js";
import { registrarConsumo } from "../../shared/services/consumoService.js";
import { confirmar } from "../../shared/utils/confirmacao.js";
import { criarStepperQuantidade } from "../../shared/utils/quantityStepper.js";
import { formatarNumero, formatarQuantidade } from "../../shared/utils/formatters.js";
import {
  garantirContainerPaginador,
  paginarLista,
  renderPaginador,
  TAMANHO_PAGINA_PADRAO,
} from "../../shared/utils/paginacao.js";
// --- Seletores ---
const listaestoqueEl = document.getElementById("lista-estoque");
const formestoque = document.getElementById("form-estoque");
const inputBusca = document.getElementById("input-busca-estoque");
const filtroValidade = document.getElementById("filtro-validade-estoque");
const resumoEl = document.getElementById("resumo-estoque");
const filtroUnidade = document.getElementById("filtro-unidade-estoque");
const ordenarSelect = document.getElementById("ordenar-estoque");
const spinner = document.getElementById("loading-spinner-estoque");
const modalEl = document.getElementById("modal-estoque");
const modalestoque = new bootstrap.Modal(modalEl);

// Elementos do Form
const modalTitle = modalEl.querySelector(".modal-title-lab");
const modalSubmitBtn = formestoque.querySelector('button[type="submit"]');
const editIdInput = document.getElementById("estoque-edit-id");
const selectreagente = document.getElementById("estoque-reagente");
const quantidadeInput = document.getElementById("estoque-quantidade");
const unidadeInput = document.getElementById("estoque-unidade");
const validadeInput = document.getElementById("estoque-validade");
const observacoesInput = document.getElementById("estoque-observacoes");

// Elementos do modal de consumo
const modalConsumoEl = document.getElementById("modal-consumo");
const modalConsumo = new bootstrap.Modal(modalConsumoEl);
const formConsumo = document.getElementById("form-consumo");
const consumoItemIdInput = document.getElementById("consumo-item-id");
const consumoItemLabel = document.getElementById("consumo-item-label");
const consumoQuantidadeInput = document.getElementById("consumo-quantidade");
const consumoDisponivelEl = document.getElementById("consumo-disponivel");
const consumoFinalidadeInput = document.getElementById("consumo-finalidade");

// Steppers de quantidade (substituem as setinhas nativas do input number)
const stepperEstoque = criarStepperQuantidade(quantidadeInput.closest(".qty-stepper"), {
  passo: 1,
  min: 0.01,
  max: 1000000,
});
const stepperConsumo = criarStepperQuantidade(
  consumoQuantidadeInput.closest(".qty-stepper"),
  { passo: 1, min: 0.01, max: null } // max é definido dinamicamente ao abrir o modal
);

let ID_LAB_DO_USUARIO = null;
let ACOES_LAB = []; // ações permitidas no laboratório ativo (ver shared/permissoes.js)
let itensCache = []; // dados carregados do banco; filtros/ordenacao operam sobre ele
let itensFiltrados = []; // resultado dos filtros/ordenacao; paginado no cliente
let paginaAtualEstoque = 1;
let consumoQuantidadeDisponivel = 0; // saldo do item atualmente aberto no modal de consumo

// Container de paginacao (inserido logo abaixo da lista)
const paginadorEstoqueEl = garantirContainerPaginador(listaestoqueEl, "paginador-estoque");

// Preenche o <select> de unidades do FORM a partir da fonte única (constants.js)
function popularUnidadesForm() {
  if (!unidadeInput) return;
  unidadeInput.innerHTML =
    '<option value="" disabled selected>Selecione...</option>' +
    UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join("");
}

// Preenche o <select> de unidades do FILTRO
function popularUnidadesFiltro() {
  if (!filtroUnidade) return;
  filtroUnidade.innerHTML =
    '<option value="">Toda unidade</option>' +
    UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join("");
}

// ===============================================
// CLASSIFICAÇÃO DE VALIDADE (usada no filtro, no resumo e na lista)
// ===============================================
function diasParaVencer(item) {
  return Math.ceil((new Date(item.data_validade) - new Date()) / (1000 * 60 * 60 * 24));
}

function classificarValidade(item) {
  if (!item.data_validade) return "sem_data";
  const dias = diasParaVencer(item);
  if (dias < 0) return "vencido";
  if (dias < 30) return "vence_breve";
  return "no_prazo";
}

function estaEsgotado(item) {
  return Number(item.quantidade) <= 0;
}

// Situação usada no filtro: esgotado tem prioridade sobre a validade.
function atendeSituacao(item, situacao) {
  if (!situacao) return true;
  if (situacao === "esgotado") return estaEsgotado(item);
  return classificarValidade(item) === situacao;
}

// A validade só ganha cor quando pede ação: vencida (vermelho) ou vencendo
// em até 30 dias (ouro). No prazo é texto comum.
function montarValidade(item) {
  const status = classificarValidade(item);
  if (status === "sem_data") {
    return { html: '<span class="text-muted">Sem validade</span>', alerta: "" };
  }

  const data = new Date(item.data_validade).toLocaleDateString("pt-BR", { timeZone: "UTC" });

  if (status === "vencido") {
    return {
      html: `<span class="validade-vencida"><i class="bi bi-exclamation-octagon-fill me-1"></i>Venceu em ${data}</span>`,
      alerta: "alerta-vencido",
    };
  }
  if (status === "vence_breve") {
    const dias = diasParaVencer(item);
    const falta = dias <= 0 ? "vence hoje" : dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`;
    return {
      html: `<span class="validade-breve"><i class="bi bi-hourglass-split me-1"></i>${data} <small>(${falta})</small></span>`,
      alerta: "alerta-breve",
    };
  }
  return { html: `<span>${data}</span>`, alerta: "" };
}

// Resumo no topo: quantos frascos pedem atenção. Cada contagem é um atalho
// para o filtro de situação.
function renderResumo() {
  if (!resumoEl) return;
  const contar = (situacao) => itensCache.filter((i) => atendeSituacao(i, situacao)).length;
  const grupos = [
    {
      situacao: "vencido",
      n: contar("vencido"),
      um: "vencido",
      varios: "vencidos",
      icone: "bi-exclamation-octagon-fill",
      classe: "resumo-vencido",
    },
    {
      situacao: "vence_breve",
      n: contar("vence_breve"),
      um: "vence em até 30 dias",
      varios: "vencem em até 30 dias",
      icone: "bi-hourglass-split",
      classe: "resumo-breve",
    },
    {
      situacao: "esgotado",
      n: contar("esgotado"),
      um: "esgotado",
      varios: "esgotados",
      icone: "bi-slash-circle",
      classe: "resumo-esgotado",
    },
  ].filter((g) => g.n > 0);

  if (itensCache.length === 0) {
    resumoEl.innerHTML = "";
    return;
  }
  if (grupos.length === 0) {
    resumoEl.innerHTML =
      '<p class="resumo-ok mb-0"><i class="bi bi-check-circle me-1"></i>Nenhum frasco vencido, vencendo ou esgotado.</p>';
    return;
  }

  const ativo = filtroValidade.value;
  resumoEl.innerHTML = grupos
    .map(
      (
        g
      ) => `<button type="button" class="btn-resumo ${g.classe}" data-situacao="${g.situacao}" aria-pressed="${ativo === g.situacao}">
            <i class="bi ${g.icone}"></i> <strong>${g.n}</strong> ${g.n === 1 ? g.um : g.varios}
        </button>`
    )
    .join("");
}

// ===============================================
// CARGA + FILTROS + RENDER
// ===============================================
async function fetchestoque(labId) {
  spinner.classList.remove("d-none");
  listaestoqueEl.innerHTML = "";
  if (paginadorEstoqueEl) paginadorEstoqueEl.innerHTML = "";
  try {
    const { data, error } = await listarestoquePorlaboratorio(labId);
    if (error) throw error;
    itensCache = data || [];
    aplicarFiltrosERenderizar();
  } catch (error) {
    console.error("Erro:", error.message);
    showToast("Erro ao carregar estoque.", "error");
  } finally {
    spinner.classList.add("d-none");
  }
}

function aplicarFiltrosERenderizar() {
  renderResumo();
  const termo = inputBusca.value.trim().toLowerCase();
  const fValidade = filtroValidade.value; // '' = todas
  const fUnidade = filtroUnidade.value; // '' = todas
  const ordenar = ordenarSelect.value; // 'nome_asc' | 'nome_desc'

  itensFiltrados = itensCache
    .filter((item) => {
      const nome = item.reagente?.nome?.toLowerCase() || "";
      if (termo && !nome.includes(termo)) return false;
      if (!atendeSituacao(item, fValidade)) return false;
      if (fUnidade && item.unidade_medida !== fUnidade) return false;
      return true;
    })
    .sort((a, b) => {
      const na = a.reagente?.nome || "";
      const nb = b.reagente?.nome || "";
      return ordenar === "nome_desc"
        ? nb.localeCompare(na, "pt-BR")
        : na.localeCompare(nb, "pt-BR");
    });

  // Qualquer mudanca de filtro/busca/ordenacao volta para a primeira pagina.
  paginaAtualEstoque = 1;

  if (itensFiltrados.length === 0) {
    listaestoqueEl.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-box-seam text-muted" style="font-size: 3rem;"></i>
                <p class="text-muted mt-3">Nenhum item encontrado.</p>
            </div>`;
    if (paginadorEstoqueEl) paginadorEstoqueEl.innerHTML = "";
    return;
  }
  renderPaginaEstoque();
}

// Renderiza a pagina atual do resultado filtrado e atualiza o paginador.
function renderPaginaEstoque() {
  const itensPagina = paginarLista(itensFiltrados, paginaAtualEstoque, TAMANHO_PAGINA_PADRAO);
  renderestoque(itensPagina);
  renderPaginador(paginadorEstoqueEl, {
    paginaAtual: paginaAtualEstoque,
    totalItens: itensFiltrados.length,
    tamanhoPagina: TAMANHO_PAGINA_PADRAO,
    aoMudarPagina: (p) => {
      paginaAtualEstoque = p;
      renderPaginaEstoque();
      if (listaestoqueEl) listaestoqueEl.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
}

// Lista em colunas: Reagente, Quantidade, Validade e Ações. No celular as
// colunas viram linhas (ver .linha-estoque no style.css).
function renderestoque(itens) {
  listaestoqueEl.innerHTML = `
        <div class="linha-estoque linha-cabecalho" aria-hidden="true">
            <div>Reagente</div>
            <div class="le-quantidade">Quantidade</div>
            <div>Validade</div>
            <div class="le-acoes"></div>
        </div>`;

  itens.forEach((item) => {
    const { html: validadeHTML, alerta } = montarValidade(item);
    const nome = escapeHtml(item.reagente?.nome);
    const obs = escapeHtml(item.observacoes_operacionais || "");

    // Item zerado continua na lista (rastreabilidade do frasco), com o
    // consumo desativado.
    const esgotado = estaEsgotado(item);
    const classeAlerta = esgotado ? "alerta-esgotado" : alerta;

    const div = document.createElement("div");
    div.className = `linha-estoque ${classeAlerta}`;
    div.setAttribute("role", "listitem");
    div.innerHTML = `
            <div class="le-reagente">
                <div class="le-nome">${nome}</div>
                ${obs ? `<small class="text-muted d-block text-truncate" title="${obs}">${obs}</small>` : ""}
            </div>
            <div class="le-quantidade">
                <span class="le-qtd">${escapeHtml(formatarNumero(item.quantidade))}</span>
                <span class="le-unidade">${escapeHtml(item.unidade_medida)}</span>
                ${esgotado ? '<span class="badge bg-secondary ms-1">Esgotado</span>' : ""}
            </div>
            <div class="le-validade">${validadeHTML}</div>
            <div class="le-acoes">
                <button class="btn btn-sm btn-primary btn-consumir-estoque rounded-pill px-3" data-permissao="consumo.registrar"
                    data-id="${escapeHtml(item.id)}"
                    data-reagente="${nome}"
                    data-quantidade="${escapeHtml(item.quantidade)}"
                    data-unidade="${escapeHtml(item.unidade_medida)}"
                    aria-label="Consumir ${nome}"
                    ${esgotado ? 'disabled title="Item esgotado, sem saldo para consumir"' : ""}>
                    <i class="bi bi-eyedropper"></i> Consumir
                </button>
                <div class="dropdown" data-permissao="estoque.editar">
                    <button class="btn btn-sm btn-outline-secondary rounded-circle btn-mais" type="button"
                        data-bs-toggle="dropdown" aria-expanded="false" aria-label="Mais ações para ${nome}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <button class="dropdown-item btn-edit-estoque" type="button"
                                data-id="${escapeHtml(item.id)}"
                                data-reagente-id="${escapeHtml(item.id_reagente)}"
                                data-quantidade="${escapeHtml(item.quantidade)}"
                                data-unidade="${escapeHtml(item.unidade_medida)}"
                                data-validade="${escapeHtml(item.data_validade || "")}"
                                data-observacoes="${obs}">
                                <i class="bi bi-pencil me-2"></i>Editar
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item text-danger btn-delete-estoque" type="button" data-id="${escapeHtml(item.id)}">
                                <i class="bi bi-trash me-2"></i>Excluir
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    aplicarPermissoes(div, ACOES_LAB);
    listaestoqueEl.appendChild(div);
  });
}

async function fetchreagentesParaModal() {
  try {
    const { data, error } = await listarreagentesParaestoque();
    if (error) throw error;

    selectreagente.innerHTML =
      '<option value="" disabled selected>Selecione um reagente...</option>';
    data.forEach((reagente) => {
      const opt = document.createElement("option");
      opt.value = reagente.id;
      opt.textContent = reagente.nome;
      selectreagente.appendChild(opt);
    });
  } catch (error) {
    console.error("Erro:", error.message);
    showToast("Erro ao carregar lista de reagentes.", "error");
  }
}

async function handleFormSubmitestoque(evento) {
  evento.preventDefault();
  if (!ID_LAB_DO_USUARIO) {
    showToast("Sessão inválida. Recarregue a página.", "error");
    return;
  }

  const QTD_MAX = 1000000;
  const OBS_MAX = 500;

  const id = editIdInput.value;
  const dadosForm = {
    id_laboratorio: ID_LAB_DO_USUARIO,
    id_reagente: selectreagente.value,
    quantidade: parseFloat(quantidadeInput.value),
    unidade_medida: unidadeInput.value,
    data_validade: validadeInput.value || null,
    observacoes_operacionais: observacoesInput.value || null,
  };

  // Validações (defesa no cliente; o banco também garante via CHECK)
  if (!(dadosForm.quantidade > 0) || dadosForm.quantidade > QTD_MAX) {
    showToast(
      `Quantidade deve ser maior que zero e até ${QTD_MAX.toLocaleString("pt-BR")}.`,
      "error"
    );
    return;
  }
  if (!UNIDADES.includes(dadosForm.unidade_medida)) {
    showToast("Selecione uma unidade válida.", "error");
    return;
  }
  if (dadosForm.observacoes_operacionais && dadosForm.observacoes_operacionais.length > OBS_MAX) {
    showToast(`As observações devem ter no máximo ${OBS_MAX} caracteres.`, "error");
    return;
  }

  try {
    const { error } = id
      ? await salvarItemestoque(id, dadosForm)
      : await salvarItemestoque(null, dadosForm);
    if (error) throw error;

    if (!id) {
      const nomereagente = selectreagente.options[selectreagente.selectedIndex].text;
      const { error: erroMov } = await registrarMovimentacaoEntradaestoque({
        id_laboratorio: ID_LAB_DO_USUARIO,
        tipo: "ENTRADA",
        item_nome: nomereagente,
        quantidade: dadosForm.quantidade,
        unidade: dadosForm.unidade_medida,
        observacao: "Cadastro inicial no estoque",
      });
      if (erroMov) {
        console.error("Falha ao registrar movimentação de entrada:", erroMov.message);
        showToast("Item salvo, mas a entrada não foi registrada no histórico.", "warning");
      }
    }

    showToast(id ? "Item atualizado com sucesso!" : "Item adicionado ao estoque!", "success");
    modalestoque.hide();
    fetchestoque(ID_LAB_DO_USUARIO); // recarrega o cache
  } catch (error) {
    console.error("Erro:", error.message);
    showToast("Falha ao salvar: " + error.message, "error");
  }
}

function handleEditClickestoque(button) {
  const { id, reagenteId, quantidade, unidade, validade, observacoes } = button.dataset;
  editIdInput.value = id;
  selectreagente.value = reagenteId;
  quantidadeInput.value = quantidade;
  unidadeInput.value = unidade;
  validadeInput.value = validade;
  observacoesInput.value = observacoes;
  stepperEstoque?.atualizarEstadoBotoes();
  modalTitle.textContent = "Editar item";
  modalSubmitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Salvar alterações';
  modalestoque.show();
}
async function handleDeleteClickestoque(button) {
  const id = button.dataset.id;
  const ok = await confirmar({
    titulo: "Excluir item",
    mensagem:
      "Tem certeza que deseja excluir este item do estoque? Esta ação não pode ser desfeita.",
    textoConfirmar: "Excluir",
    tipo: "danger",
    icone: "bi-trash-fill",
  });
  if (!ok) return;

  try {
    const { error } = await excluirItemestoque(id);
    if (error) throw error;
    showToast("Item removido do estoque.", "warning");
    fetchestoque(ID_LAB_DO_USUARIO); // recarrega o cache
  } catch (error) {
    showToast("Erro ao excluir: " + error.message, "error");
  }
}

function resetModalestoque() {
  formestoque.reset();
  editIdInput.value = "";
  modalTitle.textContent = "Adicionar item ao estoque";
  modalSubmitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Salvar';
  selectreagente.value = "";
  unidadeInput.value = "";
  stepperEstoque?.atualizarEstadoBotoes();
}

// ===============================================
// CONSUMO DE REAGENTES
// ===============================================

// Abre o modal de consumo pré-preenchido com os dados do item clicado.
function handleConsumirClick(button) {
  const { id, reagente, quantidade, unidade } = button.dataset;
  formConsumo.reset();
  consumoItemIdInput.value = id;
  consumoItemLabel.textContent = reagente;
  consumoDisponivelEl.textContent = `Disponível: ${formatarQuantidade(quantidade, unidade)}`;
  consumoQuantidadeDisponivel = parseFloat(quantidade) || 0;
  stepperConsumo?.setLimites(0.01, consumoQuantidadeDisponivel);
  modalConsumo.show();
}

// Envia o consumo (RPC atômica: debita estoque + grava quem/quanto/quando)
// e, em seguida, pergunta se o usuário quer cadastrar o resíduo gerado.
async function handleFormSubmitConsumo(evento) {
  evento.preventDefault();

  const idItem = consumoItemIdInput.value;
  const quantidade = parseFloat(consumoQuantidadeInput.value);
  const finalidade = consumoFinalidadeInput.value.trim() || null;
  // Lido antes de fechar o modal: ao fechar, o rótulo é limpo (resetModalConsumo)
  const nomeReagente = consumoItemLabel.textContent;

  if (!(quantidade > 0)) {
    showToast("Informe uma quantidade válida.", "error");
    return;
  }
  if (quantidade > consumoQuantidadeDisponivel) {
    showToast(
      `Quantidade maior que o disponível (${formatarNumero(consumoQuantidadeDisponivel)}).`,
      "error"
    );
    return;
  }

  try {
    const { data: consumo, error } = await registrarConsumo(idItem, quantidade, finalidade);
    if (error) throw error;

    modalConsumo.hide();
    showToast("Consumo registrado com sucesso!", "success");
    fetchestoque(ID_LAB_DO_USUARIO); // recarrega o estoque com o saldo atualizado

    const desejaResiduo = await confirmar({
      titulo: "Registrar resíduo?",
      mensagem: "Deseja cadastrar o resíduo gerado por esse consumo agora?",
      textoConfirmar: "Sim, cadastrar",
      textoCancelar: "Agora não",
      tipo: "success",
      icone: "bi-recycle",
    });

    if (desejaResiduo) {
      const params = new URLSearchParams({
        consumo_id: consumo.id,
        reagente: nomeReagente,
        quantidade: consumo.quantidade,
        unidade: consumo.unidade_medida,
      });
      window.location.href = `../residuos/residuos.html?${params.toString()}`;
    }
  } catch (error) {
    console.error("Erro ao registrar consumo:", error.message);
    showToast("Falha ao registrar consumo: " + error.message, "error");
  }
}

function resetModalConsumo() {
  formConsumo.reset();
  consumoItemIdInput.value = "";
  consumoItemLabel.textContent = "—";
  consumoDisponivelEl.textContent = "";
  consumoQuantidadeDisponivel = 0;
  stepperConsumo?.setLimites(0.01, null);
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  popularUnidadesForm();
  popularUnidadesFiltro();

  ID_LAB_DO_USUARIO = await getCurrentLabId();
  ACOES_LAB = (await obterLaboratorioAtivo())?.acoes || [];
  aplicarPermissoes(document.body, ACOES_LAB);
  if (ID_LAB_DO_USUARIO) {
    fetchestoque(ID_LAB_DO_USUARIO);
    fetchreagentesParaModal();
  } else {
    showToast(
      "Você ainda não tem vínculo com nenhum laboratório. Peça ao chefe para adicionar você.",
      "warning"
    );
  }
});

formestoque.addEventListener("submit", handleFormSubmitestoque);
formConsumo.addEventListener("submit", handleFormSubmitConsumo);

// Busca, filtros e ordenação operam sobre o cache (sem novas consultas ao banco)
inputBusca.addEventListener("input", aplicarFiltrosERenderizar);
filtroValidade.addEventListener("change", aplicarFiltrosERenderizar);
filtroUnidade.addEventListener("change", aplicarFiltrosERenderizar);
ordenarSelect.addEventListener("change", aplicarFiltrosERenderizar);

// Atalhos do resumo: aplicam (ou tiram, se já ativo) o filtro de situação.
resumoEl?.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-resumo");
  if (!btn) return;
  const situacao = btn.dataset.situacao;
  filtroValidade.value = filtroValidade.value === situacao ? "" : situacao;
  aplicarFiltrosERenderizar();
});

listaestoqueEl.addEventListener("click", (e) => {
  const btnEdit = e.target.closest(".btn-edit-estoque");
  const btnDelete = e.target.closest(".btn-delete-estoque");
  const btnConsumir = e.target.closest(".btn-consumir-estoque");
  if (btnEdit) handleEditClickestoque(btnEdit);
  if (btnDelete) handleDeleteClickestoque(btnDelete);
  if (btnConsumir && !btnConsumir.disabled) handleConsumirClick(btnConsumir);
});

modalEl.addEventListener("hidden.bs.modal", resetModalestoque);
modalConsumoEl.addEventListener("hidden.bs.modal", resetModalConsumo);
