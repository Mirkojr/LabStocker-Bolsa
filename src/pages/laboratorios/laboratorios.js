import { getCurrentLabId, checkIsAdmin, setAdminLabContext } from "../../shared/sessionManager.js";
import { showToast } from "../../shared/utils/toast.js";
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
let LABS_CACHE = [];
let ESTOQUE_ATUAL_CACHE = [];
let LAB_ATUAL_NOME = "";

async function init() {
  spinner.classList.remove("d-none");
  try {
    MEU_LAB_ID = await getCurrentLabId();
    SOU_ADMIN = await checkIsAdmin();
    await fetchlaboratorios();
  } catch (e) {
    showToast("Falha na conexao com o banco.", "error");
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
      '<div class="col-12 text-center py-5 text-muted">Nenhum laboratorio encontrado.</div>';
    return;
  }

  labs.forEach((lab) => {
    const isMeuLab = String(lab.id) === String(MEU_LAB_ID);

    // Logica de Admin (Personificacao)
    let btnAdmin = "";
    if (SOU_ADMIN) {
      btnAdmin = `
                <button class="btn btn-sm btn-warning w-100 mt-2 fw-bold rounded-pill btn-gerenciar-admin shadow-sm" 
                    data-id="${lab.id}" data-nome="${lab.nome_laboratorio}">
                    <i class="bi bi-shield-lock-fill me-1"></i> ACESSAR COMO ADMIN
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
                    <h5 class="fw-bold text-dark mb-1 text-truncate">${lab.nome_laboratorio}</h5>
                    <p class="text-muted small mb-3">SIPAC: ${lab.codigo_sipac}</p>
                    
                    <button class="btn ${isMeuLab ? "btn-light disabled border" : "btn-primary"} w-100 rounded-pill fw-bold btn-ver-estoque py-2" 
                        data-id="${lab.id}" data-nome="${lab.nome_laboratorio}">
                        ${isMeuLab ? "Seu Laboratorio" : '<i class="bi bi-eye me-2"></i>Ver estoque'}
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
  LAB_ATUAL_NOME = labNome;
  tituloLabSelecionado.innerHTML = `<i class="bi bi-building me-2"></i>estoque: ${labNome}`;
  listaestoqueExt.innerHTML =
    '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
  modalestoqueExt.show();

  try {
    const { data, error } = await listarEstoqueDisponivelPorLaboratorio(labId);

    if (error) throw error;

    ESTOQUE_ATUAL_CACHE = data;
    renderestoqueExterno(ESTOQUE_ATUAL_CACHE);
  } catch (e) {
    showToast("Erro ao carregar estoque externo.", "error");
  }
}

function renderestoqueExterno(itens) {
  listaestoqueExt.innerHTML = "";

  if (itens.length === 0) {
    listaestoqueExt.innerHTML =
      '<div class="p-5 text-center text-muted">Nao ha reagentes disponiveis neste lab.</div>';
    return;
  }

  itens.forEach((item) => {
    const div = document.createElement("div");
    div.className =
      "list-group-item d-flex justify-content-between align-items-center py-3 border-0 border-bottom";
    div.innerHTML = `
            <div>
                <h6 class="mb-0 fw-bold text-dark">${item.reagente.nome}</h6>
                <span class="badge bg-light text-primary border">${item.quantidade} ${item.unidade_medida}</span>
            </div>
            <button class="btn btn-sm btn-success rounded-pill px-3 fw-bold btn-solicitar" 
                data-id="${item.id}" 
                data-nome="${item.reagente.nome}" 
                data-unidade="${item.unidade_medida}" 
                data-max="${item.quantidade}" 
                data-lab="${item.id_laboratorio}">
                Solicitar
            </button>`;
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
  textoSolicitacao.innerHTML = `Voce esta solicitando <strong>${nome}</strong>.<br>Disponivel: ${max} ${unidade}`;
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

    showToast("Solicitacao enviada! Aguarde a aprovacao do laboratorio.", "success");
    modalSolicitar.hide();
    modalestoqueExt.hide();
  } catch (e) {
    showToast("Erro ao processar pedido.", "error");
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
    if (
      confirm(`ATENCAO: Voce entrara no sistema como se fosse do laboratorio "${nome}". Continuar?`)
    ) {
      setAdminLabContext(id, nome);
      window.location.href = "../dashboard/dashboard.html";
    }
  }
});

// Inicializacao
document.addEventListener("DOMContentLoaded", init);
