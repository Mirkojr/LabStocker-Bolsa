import { getCurrentLabId } from "../../shared/sessionManager.js";
import { mostrarCarregando, mostrarVazio, mostrarErro } from "../../shared/utils/estados.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import {
  formatarDataHora,
  formatarQuantidade,
  formatarTipoPerigo,
} from "../../shared/utils/formatters.js";
import { listarTransferenciasPorLaboratorio } from "../../shared/services/transferenciasService.js";
import { listarResiduosDescartadosPorLaboratorio } from "../../shared/services/residuosService.js";
import { listarEntradasPorLaboratorio } from "../../shared/services/movimentacoesService.js";
import { listarConsumosPorLaboratorio } from "../../shared/services/consumoService.js"; // Import novo adicionado
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

async function init() {
  try {
    MEU_LAB_ID = await getCurrentLabId();

    if (MEU_LAB_ID) {
      fetchHistorico();
    } else {
      mostrarVazio(listaHistorico, {
        icone: "bi-exclamation-triangle",
        titulo: "Laboratório não identificado",
        mensagem: "Verifique sua sessão e tente novamente.",
      });
    }
  } catch (error) {
    console.error("Erro no init:", error);
    mostrarErro(listaHistorico, {
      mensagem: "Erro ao carregar os dados do laboratório.",
      onTentarNovamente: init,
    });
  }
}

async function fetchHistorico() {
  mostrarCarregando(listaHistorico, "Carregando o histórico...");
  if (paginadorHistEl) paginadorHistEl.innerHTML = "";

  try {
    const [resTransf, resresiduos, resMov, resConsumos] = await Promise.all([
      listarTransferenciasPorLaboratorio(MEU_LAB_ID),
      listarResiduosDescartadosPorLaboratorio(MEU_LAB_ID),
      listarEntradasPorLaboratorio(MEU_LAB_ID),
      listarConsumosPorLaboratorio(MEU_LAB_ID), // Nova promessa para consumos
    ]);

    if (resTransf.error) throw resTransf.error;
    if (resresiduos.error) throw resresiduos.error;
    if (resMov.error) throw resMov.error;
    if (resConsumos.error) throw resConsumos.error; // Tratamento de erro pro novo dado

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

    const listaConsumos = resConsumos.data.map((item) => ({
      ...item,
      tipo_registro: "CONSUMO",
      data_ordenacao: item.data_consumo,
      nome_usuario: item.perfis
        ? `${item.perfis.nome} ${item.perfis.sobrenome}`
        : "Usuário removido",
    }));

    // Mesclando as 4 listas
    const listaCompleta = [...listaTransf, ...listaresiduos, ...listaMov, ...listaConsumos];
    listaCompleta.sort((a, b) => new Date(b.data_ordenacao) - new Date(a.data_ordenacao));

    HISTORICO_CACHE = listaCompleta;

    if (listaCompleta.length === 0) {
      mostrarVazio(listaHistorico, {
        icone: "bi-clock-history",
        titulo: "Histórico vazio",
        mensagem: "Nenhuma movimentação registrada até o momento.",
      });
      if (paginadorHistEl) paginadorHistEl.innerHTML = "";
    } else {
      exibirHistorico(listaCompleta);
    }
  } catch (error) {
    console.error("Erro ao buscar historico:", error);
    mostrarErro(listaHistorico, {
      mensagem: "Não foi possível carregar o histórico.",
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
      mensagem: "Nenhum registro corresponde à sua busca.",
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

// Um item do histórico: ícone, título, selo do tipo, linhas de detalhe,
// quantidade e data. Todo texto que vem do banco chega aqui já escapado.
function montarItem({ cor, icone, titulo, selo, seloClasse, detalhes, quantidade, data }) {
  return `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-${cor} bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi ${icone} text-${cor} fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${titulo}</h6>
                                <span class="badge ${seloClasse}">${selo}</span>
                            </div>
                            ${detalhes}
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Quantidade: <strong>${quantidade}</strong></small>
                                <small class="text-white-50 opacity-75">${data}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
}

// Transferência vista pelo laboratório atual. No banco, id_lab_origem é o
// laboratório dono do reagente (de onde o material sai) e id_lab_destino é
// quem fez o pedido e recebe o material (ver transferenciasService.js).
// Enquanto o pedido não é aprovado, nada saiu nem entrou: aparece como pedido.
function descreverTransferencia(item) {
  const souDono = String(item.id_lab_origem) === String(MEU_LAB_ID);
  const outroLab = escapeHtml(
    (souDono ? item.LabDestino?.nome_laboratorio : item.LabOrigem?.nome_laboratorio) ||
      "outro laboratório"
  );
  const status = String(item.status || "pendente").toLowerCase();

  if (status === "aprovado") {
    return souDono
      ? {
          cor: "danger",
          icone: "bi-arrow-up-right-circle-fill",
          texto: `Transferência enviada para <strong>${outroLab}</strong>`,
          selo: "Transferência",
          seloClasse: "bg-danger",
        }
      : {
          cor: "success",
          icone: "bi-arrow-down-left-circle-fill",
          texto: `Transferência recebida de <strong>${outroLab}</strong>`,
          selo: "Transferência",
          seloClasse: "bg-success",
        };
  }

  const texto = souDono
    ? `Pedido feito por <strong>${outroLab}</strong>`
    : `Pedido feito a <strong>${outroLab}</strong>`;

  if (status === "recusado") {
    return {
      cor: "secondary",
      icone: "bi-x-circle-fill",
      texto,
      selo: "Pedido recusado",
      seloClasse: "bg-secondary",
    };
  }
  return {
    cor: "warning",
    icone: "bi-hourglass-split",
    texto,
    selo: "Pedido pendente",
    seloClasse: "bg-warning text-dark",
  };
}

function renderHistorico(itens) {
  if (itens.length === 0) {
    mostrarVazio(listaHistorico, {
      icone: "bi-search",
      titulo: "Nada encontrado",
      mensagem: "Nenhum registro corresponde à sua busca.",
    });
    return;
  }

  listaHistorico.innerHTML = "";

  itens.forEach((item) => {
    const data = formatarDataHora(item.data_ordenacao);
    let html;

    if (item.tipo_registro === "ENTRADA_ESTOQUE") {
      html = montarItem({
        cor: "success",
        icone: "bi-box-arrow-in-down",
        titulo: escapeHtml(item.item_nome),
        selo: "Entrada",
        seloClasse: "bg-success",
        detalhes: `<p class="mb-1 small text-muted-light">${escapeHtml(item.observacao || "Item adicionado ao estoque.")}</p>`,
        quantidade: escapeHtml(formatarQuantidade(item.quantidade, item.unidade)),
        data,
      });
    } else if (item.tipo_registro === "RESIDUO") {
      html = montarItem({
        cor: "secondary",
        icone: "bi-trash3-fill",
        titulo: escapeHtml(item.descricao),
        selo: "Descarte",
        seloClasse: "bg-secondary",
        detalhes: `<p class="mb-1 small text-muted-light">Enviado para tratamento (${escapeHtml(formatarTipoPerigo(item.tipo_perigo))})</p>`,
        quantidade: escapeHtml(formatarQuantidade(item.quantidade, item.unidade_medida)),
        data,
      });
    } else if (item.tipo_registro === "CONSUMO") {
      html = montarItem({
        cor: "info",
        icone: "bi-eyedropper",
        titulo: escapeHtml(item.reagente?.nome || "Reagente desconhecido"),
        selo: "Consumo",
        seloClasse: "bg-info text-dark",
        detalhes: `<p class="mb-1 small text-muted-light">
                                Consumido por: <strong>${escapeHtml(item.nome_usuario)}</strong><br>
                                <span class="fst-italic">Finalidade: ${escapeHtml(item.finalidade || "não informada")}</span>
                            </p>`,
        quantidade: escapeHtml(formatarQuantidade(item.quantidade, item.unidade_medida)),
        data,
      });
    } else {
      const t = descreverTransferencia(item);
      const motivo =
        String(item.status).toLowerCase() === "recusado" && item.motivo_recusa
          ? `<p class="mb-1 small text-danger"><i class="bi bi-info-circle me-1"></i>Motivo: ${escapeHtml(item.motivo_recusa)}</p>`
          : "";
      html = montarItem({
        cor: t.cor,
        icone: t.icone,
        titulo: escapeHtml(item.estoquelab?.reagente?.nome || "Item desconhecido"),
        selo: t.selo,
        seloClasse: t.seloClasse,
        detalhes: `<p class="mb-1 small text-muted-light">${t.texto}</p>${motivo}`,
        quantidade: escapeHtml(
          formatarQuantidade(item.quantidade_transferida, item.estoquelab?.unidade_medida)
        ),
        data,
      });
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
    } else if (item.tipo_registro === "CONSUMO") {
      const nomereagente = item.reagente?.nome || "";
      const nomeUsuario = item.nome_usuario || "";
      const finalidade = item.finalidade || "";
      textoPesquisavel = (nomereagente + nomeUsuario + finalidade).toLowerCase();
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
