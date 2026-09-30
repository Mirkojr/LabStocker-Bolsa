import { getCurrentLabId } from "../../shared/sessionManager.js";
import { obterLaboratorioAtivo, aplicarPermissoes } from "../../shared/permissoes.js";
import { showToast } from "../../shared/utils/toast.js";
import { confirmar, confirmarRecusa } from "../../shared/utils/confirmacao.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { formatarQuantidade } from "../../shared/utils/formatters.js";
import {
  listarSolicitacoesPendentes,
  aprovarTransferencia,
  recusarTransferencia,
} from "../../shared/services/transferenciasService.js";

// --- Seletores ---
const listaPedidos = document.getElementById("lista-pedidos");
const spinner = document.getElementById("spinner-solic");
let MEU_LAB_ID = null;
let ACOES_LAB = []; // ações permitidas no laboratório ativo (ver shared/permissoes.js)

async function init() {
  try {
    MEU_LAB_ID = await getCurrentLabId();
    ACOES_LAB = (await obterLaboratorioAtivo())?.acoes || [];

    if (MEU_LAB_ID) {
      if (!ACOES_LAB.includes("transferencia.aprovar")) {
        listaPedidos.insertAdjacentHTML(
          "beforebegin",
          '<p class="text-muted-light small mb-3"><i class="bi bi-info-circle me-1"></i>Somente o chefe ou um gestor do laboratório aprova ou recusa pedidos.</p>'
        );
      }
      fetchPedidosRecebidos();
    } else {
      listaPedidos.innerHTML =
        '<div class="text-center text-warning p-5">Você ainda não tem vínculo com nenhum laboratório.</div>';
    }
  } catch (error) {
    console.error(error);
    showToast("Erro ao carregar os dados da sessão.", "error");
  }
}

async function fetchPedidosRecebidos() {
  if (!spinner || !listaPedidos) return;

  spinner.classList.remove("d-none");
  listaPedidos.innerHTML = "";

  try {
    const { data, error } = await listarSolicitacoesPendentes(MEU_LAB_ID);
    if (error) throw error;

    if (data.length === 0) {
      listaPedidos.innerHTML = `
                <div class="text-center py-5 text-muted-light">
                    <i class="bi bi-inbox fs-1 opacity-25"></i>
                    <p class="mt-3">Nenhum pedido pendente no momento.</p>
                </div>`;
    } else {
      renderPedidos(data);
    }
  } catch (error) {
    console.error(error);
    showToast("Erro ao carregar os pedidos.", "error");
  } finally {
    spinner.classList.add("d-none");
  }
}

function renderPedidos(pedidos) {
  pedidos.forEach((pedido) => {
    const nomeLabSolicitante = escapeHtml(
      pedido.laboratorio?.nome_laboratorio || "Outro laboratório"
    );
    const nomereagente = escapeHtml(pedido.estoquelab?.reagente?.nome || "Item desconhecido");
    const quantidade = escapeHtml(
      formatarQuantidade(pedido.quantidade_transferida, pedido.estoquelab?.unidade_medida || "un")
    );
    const data = new Date(pedido.data_solicitacao).toLocaleDateString("pt-BR");

    const div = document.createElement("div");
    div.className =
      "list-group-item bg-transparent border-white border-opacity-10 mb-3 p-4 rounded-4 shadow-sm";
    div.style.background = "rgba(255, 255, 255, 0.03)";

    div.innerHTML = `
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center">
                <div class="mb-3 mb-md-0">
                    <h5 class="mb-1 fw-bold text-white">${nomereagente}</h5>
                    <p class="mb-1 text-muted-light">
                        <span class="text-white fw-bold">${nomeLabSolicitante}</span> pediu
                        <span class="badge bg-light bg-opacity-10 text-white border border-white border-opacity-25">${quantidade}</span>
                    </p>
                    <small class="opacity-50 text-white"><i class="bi bi-calendar3 me-1"></i>Pedido em: ${data}</small>
                </div>
                <div class="d-flex gap-2" data-permissao="transferencia.aprovar">
                    <button class="btn btn-primary rounded-pill px-4 fw-bold btn-aprovar shadow-sm" data-id="${escapeHtml(pedido.id)}">
                        <i class="bi bi-check-lg me-1"></i> Aprovar
                    </button>
                    <button class="btn btn-outline-danger rounded-pill px-4 btn-recusar" data-id="${escapeHtml(pedido.id)}">
                        <i class="bi bi-x-lg me-1"></i> Recusar
                    </button>
                </div>
            </div>
        `;
    aplicarPermissoes(div, ACOES_LAB);
    listaPedidos.appendChild(div);
  });
}

async function handleAprovar(id) {
  const ok = await confirmar({
    titulo: "Aprovar pedido",
    mensagem:
      "A quantidade sai do seu estoque na hora e a transferência fica registrada no histórico.",
    textoConfirmar: "Aprovar",
    tipo: "primary",
    icone: "bi-check-circle-fill",
  });
  if (!ok) return;

  try {
    const { error } = await aprovarTransferencia(id);
    if (error) throw error;

    showToast(
      "Pedido aprovado. A transferência foi registrada e os estoques atualizados.",
      "success"
    );
    fetchPedidosRecebidos();
  } catch (error) {
    console.error(error);
    showToast("Erro ao aprovar o pedido: " + error.message, "error");
  }
}

async function handleRecusar(id) {
  const { confirmado, motivo } = await confirmarRecusa({
    titulo: "Recusar pedido",
    mensagem:
      "Descreva o motivo da recusa. Ele fica visível no histórico do laboratório que fez o pedido.",
    textoConfirmar: "Recusar pedido",
  });
  if (!confirmado) return;

  try {
    const { error } = await recusarTransferencia(id, motivo);
    if (error) throw error;

    showToast("Pedido recusado.", "warning");
    fetchPedidosRecebidos();
  } catch (error) {
    console.error(error);
    showToast("Erro ao recusar: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", init);

listaPedidos.addEventListener("click", (e) => {
  const btnAprovar = e.target.closest(".btn-aprovar");
  const btnRecusar = e.target.closest(".btn-recusar");

  if (btnAprovar) handleAprovar(btnAprovar.dataset.id);
  if (btnRecusar) handleRecusar(btnRecusar.dataset.id);
});
