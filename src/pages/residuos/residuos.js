import { getCurrentLabId } from "../../shared/sessionManager.js";
import { obterLaboratorioAtivo, aplicarPermissoes } from "../../shared/permissoes.js";
import { showToast } from "../../shared/utils/toast.js";
import { mostrarCarregando, mostrarVazio, mostrarErro } from "../../shared/utils/estados.js";
import { confirmar } from "../../shared/utils/confirmacao.js";
import { UNIDADES } from "../../shared/constants.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import {
  formatarQuantidade,
  formatarStatusResiduo,
  formatarTipoPerigo,
} from "../../shared/utils/formatters.js";
import {
  listarResiduosPorLaboratorio,
  salvarResiduo,
  atualizarStatusResiduo,
} from "../../shared/services/residuosService.js";
import { criarStepperQuantidade } from "../../shared/utils/quantityStepper.js";
import {
  garantirContainerPaginador,
  renderPaginador,
  TAMANHO_PAGINA_PADRAO,
} from "../../shared/utils/paginacao.js";

// --- Seletores de Elementos ---
const listaresiduos = document.getElementById("lista-residuos");
const formresiduo = document.getElementById("form-residuo");
const modalEl = document.getElementById("modal-residuo");
const modalresiduo = new bootstrap.Modal(modalEl);

const editIdInput = document.getElementById("edit-residuo-id");
const descInput = document.getElementById("res-descricao");
const tipoInput = document.getElementById("res-tipo");
const qtdInput = document.getElementById("res-qtd");
const unidadeInput = document.getElementById("res-unidade");
const modalTitle = modalEl.querySelector(".modal-title-lab");
const modalSubmitBtn = formresiduo.querySelector('button[type="submit"]');
const btnNovoresiduo = document.querySelector('[data-bs-target="#modal-residuo"]');

// Stepper de quantidade (substitui as setinhas nativas do input number)
const stepperResiduo = criarStepperQuantidade(qtdInput.closest(".qty-stepper"), {
  passo: 1,
  min: 0.01,
  max: null,
});

let MEU_LAB_ID = null;
let ACOES_LAB = []; // ações permitidas no laboratório ativo (ver shared/permissoes.js)

// Quando o usuário vem da tela de estoque logo após um consumo, a URL traz
// ?consumo_id=...&reagente=...&quantidade=...&unidade=... Isso permite
// vincular o resíduo ao consumo de origem (rastreabilidade).
// O vínculo vale só para o primeiro formulário aberto a partir do consumo:
// é limpo quando esse modal fecha (salvando ou cancelando).
const paramsUrl = new URLSearchParams(window.location.search);
let consumoIdPendente = paramsUrl.get("consumo_id");

// Estado e container de paginação
let paginaAtualResiduos = 1;
const paginadorResiduosEl = garantirContainerPaginador(listaresiduos, "paginador-residuos");

// Preenche o <select> de unidades a partir da fonte única (constants.js)
function popularUnidades() {
  if (!unidadeInput) return;
  unidadeInput.innerHTML =
    '<option value="" disabled selected>Selecione...</option>' +
    UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join("");
}

// Registros antigos podem ter unidade em texto livre ("Kg", "litros") que não
// está em UNIDADES. Inclui a unidade como opção para o <select> não ficar vazio.
function selecionarUnidade(valor) {
  const unidade = (valor || "").trim();
  if (unidade && ![...unidadeInput.options].some((opcao) => opcao.value === unidade)) {
    unidadeInput.add(new Option(unidade, unidade));
  }
  unidadeInput.value = unidade;
}

// ===============================================
// LOGICA DE INICIALIZACAO
// ===============================================

async function init() {
  popularUnidades();

  try {
    MEU_LAB_ID = await getCurrentLabId();
    ACOES_LAB = (await obterLaboratorioAtivo())?.acoes || [];
    aplicarPermissoes(document.body, ACOES_LAB);

    if (MEU_LAB_ID) {
      await fetchresiduos();
      if (ACOES_LAB.includes("residuo.registrar")) abrirModalViaConsumoSeNecessario();
    } else {
      mostrarVazio(listaresiduos, {
        icone: "bi-exclamation-triangle",
        titulo: "Sem laboratório",
        mensagem:
          "Você ainda não tem vínculo com nenhum laboratório. Peça ao chefe para adicionar você.",
      });
    }
  } catch (error) {
    console.error("Erro no init:", error);
    mostrarErro(listaresiduos, {
      mensagem: "Erro ao carregar os dados da sessão.",
      onTentarNovamente: init,
    });
  }
}

// Se veio de um consumo (via query string), abre o modal já pré-preenchido
// com reagente/quantidade/unidade daquele consumo.
function abrirModalViaConsumoSeNecessario() {
  if (!consumoIdPendente) return;

  // Tira os parâmetros da URL para que recarregar a página não reabra o formulário
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);

  formresiduo.reset();
  editIdInput.value = "";
  descInput.value = `Resíduo de ${paramsUrl.get("reagente") || ""}`.trim();
  qtdInput.value = paramsUrl.get("quantidade") || "";
  selecionarUnidade(paramsUrl.get("unidade"));
  stepperResiduo?.atualizarEstadoBotoes();

  modalTitle.textContent = "Registrar resíduo do consumo";
  modalSubmitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Registrar';
  modalresiduo.show();
}

async function fetchresiduos(pagina = 1) {
  paginaAtualResiduos = pagina;
  mostrarCarregando(listaresiduos, "Carregando resíduos...");
  if (paginadorResiduosEl) paginadorResiduosEl.innerHTML = "";

  try {
    const { data, error, count } = await listarResiduosPorLaboratorio(MEU_LAB_ID, {
      pagina,
      tamanho: TAMANHO_PAGINA_PADRAO,
    });
    if (error) throw error;
    renderresiduos(data);
    renderPaginador(paginadorResiduosEl, {
      paginaAtual: pagina,
      totalItens: count || 0,
      tamanhoPagina: TAMANHO_PAGINA_PADRAO,
      aoMudarPagina: (p) => fetchresiduos(p),
    });
  } catch (error) {
    console.error("Erro ao buscar residuos:", error.message);
    mostrarErro(listaresiduos, {
      mensagem: "Não foi possível carregar os resíduos.",
      onTentarNovamente: () => fetchresiduos(paginaAtualResiduos),
    });
  }
}

/**
 * Renderiza os cards de residuos seguindo o padrao Dark Glass
 */
function renderresiduos(residuos) {
  if (residuos.length === 0) {
    mostrarVazio(listaresiduos, {
      icone: "bi-recycle",
      titulo: "Nenhum resíduo registrado",
      mensagem: "Os resíduos registrados neste laboratório aparecem aqui.",
    });
    return;
  }

  // Limpa qualquer estado anterior (ex.: spinner) antes de renderizar os cards.
  listaresiduos.innerHTML = "";

  residuos.forEach((res) => {
    const isAberto = res.status === "Em Aberto";
    const statusClass = isAberto ? "bg-warning text-dark" : "bg-success text-white";
    const dataF = new Date(res.data_criacao).toLocaleDateString("pt-BR");

    // Badge extra indicando que o resíduo veio de um consumo rastreado
    const badgeConsumo = res.id_consumo
      ? '<span class="badge bg-info text-dark rounded-pill px-2 ms-1"><i class="bi bi-link-45deg"></i> Vinculado a consumo</span>'
      : "";

    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    col.innerHTML = `
            <div class="card h-100 border-white border-opacity-10 shadow-sm rounded-4 overflow-hidden" style="background: rgba(255,255,255,0.03);">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <span class="badge ${statusClass} rounded-pill px-3">${escapeHtml(formatarStatusResiduo(res.status))}</span>
                        <small class="text-muted-light">${dataF}</small>
                    </div>
                    <h5 class="fw-bold text-white mb-2">${escapeHtml(res.descricao)}</h5>
                    <p class="small text-muted-light mb-2">
                        <i class="bi bi-shield-exclamation me-1"></i> ${escapeHtml(formatarTipoPerigo(res.tipo_perigo))} | 
                        <strong>${escapeHtml(formatarQuantidade(res.quantidade, res.unidade_medida))}</strong>
                    </p>
                    ${badgeConsumo ? `<p class="mb-3">${badgeConsumo}</p>` : '<div class="mb-3"></div>'}
                    
                    <div class="d-flex gap-2 border-top border-white border-opacity-10 pt-3" data-permissao="residuo.registrar">
                        ${
                          isAberto
                            ? `
                            <button class="btn btn-sm btn-outline-info rounded-pill flex-grow-1 btn-editar" 
                                data-id="${escapeHtml(res.id)}" data-desc="${escapeHtml(res.descricao)}" data-tipo="${escapeHtml(res.tipo_perigo)}" 
                                data-qtd="${escapeHtml(res.quantidade)}" data-unidade="${escapeHtml(res.unidade_medida)}">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-sm btn-success rounded-pill px-3 btn-descartar" data-id="${escapeHtml(res.id)}">
                                <i class="bi bi-check-lg"></i> Descartar
                            </button>
                        `
                            : `
                            <button class="btn btn-sm btn-outline-secondary rounded-pill flex-grow-1 btn-reabrir" data-id="${escapeHtml(res.id)}">
                                <i class="bi bi-arrow-counterclockwise"></i> Reabrir
                            </button>
                        `
                        }
                    </div>
                </div>
            </div>
        `;
    aplicarPermissoes(col, ACOES_LAB);
    listaresiduos.appendChild(col);
  });
}

// ===============================================
// FORMULARIO E ACOES (CRUD)
// ===============================================

function handleEditClick(btn) {
  const d = btn.dataset;
  editIdInput.value = d.id;
  descInput.value = d.desc;
  tipoInput.value = d.tipo;
  qtdInput.value = d.qtd;
  selecionarUnidade(d.unidade);
  stepperResiduo?.atualizarEstadoBotoes();

  modalTitle.textContent = "Editar registro de resíduo";
  modalSubmitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Atualizar registro';
  modalresiduo.show();
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const DESC_MAX = 200;
  const QTD_MAX = 1000000;

  const descricao = descInput.value.trim();
  const tipo = tipoInput.value;
  const quantidade = parseFloat(qtdInput.value);
  const unidade = unidadeInput.value.trim();

  // Validacoes no cliente (mesmo padrao do estoque: toast + bloqueia o envio).
  if (!descricao) {
    showToast("Informe a descrição do material.", "error");
    return;
  }
  if (descricao.length > DESC_MAX) {
    showToast(`A descrição deve ter no máximo ${DESC_MAX} caracteres.`, "error");
    return;
  }
  if (!tipo) {
    showToast("Selecione o tipo de perigo.", "error");
    return;
  }
  if (!(quantidade > 0) || quantidade > QTD_MAX) {
    showToast(
      `A quantidade deve ser maior que zero e até ${QTD_MAX.toLocaleString("pt-BR")}.`,
      "error"
    );
    return;
  }
  if (!unidade) {
    showToast("Selecione a unidade de medida.", "error");
    return;
  }

  const id = editIdInput.value;
  const payload = {
    id_laboratorio: MEU_LAB_ID,
    descricao,
    tipo_perigo: tipo,
    quantidade,
    unidade_medida: unidade,
  };

  try {
    // Em novos registros definimos o status inicial; edicoes preservam o status atual
    if (!id) {
      payload.status = "Em Aberto";
      // Vincula o resíduo ao consumo de origem, quando aplicável.
      // Em edições o campo não é enviado, para não apagar um vínculo existente.
      if (consumoIdPendente) payload.id_consumo = consumoIdPendente;
    }

    const { error } = await salvarResiduo(id, payload);
    if (error) throw error;

    showToast(id ? "Registro atualizado." : "Resíduo registrado.", "success");
    modalresiduo.hide();
    fetchresiduos();
  } catch (error) {
    console.error("Erro ao salvar:", error.message);
    showToast("Erro ao salvar dados: " + error.message, "error");
  }
}

async function atualizarStatus(id, novoStatus) {
  let titulo = "Confirmar alteração";
  let mensagem = `Deseja alterar o status para: ${formatarStatusResiduo(novoStatus)}?`;
  let tipo = "primary";
  let icone = "bi-question-circle-fill";

  if (novoStatus === "Em Aberto") {
    titulo = "Reabrir frasco";
    mensagem = "Ele volta a aparecer como descarte pendente.";
    tipo = "secondary";
    icone = "bi-arrow-counterclockwise";
  }
  if (novoStatus === "Descartado") {
    titulo = "Confirmar descarte";
    mensagem = "Esta ação encerra o controle deste resíduo.";
    tipo = "success";
    icone = "bi-check-circle-fill";
  }

  const ok = await confirmar({ titulo, mensagem, textoConfirmar: "Confirmar", tipo, icone });
  if (!ok) return;

  try {
    const { error } = await atualizarStatusResiduo(id, novoStatus);
    if (error) throw error;

    showToast(novoStatus === "Descartado" ? "Resíduo descartado." : "Resíduo reaberto.", "success");
    fetchresiduos();
  } catch (error) {
    console.error("Erro ao atualizar status:", error.message);
    showToast("Erro na atualização: " + error.message, "error");
  }
}

function resetModalResiduo() {
  consumoIdPendente = null;
  popularUnidades(); // remove unidades antigas incluídas por selecionarUnidade
  formresiduo.reset();
  editIdInput.value = "";
  modalTitle.textContent = "Registrar resíduo";
  modalSubmitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Salvar registro';
  stepperResiduo?.atualizarEstadoBotoes();
}

// ===============================================
// EVENTOS E INICIALIZACAO
// ===============================================

document.addEventListener("DOMContentLoaded", init);
formresiduo.addEventListener("submit", handleFormSubmit);

if (btnNovoresiduo) {
  btnNovoresiduo.addEventListener("click", () => {
    formresiduo.reset();
    editIdInput.value = "";
    modalTitle.textContent = "Registrar resíduo";
    modalSubmitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Salvar registro';
  });
}

listaresiduos.addEventListener("click", (e) => {
  const btnEdit = e.target.closest(".btn-editar");
  if (btnEdit) handleEditClick(btnEdit);

  const btnReabrir = e.target.closest(".btn-reabrir");
  if (btnReabrir) {
    atualizarStatus(btnReabrir.dataset.id, "Em Aberto");
  }

  const btnDescartar = e.target.closest(".btn-descartar");
  if (btnDescartar) {
    atualizarStatus(btnDescartar.dataset.id, "Descartado");
  }
});

modalEl.addEventListener("hidden.bs.modal", resetModalResiduo);
