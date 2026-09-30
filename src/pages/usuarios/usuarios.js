import { showToast } from "../../shared/utils/toast.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import { confirmar, confirmarRecusa } from "../../shared/utils/confirmacao.js";
import { getUsuarioLogado } from "../../shared/services/authService.js";
import { carregarPermissoes, obterLaboratorioAtivo, NOMES_PAPEL } from "../../shared/permissoes.js";
import {
  listarVinculosDoLaboratorio,
  concederVinculo,
  revogarVinculo,
  transferirChefia,
  definirCargo,
} from "../../shared/services/permissoesService.js";

const listaUsuariosEl = document.getElementById("lista-usuarios");
const listaHistoricoEl = document.getElementById("lista-historico");
const historicoEl = document.getElementById("historico-vinculos");
const spinner = document.getElementById("spinner-users");
const subtitulo = document.getElementById("equipe-subtitulo");
const formVinculo = document.getElementById("form-vinculo");
const inputEmail = document.getElementById("vinculo-email");
const selectPapel = document.getElementById("vinculo-papel");
const inputValidade = document.getElementById("vinculo-validade");

const CARGOS = ["Técnico", "Docente", "Discente"];
const ORDEM_PAPEL = { chefe: 0, gestor: 1, membro: 2 };
const CLASSE_PAPEL = {
  chefe: "bg-warning text-dark",
  gestor: "bg-info text-dark",
  membro: "bg-light text-dark border",
};

let LAB = null; // { id, nome, papel, acoes, modoAdmin }
let MEU_ID = null;
let SOU_ADMIN = false;

async function init() {
  try {
    const [lab, permissoes, usuario] = await Promise.all([
      obterLaboratorioAtivo(),
      carregarPermissoes(),
      getUsuarioLogado(),
    ]);
    LAB = lab;
    SOU_ADMIN = permissoes.admin;
    MEU_ID = usuario.data?.user?.id || null;

    if (!LAB) {
      subtitulo.textContent = "Você ainda não tem vínculo com nenhum laboratório.";
      listaUsuariosEl.innerHTML =
        '<p class="text-center text-muted my-5">Peça ao chefe do laboratório para adicionar você pelo seu e-mail.</p>';
      return;
    }

    const papelTexto = LAB.modoAdmin
      ? "visualização de admin (somente leitura)"
      : `seu papel: ${NOMES_PAPEL[LAB.papel] || LAB.papel}`;
    subtitulo.textContent = `${LAB.nome} · ${papelTexto}`;

    prepararFormulario();
    await fetchVinculos();
  } catch (error) {
    console.error(error);
    showToast("Erro ao carregar a equipe.", "error");
  }
}

function prepararFormulario() {
  if (!LAB.acoes.includes("membros.gerenciar")) return;

  // Chefe concede gestor ou membro; gestor só membro.
  if (LAB.papel === "chefe") {
    selectPapel.insertAdjacentHTML("beforeend", '<option value="gestor">Gestor</option>');
  }

  // Validade mínima: amanhã
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  inputValidade.min = amanha.toISOString().slice(0, 10);

  formVinculo.classList.remove("d-none");
}

function vinculoAtivo(v) {
  return !v.revogado_em && (!v.expira_em || new Date(v.expira_em) > new Date());
}

async function fetchVinculos() {
  spinner.classList.remove("d-none");
  listaUsuariosEl.innerHTML = "";

  try {
    const { data, error } = await listarVinculosDoLaboratorio(LAB.id);
    if (error) throw error;

    const ativos = data
      .filter(vinculoAtivo)
      .sort(
        (a, b) =>
          ORDEM_PAPEL[a.papel] - ORDEM_PAPEL[b.papel] ||
          nomeCompleto(a.usuario).localeCompare(nomeCompleto(b.usuario))
      );
    const historico = data.filter((v) => !vinculoAtivo(v));

    renderAtivos(ativos);
    renderHistorico(historico);
  } catch (error) {
    console.error(error);
    showToast("Erro ao buscar a equipe.", "error");
  } finally {
    spinner.classList.add("d-none");
  }
}

function nomeCompleto(perfil) {
  if (!perfil) return "Usuário removido";
  return `${perfil.nome || ""} ${perfil.sobrenome || ""}`.trim() || perfil.email || "Sem nome";
}

function formatarData(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

// Mesmas regras das RPCs do banco, só para decidir quais botões mostrar.
function possoRevogar(v) {
  if (v.id_usuario === MEU_ID || LAB.modoAdmin) return false;
  if (v.papel === "chefe") return SOU_ADMIN;
  if (LAB.papel === "chefe") return true;
  return LAB.papel === "gestor" && v.papel === "membro";
}

function possoMudarPapel(v) {
  return LAB.papel === "chefe" && v.papel !== "chefe" && v.id_usuario !== MEU_ID;
}

function possoEditarCargo(v) {
  return v.id_usuario === MEU_ID || SOU_ADMIN;
}

function renderAtivos(vinculos) {
  if (vinculos.length === 0) {
    listaUsuariosEl.innerHTML =
      '<p class="text-center text-muted my-5">Nenhuma pessoa vinculada a este laboratório.</p>';
    return;
  }

  listaUsuariosEl.innerHTML = vinculos.map(criarItemVinculo).join("");
}

function criarItemVinculo(v) {
  const perfil = v.usuario || {};
  const nome = escapeHtml(nomeCompleto(v.usuario));
  const inicial = escapeHtml((perfil.nome || "?").charAt(0).toUpperCase());
  const papel = escapeHtml(NOMES_PAPEL[v.papel] || v.papel);
  const ehEu = v.id_usuario === MEU_ID;

  const validade = v.expira_em
    ? `<small class="text-warning"><i class="bi bi-hourglass-split me-1"></i>até ${formatarData(v.expira_em)}</small>`
    : "";
  const concedido = v.concedente
    ? `por ${escapeHtml(nomeCompleto(v.concedente))} em ${formatarData(v.concedido_em)}`
    : `em ${formatarData(v.concedido_em)}${v.observacao ? ` · ${escapeHtml(v.observacao)}` : ""}`;

  const cargo = possoEditarCargo(v)
    ? `<select class="form-select form-select-sm select-cargo" data-usuario="${escapeHtml(v.id_usuario)}" style="width: auto;" aria-label="Cargo">
         <option value="">Cargo não informado</option>
         ${CARGOS.map((c) => `<option value="${c}" ${perfil.cargo === c ? "selected" : ""}>${c}</option>`).join("")}
       </select>`
    : `<small class="text-muted">Cargo: ${escapeHtml(perfil.cargo || "não informado")}</small>`;

  const acoes = [];
  if (possoMudarPapel(v)) {
    const novo = v.papel === "gestor" ? "membro" : "gestor";
    acoes.push(`<button class="btn btn-sm btn-outline-secondary rounded-pill btn-mudar-papel"
        data-email="${escapeHtml(perfil.email || "")}" data-papel="${novo}" data-nome="${nome}">
        ${novo === "gestor" ? "Tornar gestor" : "Tornar membro"}</button>`);
  }
  if (LAB.acoes.includes("chefia.transferir") && !ehEu) {
    acoes.push(`<button class="btn btn-sm btn-outline-warning rounded-pill btn-transferir"
        data-usuario="${escapeHtml(v.id_usuario)}" data-nome="${nome}">Passar chefia</button>`);
  }
  if (possoRevogar(v)) {
    acoes.push(`<button class="btn btn-sm btn-outline-danger rounded-pill btn-revogar"
        data-id="${escapeHtml(v.id)}" data-nome="${nome}">Revogar</button>`);
  }

  return `
    <div class="d-flex flex-wrap align-items-center gap-3 p-3 mb-2 rounded-4 border">
      <div class="rounded-circle d-flex align-items-center justify-content-center ${CLASSE_PAPEL[v.papel]} shadow-sm flex-shrink-0" style="width: 48px; height: 48px;">
        <span class="fw-bold fs-5">${inicial}</span>
      </div>
      <div class="flex-grow-1" style="min-width: 200px;">
        <h6 class="mb-0 fw-bold">${nome}${ehEu ? ' <small class="text-muted">(você)</small>' : ""}</h6>
        <small class="text-muted"><i class="bi bi-envelope me-1"></i>${escapeHtml(perfil.email || "Sem e-mail")}</small>
        <div class="d-flex flex-wrap gap-2 align-items-center mt-1">
          <span class="badge rounded-pill ${CLASSE_PAPEL[v.papel]}">${papel}</span>
          ${validade}
          <small class="text-muted">Concedido ${concedido}</small>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        ${cargo}
        ${acoes.join("")}
      </div>
    </div>`;
}

function renderHistorico(vinculos) {
  if (vinculos.length === 0) {
    historicoEl.classList.add("d-none");
    return;
  }

  historicoEl.classList.remove("d-none");
  listaHistoricoEl.innerHTML = vinculos
    .map((v) => {
      const fim = v.revogado_em
        ? `revogado em ${formatarData(v.revogado_em)}${v.revogador ? ` por ${escapeHtml(nomeCompleto(v.revogador))}` : ""}`
        : `expirou em ${formatarData(v.expira_em)}`;
      const motivo = v.motivo_revogacao ? ` · ${escapeHtml(v.motivo_revogacao)}` : "";
      const concedente = v.concedente ? ` por ${escapeHtml(nomeCompleto(v.concedente))}` : "";

      return `
        <div class="p-2 mb-2 rounded-3 border small text-muted">
          <strong>${escapeHtml(nomeCompleto(v.usuario))}</strong>
          · ${escapeHtml(NOMES_PAPEL[v.papel] || v.papel)}
          · concedido em ${formatarData(v.concedido_em)}${concedente}
          · ${fim}${motivo}
        </div>`;
    })
    .join("");
}

// --- Ações ---

async function handleAdicionar(evento) {
  evento.preventDefault();

  const email = inputEmail.value.trim();
  const papel = selectPapel.value;
  const validade = inputValidade.value
    ? new Date(`${inputValidade.value}T23:59:59`).toISOString()
    : null;

  if (!email) return;

  try {
    const { error } = await concederVinculo(LAB.id, email, papel, validade);
    if (error) throw error;

    showToast(`${NOMES_PAPEL[papel]} adicionado(a) ao laboratório.`, "success");
    formVinculo.reset();
    fetchVinculos();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function handleMudarPapel(btn) {
  const { email, papel, nome } = btn.dataset;
  const ok = await confirmar({
    titulo: "Alterar papel",
    mensagem: `${escapeHtml(nome)} passará a ser <strong>${NOMES_PAPEL[papel]}</strong>. O vínculo atual fica registrado no histórico.`,
    textoConfirmar: "Alterar",
    tipo: "primary",
    icone: "bi-arrow-left-right",
  });
  if (!ok) return;

  try {
    const { error } = await concederVinculo(LAB.id, email, papel);
    if (error) throw error;
    showToast("Papel alterado.", "success");
    fetchVinculos();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function handleRevogar(btn) {
  const { id, nome } = btn.dataset;
  const { confirmado, motivo } = await confirmarRecusa({
    titulo: "Revogar vínculo",
    mensagem: `${escapeHtml(nome)} perde o acesso a este laboratório. O registro continua no histórico. Motivo (opcional):`,
    textoConfirmar: "Revogar",
    obrigatorio: false,
  });
  if (!confirmado) return;

  try {
    const { error } = await revogarVinculo(id, motivo || null);
    if (error) throw error;
    showToast("Vínculo revogado.", "success");
    fetchVinculos();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function handleTransferir(btn) {
  const { usuario, nome } = btn.dataset;
  const ok = await confirmar({
    titulo: "Passar a chefia",
    mensagem: `${escapeHtml(nome)} passa a ser chefe do laboratório e você vira <strong>gestor</strong>. O novo chefe pode revogar seu vínculo depois. Continuar?`,
    textoConfirmar: "Passar chefia",
    tipo: "warning",
    icone: "bi-award-fill",
  });
  if (!ok) return;

  try {
    const { error } = await transferirChefia(LAB.id, usuario);
    if (error) throw error;
    showToast("Chefia transferida.", "success");
    setTimeout(() => window.location.reload(), 800);
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

async function handleCargo(select) {
  try {
    const { error } = await definirCargo(select.dataset.usuario, select.value || null);
    if (error) throw error;
    showToast("Cargo atualizado.", "success");
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
    fetchVinculos();
  }
}

formVinculo.addEventListener("submit", handleAdicionar);

listaUsuariosEl.addEventListener("click", (e) => {
  const btnPapel = e.target.closest(".btn-mudar-papel");
  const btnRevogar = e.target.closest(".btn-revogar");
  const btnTransferir = e.target.closest(".btn-transferir");
  if (btnPapel) handleMudarPapel(btnPapel);
  if (btnRevogar) handleRevogar(btnRevogar);
  if (btnTransferir) handleTransferir(btnTransferir);
});

listaUsuariosEl.addEventListener("change", (e) => {
  const select = e.target.closest(".select-cargo");
  if (select) handleCargo(select);
});

document.addEventListener("DOMContentLoaded", init);
