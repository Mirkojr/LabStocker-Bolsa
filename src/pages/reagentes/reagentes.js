import { showToast } from "../../shared/utils/toast.js";
import { podeGlobal } from "../../shared/permissoes.js";
import {
  excluirreagente,
  listarreagentes,
  salvarreagente,
} from "../../shared/services/reagentesService.js";
import { formatarFormulaQuimica } from "../../shared/utils/formatters.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import {
  garantirContainerPaginador,
  renderPaginador,
  TAMANHO_PAGINA_PADRAO,
} from "../../shared/utils/paginacao.js";

// --- Seletores de Elementos ---
const listareagentesEl = document.getElementById("lista-reagentes");
const formreagente = document.getElementById("form-reagente");
const inputBusca = document.getElementById("input-busca");
const spinner = document.getElementById("loading-spinner");
const btnCadastrar = document.querySelector('[data-bs-target="#modal-reagente"]');

// Container do paginador (inserido logo abaixo da lista)
const paginadorEl = garantirContainerPaginador(listareagentesEl, "paginador-reagentes");

// Modais
const modalEl = document.getElementById("modal-reagente");
const modalreagente = new bootstrap.Modal(modalEl);

const modalConfirmEl = document.getElementById("modal-confirmacao");
const modalConfirmacao = new bootstrap.Modal(modalConfirmEl);
const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao");

// Elementos do Form
const modalTitle = modalEl.querySelector(".modal-title");
const modalSubmitBtn = formreagente.querySelector('button[type="submit"]');
const editIdInput = document.getElementById("reagente-edit-id");
const nomeInput = document.getElementById("reagente-nome");
const composicaoInput = document.getElementById("reagente-composicao");
const controladoraInput = document.getElementById("reagente-controladora");

// Variável para armazenar o ID temporariamente antes de excluir
let ID_PARA_EXCLUIR = null;

// Estado de paginação e busca
let filtroAtual = "";

// Editar e excluir entradas do catálogo é restrito a chefes e admins (RLS
// no banco). Os botões só aparecem para quem pode usá-los.
let POSSO_EDITAR = false;

async function fetchreagentes(filtroNome = "", pagina = 1) {
  filtroAtual = filtroNome;

  spinner.classList.remove("d-none");
  listareagentesEl.innerHTML = "";
  if (paginadorEl) paginadorEl.innerHTML = "";

  try {
    const { data, error, count } = await listarreagentes(filtroNome, {
      pagina,
      tamanho: TAMANHO_PAGINA_PADRAO,
    });
    if (error) throw error;

    if (!data || data.length === 0) {
      listareagentesEl.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-eyedropper text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3">Nenhum reagente encontrado no catálogo.</p>
                </div>`;
      return;
    }

    renderreagentes(data);
    renderPaginador(paginadorEl, {
      paginaAtual: pagina,
      totalItens: count || 0,
      tamanhoPagina: TAMANHO_PAGINA_PADRAO,
      aoMudarPagina: (p) => fetchreagentes(filtroAtual, p),
    });
  } catch (error) {
    console.error("Erro:", error.message);
    showToast("Erro ao carregar reagentes.", "error");
  } finally {
    spinner.classList.add("d-none");
  }
}

function renderreagentes(reagentes) {
  listareagentesEl.innerHTML = "";

  reagentes.forEach((reagente) => {
    // Controle é regra de compra, não risco químico: marca neutra, e nada
    // quando o reagente não é controlado.
    const nome = escapeHtml(reagente.nome);
    const badgeControlado = reagente.instituicao_controladora
      ? `<span class="badge text-primary-emphasis bg-primary-subtle border border-primary-subtle fw-semibold">
                    <i class="bi bi-file-earmark-lock me-1"></i>Controlado: ${escapeHtml(reagente.instituicao_controladora)}
                </span>`
      : "";

    const div = document.createElement("div");
    div.className = "list-group-item p-3 mb-2 shadow-sm rounded border-0";

    div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="bg-light rounded-circle p-3 me-3 text-success d-none d-md-block">
                        <i class="bi bi-eyedropper fs-4"></i>
                    </div>
                    <div>
                        <h5 class="mb-1 fw-bold text-dark">
                            ${nome}
                        </h5>
                        <p class="mb-1 text-muted small">
                            ${formatarFormulaQuimica(reagente.composicao_quimica) || '<span class="text-muted opacity-50">Sem fórmula</span>'}
                        </p>
                        ${badgeControlado ? `<div class="mt-1">${badgeControlado}</div>` : ""}
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-edit rounded-start-pill px-3" 
                        data-id="${escapeHtml(reagente.id)}"
                        data-nome="${nome}"
                        data-composicao="${escapeHtml(reagente.composicao_quimica || "")}"
                        data-controladora="${escapeHtml(reagente.instituicao_controladora || "")}"
                        aria-label="Editar ${nome}">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-delete rounded-end-pill px-3" data-id="${escapeHtml(reagente.id)}" aria-label="Excluir ${nome}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </div>
        `;
    if (!POSSO_EDITAR) div.querySelector(".btn-group")?.remove();
    listareagentesEl.appendChild(div);
  });
}

// --- CADASTRO E EDIÇÃO ---
async function handleFormSubmit(evento) {
  evento.preventDefault();

  const id = editIdInput.value;
  const dadosForm = {
    nome: nomeInput.value,
    composicao_quimica: composicaoInput.value,
    instituicao_controladora: controladoraInput.value || null,
  };

  try {
    const { error } = await salvarreagente(id || null, dadosForm);
    if (error) throw error;

    showToast(id ? "Reagente atualizado." : "Reagente cadastrado.", "success");
    modalreagente.hide();
    fetchreagentes(inputBusca.value, 1);
  } catch (error) {
    console.error("Erro:", error.message);
    showToast("Erro ao salvar: " + error.message, "error");
  }
}

// --- CLIQUE BOTÃO EDITAR ---
function handleEditClick(button) {
  const { id, nome, composicao, controladora } = button.dataset;

  editIdInput.value = id;
  nomeInput.value = nome;
  composicaoInput.value = composicao;
  controladoraInput.value = controladora;

  modalTitle.textContent = "Editar reagente";
  modalSubmitBtn.textContent = "Atualizar";

  modalreagente.show();
}

// --- CLIQUE BOTÃO EXCLUIR (ABRE O MODAL) ---
function handleDeleteClick(button) {
  ID_PARA_EXCLUIR = button.dataset.id; // Guarda o ID na variável global
  modalConfirmacao.show(); // Mostra o modal bonito
}

// --- AÇÃO REAL DE EXCLUIR (NO MODAL) ---
btnConfirmarExclusao.addEventListener("click", async () => {
  if (!ID_PARA_EXCLUIR) return;

  // Fecha o modal imediatamente
  modalConfirmacao.hide();

  try {
    const { error } = await excluirreagente(ID_PARA_EXCLUIR);

    if (error) {
      // Tratamento de erro de chave estrangeira (FK)
      if (error.code === "23503") {
        showToast("Não é possível excluir: reagente em uso no estoque.", "warning");
        return;
      }
      throw error;
    }

    showToast("Reagente excluído.", "success");
    fetchreagentes(inputBusca.value, 1);
  } catch (error) {
    showToast("Erro ao excluir: " + error.message, "error");
  } finally {
    ID_PARA_EXCLUIR = null; // Limpa o ID
  }
});

function resetModal() {
  formreagente.reset();
  editIdInput.value = "";
  modalTitle.textContent = "Cadastrar reagente";
  modalSubmitBtn.textContent = "Salvar";
}

// --- Listeners de Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  const [podeEditar, podeCadastrar] = await Promise.all([
    podeGlobal("reagente.editar"),
    podeGlobal("reagente.cadastrar"),
  ]);
  POSSO_EDITAR = podeEditar;
  if (!podeCadastrar) btnCadastrar?.remove();
  fetchreagentes();
});

formreagente.addEventListener("submit", handleFormSubmit);

let debounceTimer;
inputBusca.addEventListener("keyup", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchreagentes(inputBusca.value, 1);
  }, 300);
});

listareagentesEl.addEventListener("click", (e) => {
  const btnEdit = e.target.closest(".btn-edit");
  const btnDelete = e.target.closest(".btn-delete");

  if (btnEdit) handleEditClick(btnEdit);
  if (btnDelete) handleDeleteClick(btnDelete);
});

if (btnCadastrar) {
  btnCadastrar.addEventListener("click", resetModal);
}
modalEl.addEventListener("hidden.bs.modal", resetModal);
