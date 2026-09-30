import { showToast } from "../../shared/utils/toast.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { getUsuarioLogado, logout } from "../../shared/services/authService.js";
import { buscarNomePorId } from "../../shared/services/perfisService.js";
import {
  carregarPermissoes,
  obterLaboratorioAtivo,
  definirLaboratorioAtivo,
  sairModoAdmin,
  limparSessaoPermissoes,
  NOMES_PAPEL,
} from "../../shared/permissoes.js";

// Seletores
const logoutButton = document.getElementById("btn-logout");
const greetingElement = document.getElementById("user-greeting");
const contextoLab = document.getElementById("contexto-lab");

async function loadDashboardInfo() {
  try {
    const [{ vinculos, admin }, lab] = await Promise.all([
      carregarPermissoes(),
      obterLaboratorioAtivo(),
    ]);

    if (lab?.modoAdmin) {
      renderModoAdmin(lab);
    } else {
      await loadUserName();
      renderContexto(vinculos, lab, admin);
    }

    if (admin) renderAtalhosAdmin();
  } catch (error) {
    console.error("Erro ao carregar permissões:", error);
    greetingElement.textContent = "Olá!";
  }
}

// Admin visualizando um laboratório em que não tem vínculo
function renderModoAdmin(lab) {
  greetingElement.textContent = "Modo administrador";
  contextoLab.innerHTML = `
    <span><i class="bi bi-building me-1"></i>${escapeHtml(lab.nome)}</span>
    <span class="chip-papel">Somente leitura</span>
    <button id="btn-sair-modo" class="btn btn-sm btn-warning fw-bold">
      Voltar ao painel administrativo
    </button>`;

  document.getElementById("btn-sair-modo").addEventListener("click", () => {
    sairModoAdmin();
    showToast("Voltando ao painel administrativo...", "warning");
    setTimeout(() => window.location.reload(), 800);
  });
}

function renderContexto(vinculos, lab, admin) {
  if (!lab && admin) {
    contextoLab.innerHTML = `
      <p class="mb-0">
        Você é admin do sistema. Para ver um laboratório, abra <strong>Laboratórios</strong>
        e escolha <strong>Ver como admin</strong>.
      </p>`;
    return;
  }

  if (!lab) {
    contextoLab.innerHTML = `
      <p class="aviso-faixa mb-0">
        Você ainda não tem vínculo com nenhum laboratório. Peça ao chefe (ou a um gestor) do
        laboratório para adicionar você pelo e-mail da sua conta.
      </p>`;
    return;
  }

  const papel = escapeHtml(NOMES_PAPEL[lab.papel] || lab.papel);

  if (vinculos.length === 1) {
    contextoLab.innerHTML = `
      <span><i class="bi bi-building me-1"></i>${escapeHtml(lab.nome)}</span>
      <span class="chip-papel">${papel}</span>`;
    return;
  }

  const opcoes = vinculos
    .map(
      (v) =>
        `<option value="${escapeHtml(v.id_laboratorio)}" ${v.id_laboratorio === lab.id ? "selected" : ""}>
           ${escapeHtml(v.nome_laboratorio)} (${escapeHtml(NOMES_PAPEL[v.papel] || v.papel)})
         </option>`
    )
    .join("");

  contextoLab.innerHTML = `
    <label for="select-lab">Laboratório em que você está trabalhando</label>
    <select id="select-lab" class="form-select">
      ${opcoes}
    </select>`;

  document.getElementById("select-lab").addEventListener("change", (e) => {
    definirLaboratorioAtivo(e.target.value);
    window.location.reload();
  });
}

function renderAtalhosAdmin() {
  document.getElementById("grupo-admin").classList.remove("d-none");
}

async function loadUserName() {
  try {
    const {
      data: { user },
    } = await getUsuarioLogado();
    if (user) {
      const { data, error } = await buscarNomePorId(user.id);

      if (error) throw error;
      if (data) greetingElement.textContent = `Olá, ${data.nome}!`;
    }
  } catch (error) {
    console.error("Erro ao carregar nome do usuario", error);
    greetingElement.textContent = "Olá!";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardInfo();

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      limparSessaoPermissoes();
      const { error } = await logout();
      if (error) {
        showToast("Erro ao sair.", "error");
      } else {
        showToast("Sessão encerrada. Até logo!", "success");
        setTimeout(() => (window.location.href = "../../index.html"), 1500);
      }
    });
  }
});
