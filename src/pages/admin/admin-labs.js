import { checkIsAdmin } from "../../shared/sessionManager.js";
import {
  listarLaboratorios,
  criarLaboratorio,
  excluirLaboratorio,
} from "../../shared/services/laboratoriosService.js";
import { listarChefesAtuais, definirChefe } from "../../shared/services/permissoesService.js";
import { escapeHtml } from "../../shared/utils/dom.js";

const formLab = document.getElementById("form-lab");
const listaLabs = document.getElementById("lista-labs");
const resumoSemChefe = document.getElementById("resumo-sem-chefe");

// Modal de chefe
const modalChefeEl = document.getElementById("modal-chefe");
const modalChefe = new bootstrap.Modal(modalChefeEl);
const formChefe = document.getElementById("form-chefe");
const tituloModalChefe = document.getElementById("titulo-modal-chefe");
const avisoChefe = document.getElementById("chefe-aviso");
const inputChefeLab = document.getElementById("chefe-lab-id");
const inputChefeEmail = document.getElementById("chefe-email");
const inputChefeMotivo = document.getElementById("chefe-motivo");

// 1. Verificacao de Seguranca ao Carregar
async function init() {
  try {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      alert("Acesso negado: esta página é restrita a administradores.");
      window.location.href = "../dashboard/dashboard.html";
      return;
    }
    // Se for admin, carrega a lista
    fetchLabs();
  } catch (error) {
    console.error("Erro ao verificar admin:", error);
  }
}

// 2. Buscar Lista de Laboratorios
async function fetchLabs() {
  listaLabs.innerHTML =
    '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';

  const [labsResp, chefesResp] = await Promise.all([listarLaboratorios(), listarChefesAtuais()]);

  if (labsResp.error || chefesResp.error) {
    console.error(labsResp.error || chefesResp.error);
    listaLabs.innerHTML = '<div class="alert alert-danger">Erro ao carregar laboratórios.</div>';
    return;
  }

  const chefePorLab = Object.fromEntries(chefesResp.data.map((c) => [c.id_laboratorio, c.usuario]));

  // Laboratórios sem chefe aparecem primeiro, destacados
  const labs = labsResp.data
    .map((lab) => ({ ...lab, chefe: chefePorLab[lab.id] || null }))
    .sort((a, b) => Number(Boolean(a.chefe)) - Number(Boolean(b.chefe)));

  const semChefe = labs.filter((l) => !l.chefe).length;
  resumoSemChefe.textContent = `${semChefe} sem chefe`;
  resumoSemChefe.classList.toggle("d-none", semChefe === 0);

  renderLabs(labs);
}

// 3. Renderizar na Tela
function renderLabs(labs) {
  listaLabs.innerHTML = "";

  if (labs.length === 0) {
    listaLabs.innerHTML =
      '<div class="text-muted text-center">Nenhum laboratório cadastrado.</div>';
    return;
  }

  labs.forEach((lab) => {
    const nome = escapeHtml(lab.nome_laboratorio);
    const chefe = lab.chefe
      ? `<i class="bi bi-person-badge me-1"></i>Chefe: ${escapeHtml(`${lab.chefe.nome} ${lab.chefe.sobrenome}`)} <span class="text-muted">(${escapeHtml(lab.chefe.email || "")})</span>`
      : '<span class="validade-breve"><i class="bi bi-exclamation-triangle-fill me-1"></i>Sem chefe: defina quem chefia este laboratório</span>';

    const item = document.createElement("li");
    item.className =
      "list-group-item d-flex flex-wrap gap-2 justify-content-between align-items-center";
    item.innerHTML = `
            <div>
                <strong>${nome}</strong>
                <span class="text-muted ms-2 small">(SIPAC: ${escapeHtml(lab.codigo_sipac)})</span>
                <div class="small mt-1">${chefe}</div>
            </div>
            <div class="d-flex gap-2 align-items-center">
                <button class="btn btn-sm ${lab.chefe ? "btn-outline-primary" : "btn-primary"} rounded-pill px-3 btn-chefe"
                    data-id="${escapeHtml(lab.id)}" data-nome="${nome}" data-tem-chefe="${lab.chefe ? "1" : ""}">
                    ${lab.chefe ? "Trocar chefe" : "Definir chefe"}
                </button>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary rounded-circle btn-mais" type="button"
                        data-bs-toggle="dropdown" aria-expanded="false" aria-label="Mais ações para ${nome}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <button class="dropdown-item text-danger btn-delete" type="button" data-id="${escapeHtml(lab.id)}">
                                <i class="bi bi-trash me-2"></i>Excluir laboratório
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    listaLabs.appendChild(item);
  });
}

// 4. Cadastrar Novo Laboratorio
async function handleCadastro(e) {
  e.preventDefault();

  const nomeInput = document.getElementById("lab-nome");
  const sipacInput = document.getElementById("lab-sipac");
  const btnSubmit = formLab.querySelector("button");

  const nome = nomeInput.value.trim();
  const sipac = sipacInput.value.trim();

  if (!nome || !sipac) return;

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Salvando...";

  try {
    const { error } = await criarLaboratorio({ nome_laboratorio: nome, codigo_sipac: sipac });

    if (error) throw error;

    alert("Laboratório criado.");
    formLab.reset();
    fetchLabs(); // Atualiza a lista
  } catch (error) {
    console.error(error);
    alert("Erro ao cadastrar: " + error.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Criar";
  }
}

// 5. Excluir Laboratorio
async function handleDelete(id) {
  if (!confirm("Tem certeza que deseja excluir este laboratório? Esta ação não pode ser desfeita."))
    return;

  try {
    const { error } = await excluirLaboratorio(id);

    if (error) {
      // Se houver erro de chave estrangeira (FK), avisa o usuario
      if (error.code === "23503") {
        throw new Error(
          "Não é possível excluir: há usuários ou estoque vinculados a este laboratório."
        );
      }
      throw error;
    }

    fetchLabs(); // Atualiza a lista
  } catch (error) {
    alert("Erro ao excluir: " + error.message);
  }
}

// 6. Definir / trocar chefe
function abrirModalChefe(btn) {
  const { id, nome, temChefe } = btn.dataset;
  formChefe.reset();
  inputChefeLab.value = id;
  tituloModalChefe.textContent = temChefe ? `Trocar chefe: ${nome}` : `Definir chefe: ${nome}`;
  avisoChefe.textContent = temChefe
    ? "O chefe atual perde a chefia e o vínculo com este laboratório. Tudo fica registrado no histórico."
    : "Este laboratório está sem chefe. O chefe poderá adicionar gestores e membros.";
  modalChefe.show();
}

async function handleDefinirChefe(e) {
  e.preventDefault();

  try {
    const { error } = await definirChefe(
      inputChefeLab.value,
      inputChefeEmail.value.trim(),
      inputChefeMotivo.value.trim() || null
    );
    if (error) throw error;

    modalChefe.hide();
    fetchLabs();
  } catch (error) {
    console.error(error);
    alert("Erro ao definir chefe: " + error.message);
  }
}

// Inicializacao e Event Listeners
document.addEventListener("DOMContentLoaded", init);
formChefe.addEventListener("submit", handleDefinirChefe);

if (formLab) {
  formLab.addEventListener("submit", handleCadastro);
}

if (listaLabs) {
  listaLabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete");
    if (btn) handleDelete(btn.dataset.id);

    const btnChefe = e.target.closest(".btn-chefe");
    if (btnChefe) abrirModalChefe(btnChefe);
  });
}
