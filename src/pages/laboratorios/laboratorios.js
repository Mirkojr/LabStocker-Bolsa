import { getCurrentLabId, checkIsAdmin, setAdminLabContext } from "../../shared/sessionManager.js";
import { pode } from "../../shared/permissoes.js";
import { showToast } from "../../shared/utils/toast.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { formatarQuantidade } from "../../shared/utils/formatters.js";
import { listarLaboratorios } from "../../shared/services/laboratoriosService.js";
import { listarEstoqueDisponivelPorLaboratorio } from "../../shared/services/estoqueService.js";
import { criarSolicitacao } from "../../shared/services/transferenciasService.js";

// --- Seletores Principais ---
const gridLabs = document.getElementById("grid-laboratorios");
const buscaLabInput = document.getElementById("busca-lab");
const spinner = document.getElementById("spinner-lab");

// Modal estoque Externo
const modalestoqueExtEl = document.getElementById("modal-estoque-externo");
const modalestoqueExt = new bootstrap.Modal(modalestoqueExtEl);
const listaestoqueExt = document.getElementById("lista-estoque-externo");
const tituloLabSelecionado = document.getElementById("titulo-lab-selecionado");
const buscaestoqueExtInput = document.getElementById("busca-estoque-externo");

// Modal Solicitacao
const modalSolicitarEl = document.getElementById("modal-solicitar");
const modalSolicitar = new bootstrap.Modal(modalSolicitarEl);
const formSolicitacao = document.getElementById("form-solicitacao");
const qtdSolicitadaInput = document.getElementById("qtd-solicitada");
const unidadeSolicitadaSpan = document.getElementById("unidade-solicitada");
const textoSolicitacao = document.getElementById("texto-solicitacao");
const erroQtd = document.getElementById("erro-qtd");

// --- Variaveis de Estado (cache) ---
let MEU_LAB_ID = null;
let SOU_ADMIN = false;
let POSSO_SOLICITAR = false; // membro+ do laboratório ativo pede transferência
let LABS_CACHE = [];
let ESTOQUE_ATUAL_CACHE = [];

async function init() {
  spinner.classList.remove("d-none");
  try {
    MEU_LAB_ID = await getCurrentLabId();
    SOU_ADMIN = await checkIsAdmin();
    POSSO_SOLICITAR = await pode("transferencia.solicitar");
    await fetchlaboratorios();
  } catch (e) {
    console.error("Erro ao inicializar a pagina de laboratorios:", e);
    showToast("Não foi possível carregar os laboratórios.", "error");
  } finally {
    spinner.classList.add("d-none");
  }
}

async function fetchlaboratorios() {
  const { data, error } = await listarLaboratorios();

  if (error) throw error;
  LABS_CACHE = data;
  renderlaboratorios(LABS_CACHE);
}

function renderlaboratorios(labs) {
  gridLabs.innerHTML = "";

  if (labs.length === 0) {
    gridLabs.innerHTML =
      '<div class="col-12 text-center py-5 text-muted">Nenhum laboratório encontrado.</div>';
    return;
  }

  labs.forEach((lab) => {
    const isMeuLab = String(lab.id) === String(MEU_LAB_ID);

    const nomeLab = escapeHtml(lab.nome_laboratorio);

    // Admin pode abrir outro laboratório em modo somente leitura. É uma ação
    // secundária (não compete com "Ver estoque") e não aparece no próprio laboratório.
    let btnAdmin = "";
    if (SOU_ADMIN && !isMeuLab) {
      btnAdmin = `
                <button class="btn btn-sm btn-outline-secondary w-100 mt-2 rounded-pill btn-gerenciar-admin"
                    data-id="${escapeHtml(lab.id)}" data-nome="${nomeLab}">
                    <i class="bi bi-shield-lock me-1"></i> Abrir como admin (somente leitura)
                </button>`;
    }

    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    col.innerHTML = `
            <div class="card h-100 border-0 shadow-sm rounded-4 dashboard-card-lab">
                <div class="card-body p-4 text-center">
                    <div class="bg-primary bg-opacity-10 text-primary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center" style="width: 70px; height: 70px;">
                        <i class="bi bi-building fs-2"></i>
                    </div>
                    <h5 class="fw-bold text-dark mb-1 text-truncate">${nomeLab}</h5>
                    <p class="text-muted small mb-3">SIPAC: ${escapeHtml(lab.codigo_sipac)}</p>

                    <button class="btn ${isMeuLab ? "btn-light disabled border" : "btn-primary"} w-100 rounded-pill fw-bold btn-ver-estoque py-2"
                        data-id="${escapeHtml(lab.id)}" data-nome="${nomeLab}">
                        ${isMeuLab ? "Seu laboratório" : '<i class="bi bi-eye me-2"></i>Ver estoque'}
                    </button>
                    ${btnAdmin}
                </div>
            </div>`;
    gridLabs.appendChild(col);
  });
}

// --- Logica de Busca ---
buscaLabInput.addEventListener("keyup", () => {
  const termo = buscaLabInput.value.toLowerCase();
  const filtrados = LABS_CACHE.filter(
    (l) =>
      l.nome_laboratorio.toLowerCase().includes(termo) ||
      l.codigo_sipac.toLowerCase().includes(termo)
  );
  renderlaboratorios(filtrados);
});

async function fetchestoqueExterno(labId, labNome) {
  tituloLabSelecionado.innerHTML = `<i class="bi bi-building me-2"></i>Estoque de ${escapeHtml(labNome)}`;
  listaestoqueExt.innerHTML =
    '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
  modalestoqueExt.show();

  try {
    const { data, error } = await listarEstoqueDisponivelPorLaboratorio(labId);

    if (error) throw error;

    ESTOQUE_ATUAL_CACHE = data;
    renderestoqueExterno(ESTOQUE_ATUAL_CACHE);
  } catch (e) {
    console.error("Erro ao carregar estoque externo:", e);
    showToast("Erro ao carregar o estoque do laboratório.", "error");
  }
}

function renderestoqueExterno(itens) {
  listaestoqueExt.innerHTML = "";

  if (itens.length === 0) {
    listaestoqueExt.innerHTML =
      '<div class="p-5 text-center text-muted">Este laboratório não tem reagentes disponíveis.</div>';
    return;
  }

  itens.forEach((item) => {
    const div = document.createElement("div");
    div.className =
      "list-group-item d-flex justify-content-between align-items-center py-3 border-0 border-bottom";
    const nomeReagente = escapeHtml(item.reagente.nome);
    div.innerHTML = `
            <div>
                <h6 class="mb-0 fw-bold text-dark">${nomeReagente}</h6>
                <span class="badge bg-light text-primary border">${escapeHtml(formatarQuantidade(item.quantidade, item.unidade_medida))}</span>
            </div>
            <button class="btn btn-sm btn-primary rounded-pill px-3 fw-bold btn-solicitar"
                data-id="${escapeHtml(item.id)}"
                data-nome="${nomeReagente}"
                data-unidade="${escapeHtml(item.unidade_medida)}"
                data-max="${escapeHtml(item.quantidade)}"
                data-lab="${escapeHtml(item.id_laboratorio)}"
                aria-label="Pedir ${nomeReagente}">
                Pedir
            </button>`;
    if (!POSSO_SOLICITAR) div.querySelector(".btn-solicitar")?.remove();
    listaestoqueExt.appendChild(div);
  });
}

// Filtro dentro do modal de estoque
buscaestoqueExtInput.addEventListener("keyup", () => {
  const termo = buscaestoqueExtInput.value.toLowerCase();
  const filtrados = ESTOQUE_ATUAL_CACHE.filter((i) =>
    i.reagente.nome.toLowerCase().includes(termo)
  );
  renderestoqueExterno(filtrados);
});

function abrirModalSolicitacao(btn) {
  const { id, nome, unidade, max, lab } = btn.dataset;

  document.getElementById("solic-item-id").value = id;
  document.getElementById("solic-lab-destino").value = lab;
  document.getElementById("solic-max-qtd").value = max;

  qtdSolicitadaInput.value = "";
  unidadeSolicitadaSpan.textContent = unidade;
  textoSolicitacao.innerHTML = `Você está pedindo <strong>${escapeHtml(nome)}</strong>.<br>Disponível: ${escapeHtml(formatarQuantidade(max, unidade))}`;
  erroQtd.classList.add("d-none");

  modalSolicitar.show();
}

formSolicitacao.addEventListener("submit", async (e) => {
  e.preventDefault();

  const idItem = document.getElementById("solic-item-id").value;
  const labOrigem = document.getElementById("solic-lab-destino").value; // O lab dono do item
  const qtd = parseFloat(qtdSolicitadaInput.value);
  const max = parseFloat(document.getElementById("solic-max-qtd").value);

  if (qtd > max || qtd <= 0) {
    erroQtd.classList.remove("d-none");
    return;
  }

  try {
    const { error } = await criarSolicitacao({
      id_lab_origem: labOrigem,
      id_lab_destino: MEU_LAB_ID, // Eu sou o destino
      id_item_estoque: idItem,
      quantidade_transferida: qtd,
      status: "pendente",
    });

    if (error) throw error;

    showToast("Pedido enviado. Aguarde a aprovação do outro laboratório.", "success");
    modalSolicitar.hide();
    modalestoqueExt.hide();
  } catch (e) {
    console.error("Erro ao criar solicitacao:", e);
    showToast("Erro ao enviar o pedido.", "error");
  }
});

document.addEventListener("click", (e) => {
  // Botao Ver estoque
  const btnVer = e.target.closest(".btn-ver-estoque");
  if (btnVer) fetchestoqueExterno(btnVer.dataset.id, btnVer.dataset.nome);

  // Botao Solicitar
  const btnSol = e.target.closest(".btn-solicitar");
  if (btnSol) abrirModalSolicitacao(btnSol);

  // Botao de Admin
  const btnAdmin = e.target.closest(".btn-gerenciar-admin");
  if (btnAdmin) {
    const { id, nome } = btnAdmin.dataset;
    if (confirm(`Você vai abrir o laboratório "${nome}" em modo somente leitura. Continuar?`)) {
      setAdminLabContext(id, nome);
      window.location.href = "../dashboard/dashboard.html";
    }
  }
});

// Inicializacao
document.addEventListener("DOMContentLoaded", init);
