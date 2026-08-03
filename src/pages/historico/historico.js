import { getCurrentLabId } from "../../shared/sessionManager.js";
import { mostrarCarregando, mostrarVazio, mostrarErro } from "../../shared/utils/estados.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { listarTransferenciasPorLaboratorio } from "../../shared/services/transferenciasService.js";
import { listarResiduosDescartadosPorLaboratorio } from "../../shared/services/residuosService.js";
import { listarEntradasPorLaboratorio } from "../../shared/services/movimentacoesService.js";
import {
  garantirContainerPaginador,
  paginarLista,
  renderPaginador,
  TAMANHO_PAGINA_PADRAO,
} from "../../shared/utils/paginacao.js";

// --- Seletores de Elementos ---
const listaHistorico = document.getElementById("lista-historico");
const inputBusca = document.getElementById("busca-historico");

// --- Variaveis de Estado ---
let MEU_LAB_ID = null;
let HISTORICO_CACHE = [];

// Estado da paginação (lista atualmente exibida = cache completo ou resultado da busca)
let listaExibida = [];
let paginaAtualHist = 1;
const paginadorHistEl = garantirContainerPaginador(listaHistorico, "paginador-historico");

// Normaliza o status da transferencia (banco usa minusculo) para label + cor.
const STATUS_TRANSFER = {
  aprovado: { label: "Aprovado", badge: "bg-success" },
  recusado: { label: "Recusado", badge: "bg-danger" },
  pendente: { label: "Pendente", badge: "bg-warning text-dark" },
};
function resolverStatusTransfer(status) {
  const chave = String(status || "").toLowerCase();
  return STATUS_TRANSFER[chave] || { label: status || "Pendente", badge: "bg-secondary" };
}

async function init() {
  try {
    MEU_LAB_ID = await getCurrentLabId();

    if (MEU_LAB_ID) {
      fetchHistorico();
    } else {
      mostrarVazio(listaHistorico, {
        icone: "bi-exclamation-triangle",
        titulo: "Laboratorio nao identificado",
        mensagem: "Verifique sua sessao e tente novamente.",
      });
    }
  } catch (error) {
    console.error("Erro no init:", error);
    mostrarErro(listaHistorico, {
      mensagem: "Erro ao carregar dados do laboratorio.",
      onTentarNovamente: init,
    });
  }
}

async function fetchHistorico() {
  mostrarCarregando(listaHistorico, "Reconstruindo a linha do tempo...");
  if (paginadorHistEl) paginadorHistEl.innerHTML = "";

  try {
    const [resTransf, resresiduos, resMov] = await Promise.all([
      listarTransferenciasPorLaboratorio(MEU_LAB_ID),
      listarResiduosDescartadosPorLaboratorio(MEU_LAB_ID),
      listarEntradasPorLaboratorio(MEU_LAB_ID),
    ]);

    if (resTransf.error) throw resTransf.error;
    if (resresiduos.error) throw resresiduos.error;
    if (resMov.error) throw resMov.error;

    const listaTransf = resTransf.data.map((item) => ({
      ...item,
      tipo_registro: "TRANSFERENCIA",
      data_ordenacao: item.data_solicitacao,
    }));

    const listaresiduos = resresiduos.data.map((item) => ({
      ...item,
      tipo_registro: "RESIDUO",
      data_ordenacao: item.data_criacao,
    }));

    const listaMov = resMov.data.map((item) => ({
      ...item,
      tipo_registro: "ENTRADA_ESTOQUE",
      data_ordenacao: item.data_movimentacao,
    }));

    const listaCompleta = [...listaTransf, ...listaresiduos, ...listaMov];
    listaCompleta.sort((a, b) => new Date(b.data_ordenacao) - new Date(a.data_ordenacao));

    HISTORICO_CACHE = listaCompleta;

    if (listaCompleta.length === 0) {
      mostrarVazio(listaHistorico, {
        icone: "bi-clock-history",
        titulo: "Linha do tempo vazia",
        mensagem: "Nenhuma movimentacao registrada ate o momento.",
      });
      if (paginadorHistEl) paginadorHistEl.innerHTML = "";
    } else {
      exibirHistorico(listaCompleta);
    }
  } catch (error) {
    console.error("Erro ao buscar historico:", error);
    mostrarErro(listaHistorico, {
      mensagem: "Falha ao reconstruir a linha do tempo.",
      onTentarNovamente: fetchHistorico,
    });
  }
}

// Define a lista a exibir (cache completo ou resultado da busca), reinicia a
// pagina e desenha a primeira pagina.
function exibirHistorico(lista) {
  listaExibida = lista || [];
  paginaAtualHist = 1;

  if (listaExibida.length === 0) {
    mostrarVazio(listaHistorico, {
      icone: "bi-search",
      titulo: "Nada encontrado",
      mensagem: "Nenhum registro corresponde a sua busca.",
    });
    if (paginadorHistEl) paginadorHistEl.innerHTML = "";
    return;
  }

  desenharPaginaHist();
}

// Renderiza a pagina atual de listaExibida e atualiza o paginador.
function desenharPaginaHist() {
  const itensPagina = paginarLista(listaExibida, paginaAtualHist, TAMANHO_PAGINA_PADRAO);
  renderHistorico(itensPagina);
  renderPaginador(paginadorHistEl, {
    paginaAtual: paginaAtualHist,
    totalItens: listaExibida.length,
    tamanhoPagina: TAMANHO_PAGINA_PADRAO,
    aoMudarPagina: (p) => {
      paginaAtualHist = p;
      desenharPaginaHist();
      if (listaHistorico) listaHistorico.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
}

/**
 * Renderiza os itens na interface seguindo o padrao Dark Glass
 */
function renderHistorico(itens) {
  if (itens.length === 0) {
    mostrarVazio(listaHistorico, {
      icone: "bi-search",
      titulo: "Nada encontrado",
      mensagem: "Nenhum registro corresponde a sua busca.",
    });
    return;
  }

  listaHistorico.innerHTML = "";

  itens.forEach((item) => {
    const dataObj = new Date(item.data_ordenacao);
    const dataFormatada = dataObj.toLocaleDateString("pt-BR");
    const horaFormatada = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dataCompleta = `${dataFormatada} as ${horaFormatada}`;

    let html;

    // TIPO 1: ENTRADA DE ESTOQUE (COMPRA)
    if (item.tipo_registro === "ENTRADA_ESTOQUE") {
      html = `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi bi-cart-plus-fill text-primary fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${item.item_nome}</h6>
                                <span class="badge bg-primary text-uppercase" style="font-size: 0.65rem;">Compra</span>
                            </div>
                            <p class="mb-1 small text-muted-light">Novo item adicionado ao inventario.</p>
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Qtd: <strong>${item.quantidade} ${item.unidade}</strong></small>
                                <small class="text-white-50 opacity-75">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
    }
    // TIPO 2: RESIDUO (DESCARTE)
    else if (item.tipo_registro === "RESIDUO") {
      html = `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-secondary bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi bi-trash3-fill text-white-50 fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${item.descricao}</h6>
                                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Descarte</span>
                            </div>
                            <p class="mb-1 small text-muted-light">
                                Enviado para tratamento (${item.tipo_perigo})
                            </p>
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Vol: <strong>${item.quantidade} ${item.unidade_medida}</strong></small>
                                <small class="text-white-50 opacity-75">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
    }
    // TIPO 3: TRANSFERENCIA (TROCA)
    else {
      const euFizOPedido = String(item.id_lab_origem) === String(MEU_LAB_ID);
      let cor, icone, textoAcao;

      if (euFizOPedido) {
        // RECEBIDO (Entrada por troca)
        cor = "success";
        icone = "bi-arrow-down-left-circle-fill";
        const labParceiro = item.LabDestino?.nome_laboratorio || "Lab Externo";
        textoAcao = `Recebido de <strong>${labParceiro}</strong>`;
      } else {
        // ENVIADO (Saida por troca)
        cor = "danger";
        icone = "bi-arrow-up-right-circle-fill";
        const labParceiro = item.LabOrigem?.nome_laboratorio || "Lab Externo";
        textoAcao = `Enviado para <strong>${labParceiro}</strong>`;
      }

      const nomereagente = item.estoquelab?.reagente?.nome || "Item desconhecido";
      const unidade = item.estoquelab?.unidade_medida || "";

      // Status normalizado (label + cor) e motivo de recusa, quando houver.
      const { label: statusLabel, badge: statusBadgeClass } = resolverStatusTransfer(item.status);
      const motivoHtml =
        String(item.status).toLowerCase() === "recusado" && item.motivo_recusa
          ? `<p class="mb-1 small text-danger"><i class="bi bi-info-circle me-1"></i>Motivo: ${escapeHtml(item.motivo_recusa)}</p>`
          : "";

      html = `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-${cor} bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi ${icone} text-${cor} fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${nomereagente}</h6>
                                <span class="badge ${statusBadgeClass} text-uppercase" style="font-size: 0.65rem;">${statusLabel}</span>
                            </div>
                            <p class="mb-1 small text-muted-light">${textoAcao}</p>
                            ${motivoHtml}
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Qtd: <strong>${item.quantidade_transferida} ${unidade}</strong></small>
                                <small class="text-white-50 opacity-75">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
    }

    listaHistorico.innerHTML += html;
  });
}

document.addEventListener("DOMContentLoaded", init);

inputBusca.addEventListener("keyup", () => {
  const termo = inputBusca.value.toLowerCase();

  const filtrados = HISTORICO_CACHE.filter((item) => {
    let textoPesquisavel;

    if (item.tipo_registro === "ENTRADA_ESTOQUE") {
      textoPesquisavel = item.item_nome.toLowerCase();
    } else if (item.tipo_registro === "RESIDUO") {
      textoPesquisavel = (item.descricao + (item.tipo_perigo || "")).toLowerCase();
    } else {
      const nomereagente = item.estoquelab?.reagente?.nome || "";
      const nomeOrigem = item.LabOrigem?.nome_laboratorio || "";
      const nomeDestino = item.LabDestino?.nome_laboratorio || "";
      textoPesquisavel = (nomereagente + nomeOrigem + nomeDestino).toLowerCase();
    }
    return textoPesquisavel.includes(termo);
  });

  exibirHistorico(filtrados);
});
