import { getCurrentLabId } from "../../shared/sessionManager.js";
import { obterLaboratorioAtivo, aplicarPermissoes } from "../../shared/permissoes.js";
import { showToast } from "../../shared/utils/toast.js";
import { confirmar, confirmarRecusa } from "../../shared/utils/confirmacao.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { formatarQuantidade } from "../../shared/utils/formatters.js";
import {
  listarSolicitacoesPendentes,
  listarPedidosDecididos,
  aprovarTransferencia,
  recusarTransferencia,
} from "../../shared/services/transferenciasService.js";

// --- Seletores ---
const listaPedidos = document.getElementById("lista-pedidos");
const abasEl = document.getElementById("abas-pedidos");
let abaAtual = "pendentes"; // "pendentes" | "decididos"
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
          '<p class="text-muted small mb-3"><i class="bi bi-info-circle me-1"></i>Somente o chefe ou um gestor do laboratório aprova ou recusa pedidos.</p>'
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
    if (abaAtual === "decididos") {
      const { data, error } = await listarPedidosDecididos(MEU_LAB_ID);
      if (error) throw error;
      renderDecididos(data);
      return;
    }

    const { data, error } = await listarSolicitacoesPendentes(MEU_LAB_ID);
    if (error) throw error;

    if (data.length === 0) {
      listaPedidos.innerHTML = `
                <div class="text-center py-5 text-muted">
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

// Situação do estoque depois de atender o pedido: é a informação que decide
// a aprovação.
function avisoSaldo(pedido) {
  const emEstoque = Number(pedido.estoquelab?.quantidade);
  const pedidoQtd = Number(pedido.quantidade_transferida);
  if (Number.isNaN(emEstoque)) return "";
  const sobra = emEstoque - pedidoQtd;
  if (sobra < 0) {
    return '<small class="validade-vencida d-block"><i class="bi bi-exclamation-octagon-fill me-1"></i>Estoque insuficiente</small>';
  }
  if (sobra === 0) {
    return '<small class="validade-breve d-block"><i class="bi bi-exclamation-triangle-fill me-1"></i>Zera o estoque</small>';
  }
  return "";
}

function renderPedidos(pedidos) {
  listaPedidos.innerHTML = `
        <div class="linha-pedido linha-cabecalho" aria-hidden="true">
            <div>Reagente</div><div class="le-quantidade">Pedido</div><div class="le-quantidade">Em estoque</div><div></div>
        </div>`;

  pedidos.forEach((pedido) => {
    const nomeLab = escapeHtml(pedido.laboratorio?.nome_laboratorio || "Outro laboratório");
    const nomeReagente = escapeHtml(pedido.estoquelab?.reagente?.nome || "Item desconhecido");
    const unidade = pedido.estoquelab?.unidade_medida || "un";
    const data = new Date(pedido.data_solicitacao).toLocaleDateString("pt-BR");

    const div = document.createElement("div");
    div.className = "linha-pedido";
    div.setAttribute("role", "listitem");
    div.innerHTML = `
            <div class="lp-pedido">
                <div class="le-nome">${nomeReagente}</div>
                <small class="text-muted d-block">${nomeLab}, em ${data}</small>
            </div>
            <div class="lp-pedido-qtd le-quantidade">
                <small class="lp-rotulo">Pedido</small>
                <span class="le-qtd">${escapeHtml(formatarQuantidade(pedido.quantidade_transferida, unidade))}</span>
            </div>
            <div class="lp-estoque le-quantidade">
                <small class="lp-rotulo">Em estoque</small>
                <span>${escapeHtml(formatarQuantidade(pedido.estoquelab?.quantidade, unidade))}</span>
                ${avisoSaldo(pedido)}
            </div>
            <div class="lp-acoes le-acoes" data-permissao="transferencia.aprovar">
                <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold btn-aprovar" data-id="${escapeHtml(pedido.id)}" aria-label="Aprovar pedido de ${nomeReagente}">
                    <i class="bi bi-check-lg me-1"></i>Aprovar
                </button>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 btn-recusar" data-id="${escapeHtml(pedido.id)}" aria-label="Recusar pedido de ${nomeReagente}">
                    Recusar
                </button>
            </div>
        `;
    aplicarPermissoes(div, ACOES_LAB);
    listaPedidos.appendChild(div);
  });
}

function renderDecididos(pedidos) {
  if (pedidos.length === 0) {
    listaPedidos.innerHTML =
      '<p class="text-center text-muted py-5 mb-0">Nenhum pedido aprovado ou recusado ainda.</p>';
    return;
  }

  listaPedidos.innerHTML = pedidos
    .map((pedido) => {
      const nomeLab = escapeHtml(pedido.laboratorio?.nome_laboratorio || "Outro laboratório");
      const nomeReagente = escapeHtml(pedido.estoquelab?.reagente?.nome || "Item desconhecido");
      const quantidade = escapeHtml(
        formatarQuantidade(pedido.quantidade_transferida, pedido.estoquelab?.unidade_medida || "un")
      );
      const data = new Date(pedido.data_solicitacao).toLocaleDateString("pt-BR");
      const aprovado = pedido.status === "aprovado";
      const status = aprovado
        ? '<span class="status-residuo status-descartado"><i class="bi bi-check-circle-fill"></i>Aprovado</span>'
        : '<span class="status-residuo text-danger"><i class="bi bi-x-circle-fill"></i>Recusado</span>';
      const motivo =
        !aprovado && pedido.motivo_recusa
          ? `<small class="text-muted d-block">Motivo: ${escapeHtml(pedido.motivo_recusa)}</small>`
          : "";
      return `
        <div class="linha-pedido linha-decidido" role="listitem">
            <div class="lp-pedido">
                <div class="le-nome">${nomeReagente}</div>
                <small class="text-muted d-block">${nomeLab}, em ${data}</small>
            </div>
            <div class="lp-pedido-qtd le-quantidade"><span class="le-qtd">${quantidade}</span></div>
            <div class="lp-estoque">${status}${motivo}</div>
            <div class="lp-acoes"></div>
        </div>`;
    })
    .join("");
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

// Abas: pedidos pendentes ou já decididos (aprovados e recusados).
abasEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-aba]");
  if (!btn || btn.dataset.aba === abaAtual) return;
  abaAtual = btn.dataset.aba;
  abasEl.querySelectorAll("[data-aba]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b === btn));
  });
  if (MEU_LAB_ID) fetchPedidosRecebidos();
});

listaPedidos.addEventListener("click", (e) => {
  const btnAprovar = e.target.closest(".btn-aprovar");
  const btnRecusar = e.target.closest(".btn-recusar");

  if (btnAprovar) handleAprovar(btnAprovar.dataset.id);
  if (btnRecusar) handleRecusar(btnRecusar.dataset.id);
});
