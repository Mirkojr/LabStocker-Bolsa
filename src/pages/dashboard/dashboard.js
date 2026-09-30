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
    greetingElement.textContent = "Bem-vindo(a)!";
  }
}

// Admin visualizando um laboratório em que não tem vínculo
function renderModoAdmin(lab) {
  greetingElement.innerHTML = `<span class="badge bg-warning text-dark px-3 py-2">MODO ADMINISTRADOR · SOMENTE LEITURA</span>`;
  contextoLab.innerHTML = `
    <p class="text-white mb-2">Visualizando: <strong>${escapeHtml(lab.nome)}</strong></p>
    <button id="btn-sair-modo" class="btn btn-sm btn-outline-warning fw-bold rounded-pill">
      Sair do laboratório (voltar ao admin)
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
      <p class="text-white mb-0 opacity-75">
        Você é admin do sistema. Para ver um laboratório, use <strong>Laboratórios → Ver como admin</strong>.
      </p>`;
    return;
  }

  if (!lab) {
    contextoLab.innerHTML = `
      <div class="alert alert-warning d-inline-block text-start mb-0" style="max-width: 520px;">
        <i class="bi bi-info-circle-fill me-2"></i>
        Você ainda não tem vínculo com nenhum laboratório. Peça ao chefe (ou a um gestor) do
        laboratório para adicionar você pelo e-mail da sua conta.
      </div>`;
    return;
  }

  const papel = escapeHtml(NOMES_PAPEL[lab.papel] || lab.papel);

  if (vinculos.length === 1) {
    contextoLab.innerHTML = `
      <p class="text-white mb-0">
        <i class="bi bi-building me-1"></i>${escapeHtml(lab.nome)}
        <span class="badge bg-light text-dark ms-2">${papel}</span>
      </p>`;
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
    <label for="select-lab" class="text-white small d-block mb-1">Laboratório em que você está trabalhando</label>
    <select id="select-lab" class="form-select form-select-sm d-inline-block" style="max-width: 360px;">
      ${opcoes}
    </select>`;

  document.getElementById("select-lab").addEventListener("change", (e) => {
    definirLaboratorioAtivo(e.target.value);
    window.location.reload();
  });
}

function renderAtalhosAdmin() {
  const btnContainer = document.createElement("div");
  btnContainer.className = "text-center mb-4 d-flex flex-wrap gap-2 justify-content-center";
  btnContainer.innerHTML = `
      <a href="../admin/admin-labs.html" class="btn btn-warning fw-bold shadow-sm rounded-pill px-4">
          <i class="bi bi-building-gear me-2"></i> Laboratórios e chefes
      </a>
      <a href="../admin/admin-admins.html" class="btn btn-outline-warning fw-bold shadow-sm rounded-pill px-4">
          <i class="bi bi-people-fill me-2"></i> Admins
      </a>`;
  contextoLab.after(btnContainer);
}

async function loadUserName() {
  try {
    const {
      data: { user },
    } = await getUsuarioLogado();
    if (user) {
      const { data, error } = await buscarNomePorId(user.id);

      if (error) throw error;
      if (data) greetingElement.textContent = `Ola, ${data.nome}!`;
    }
  } catch (error) {
    console.error("Erro ao carregar nome do usuario", error);
    greetingElement.textContent = "Bem-vindo(a)!";
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
        showToast("Sessao encerrada. Ate logo!", "success");
        setTimeout(() => (window.location.href = "../../index.html"), 1500);
      }
    });
  }
});
