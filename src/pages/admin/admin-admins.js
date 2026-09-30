import { checkIsAdmin } from "../../shared/sessionManager.js";
import { getUsuarioLogado } from "../../shared/services/authService.js";
import {
  listarAdmins,
  concederAdmin,
  revogarAdmin,
} from "../../shared/services/permissoesService.js";
import { confirmarRecusa } from "../../shared/utils/confirmacao.js";
import { escapeHtml } from "../../shared/utils/dom.js";

const formAdmin = document.getElementById("form-admin");
const inputEmail = document.getElementById("admin-email");
const listaAdmins = document.getElementById("lista-admins");
const historicoEl = document.getElementById("historico-admins");
const listaHistorico = document.getElementById("lista-historico-admins");

let MEU_ID = null;

async function init() {
  if (!(await checkIsAdmin())) {
    alert("Acesso negado: esta página é restrita a administradores.");
    window.location.href = "../dashboard/dashboard.html";
    return;
  }

  const { data } = await getUsuarioLogado();
  MEU_ID = data?.user?.id || null;
  fetchAdmins();
}

function nome(perfil) {
  return perfil ? `${perfil.nome} ${perfil.sobrenome}`.trim() : "Usuário removido";
}

function data(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

async function fetchAdmins() {
  const { data: admins, error } = await listarAdmins();

  if (error) {
    console.error(error);
    listaAdmins.innerHTML = '<li class="list-group-item text-danger">Erro ao carregar admins.</li>';
    return;
  }

  const ativos = admins.filter((a) => !a.revogado_em);
  const revogados = admins.filter((a) => a.revogado_em);
  const ultimo = ativos.length <= 1;

  listaAdmins.innerHTML = ativos
    .map((a) => {
      const origem = a.concedente
        ? `por ${escapeHtml(nome(a.concedente))} em ${data(a.concedido_em)}`
        : `em ${data(a.concedido_em)}${a.observacao ? ` · ${escapeHtml(a.observacao)}` : ""}`;
      const souEu = a.id_usuario === MEU_ID;
      const botao = ultimo
        ? '<span class="small text-muted">Último admin</span>'
        : `<button class="btn btn-sm btn-outline-danger btn-revogar" data-id="${escapeHtml(a.id_usuario)}"
             data-nome="${escapeHtml(nome(a.usuario))}">Revogar</button>`;

      return `
        <li class="list-group-item d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <div>
            <strong>${escapeHtml(nome(a.usuario))}</strong>${souEu ? ' <span class="badge bg-secondary">você</span>' : ""}
            <div class="small text-muted">${escapeHtml(a.usuario?.email || "")} · concedido ${origem}</div>
          </div>
          ${botao}
        </li>`;
    })
    .join("");

  historicoEl.classList.toggle("d-none", revogados.length === 0);
  listaHistorico.innerHTML = revogados
    .map(
      (a) => `
        <li class="list-group-item">
          <strong>${escapeHtml(nome(a.usuario))}</strong> · admin de ${data(a.concedido_em)} a ${data(a.revogado_em)}
          ${a.revogador ? ` · revogado por ${escapeHtml(nome(a.revogador))}` : ""}
          ${a.motivo_revogacao ? ` · ${escapeHtml(a.motivo_revogacao)}` : ""}
        </li>`
    )
    .join("");
}

async function handleCadastrar(e) {
  e.preventDefault();

  try {
    const { error } = await concederAdmin(inputEmail.value.trim());
    if (error) throw error;
    formAdmin.reset();
    fetchAdmins();
  } catch (error) {
    console.error(error);
    alert("Erro ao cadastrar admin: " + error.message);
  }
}

async function handleRevogar(btn) {
  const { id, nome: nomeAdmin } = btn.dataset;
  const souEu = id === MEU_ID;
  const { confirmado, motivo } = await confirmarRecusa({
    titulo: "Revogar admin",
    mensagem: souEu
      ? "Você vai remover o seu próprio acesso de admin. Motivo (opcional):"
      : `${escapeHtml(nomeAdmin)} deixa de ser admin. O registro fica no histórico. Motivo (opcional):`,
    textoConfirmar: "Revogar",
    obrigatorio: false,
  });
  if (!confirmado) return;

  try {
    const { error } = await revogarAdmin(id, motivo || null);
    if (error) throw error;

    if (souEu) {
      window.location.href = "../dashboard/dashboard.html";
      return;
    }
    fetchAdmins();
  } catch (error) {
    console.error(error);
    alert("Erro ao revogar admin: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", init);
formAdmin.addEventListener("submit", handleCadastrar);
listaAdmins.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-revogar");
  if (btn) handleRevogar(btn);
});
