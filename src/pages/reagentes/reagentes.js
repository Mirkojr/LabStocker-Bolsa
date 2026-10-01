import { showToast } from "../../shared/utils/toast.js";
import { podeGlobal } from "../../shared/permissoes.js";
import {
  excluirreagente,
  listarreagentes,
  salvarreagente,
} from "../../shared/services/reagentesService.js";
import { formatarFormulaQuimica } from "../../shared/utils/formatters.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { validarCAS } from "../../shared/utils/validators.js";
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
const casInput = document.getElementById("reagente-cas");
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

// Lista em colunas: Nome, Fórmula, Controle e Ações. No celular as colunas
// viram linhas (ver .linha-reagente no style.css).
function renderreagentes(reagentes) {
  listareagentesEl.innerHTML = `
        <div class="linha-reagente linha-cabecalho" aria-hidden="true">
            <div>Reagente</div>
            <div>Fórmula</div>
            <div>Controle</div>
            <div></div>
        </div>`;

  reagentes.forEach((reagente) => {
    const nome = escapeHtml(reagente.nome);
    const formula = formatarFormulaQuimica(reagente.composicao_quimica);
    const cas = escapeHtml(reagente.numero_cas || "");
    // Controle é regra de compra, não risco químico: marca neutra, e a coluna
    // fica vazia quando o reagente não é controlado.
    const controle = reagente.instituicao_controladora
      ? `<span class="controle-reagente"><i class="bi bi-file-earmark-lock"></i>${escapeHtml(reagente.instituicao_controladora)}</span>`
      : "";

    const div = document.createElement("div");
    div.className = "linha-reagente";
    div.setAttribute("role", "listitem");
    div.innerHTML = `
            <div class="lr-nome">
                <div class="le-nome">${nome}</div>
                ${cas ? `<small class="text-muted d-block">CAS ${cas}</small>` : ""}
            </div>
            <div class="lr-formula">${formula || '<span class="text-muted">Sem fórmula</span>'}</div>
            <div class="lr-controle">${controle}</div>
            <div class="lr-acoes le-acoes">
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle btn-mais btn-edit"
                    data-id="${escapeHtml(reagente.id)}"
                    data-nome="${nome}"
                    data-cas="${cas}"
                    data-composicao="${escapeHtml(reagente.composicao_quimica || "")}"
                    data-controladora="${escapeHtml(reagente.instituicao_controladora || "")}"
                    title="Editar" aria-label="Editar ${nome}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger rounded-circle btn-mais btn-delete"
                    data-id="${escapeHtml(reagente.id)}" title="Excluir" aria-label="Excluir ${nome}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    if (!POSSO_EDITAR) div.querySelector(".lr-acoes").innerHTML = "";
    listareagentesEl.appendChild(div);
  });
}

// --- CADASTRO E EDIÇÃO ---
async function handleFormSubmit(evento) {
  evento.preventDefault();

  const id = editIdInput.value;
  const cas = casInput.value.trim();
  if (cas && !validarCAS(cas)) {
    casInput.classList.add("is-invalid");
    casInput.focus();
    return;
  }

  const dadosForm = {
    nome: nomeInput.value,
    numero_cas: cas || null,
    composicao_quimica: composicaoInput.value,
    instituicao_controladora: controladoraInput.value || null,
  };

  try {
    const { error } = await salvarreagente(id || null, dadosForm);
    if (error) {
      // O nome repetido também chega como 23505, com a mensagem do banco.
      if (error.code === "23505" && error.message.includes("numero_cas")) {
        showToast(`O CAS ${cas} já está no catálogo, em outro reagente.`, "warning");
        return;
      }
      throw error;
    }

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
  const { id, nome, cas, composicao, controladora } = button.dataset;

  editIdInput.value = id;
  nomeInput.value = nome;
  casInput.value = cas;
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
  casInput.classList.remove("is-invalid");
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
casInput.addEventListener("input", () => casInput.classList.remove("is-invalid"));

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
