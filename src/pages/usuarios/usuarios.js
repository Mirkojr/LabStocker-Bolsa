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
const btnAdicionarPessoa = document.getElementById("btn-adicionar-pessoa");

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

  // O formulário fica fechado; o botão da faixa abre e fecha.
  btnAdicionarPessoa.classList.remove("d-none");
}

function alternarFormulario() {
  const abrir = formVinculo.classList.contains("d-none");
  formVinculo.classList.toggle("d-none", !abrir);
  btnAdicionarPessoa.setAttribute("aria-expanded", String(abrir));
  if (abrir) inputEmail.focus();
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

  listaUsuariosEl.innerHTML =
    `<div class="linha-equipe linha-cabecalho" aria-hidden="true">
        <div>Pessoa</div><div>Papel</div><div>Cargo</div><div>Desde</div><div></div>
     </div>` + vinculos.map(criarItemVinculo).join("");
}

// Uma linha por pessoa: Pessoa, Papel, Cargo, Desde e um menu com as
// mudanças de papel (as ações raras e sensíveis não ficam sempre à mostra).
function criarItemVinculo(v) {
  const perfil = v.usuario || {};
  const nome = escapeHtml(nomeCompleto(v.usuario));
  const inicial = escapeHtml((perfil.nome || "?").charAt(0).toUpperCase());
  const papel = escapeHtml(NOMES_PAPEL[v.papel] || v.papel);
  const ehEu = v.id_usuario === MEU_ID;

  const validade = v.expira_em
    ? `<small class="text-warning d-block"><i class="bi bi-hourglass-split me-1"></i>até ${formatarData(v.expira_em)}</small>`
    : "";
  const concedente = v.concedente
    ? `<small class="text-muted d-block">por ${escapeHtml(nomeCompleto(v.concedente))}</small>`
    : v.observacao
      ? `<small class="text-muted d-block">${escapeHtml(v.observacao)}</small>`
      : "";

  const cargo = possoEditarCargo(v)
    ? `<select class="form-select form-select-sm select-cargo" data-usuario="${escapeHtml(v.id_usuario)}" aria-label="Cargo de ${nome}">
         <option value="">Não informado</option>
         ${CARGOS.map((c) => `<option value="${c}" ${perfil.cargo === c ? "selected" : ""}>${c}</option>`).join("")}
       </select>`
    : `<span class="${perfil.cargo ? "" : "text-muted"}">${escapeHtml(perfil.cargo || "Não informado")}</span>`;

  const itens = [];
  if (possoMudarPapel(v)) {
    const novo = v.papel === "gestor" ? "membro" : "gestor";
    itens.push(`<li><button class="dropdown-item btn-mudar-papel" type="button"
        data-email="${escapeHtml(perfil.email || "")}" data-papel="${novo}" data-nome="${nome}">
        <i class="bi bi-arrow-left-right me-2"></i>${novo === "gestor" ? "Tornar gestor" : "Tornar membro"}</button></li>`);
  }
  if (LAB.acoes.includes("chefia.transferir") && !ehEu) {
    itens.push(`<li><button class="dropdown-item btn-transferir" type="button"
        data-usuario="${escapeHtml(v.id_usuario)}" data-nome="${nome}">
        <i class="bi bi-award me-2"></i>Passar a chefia</button></li>`);
  }
  if (possoRevogar(v)) {
    if (itens.length) itens.push('<li><hr class="dropdown-divider"></li>');
    itens.push(`<li><button class="dropdown-item text-danger btn-revogar" type="button"
        data-id="${escapeHtml(v.id)}" data-nome="${nome}">
        <i class="bi bi-person-x me-2"></i>Revogar acesso</button></li>`);
  }
  const menu = itens.length
    ? `<div class="dropdown">
         <button class="btn btn-sm btn-outline-secondary rounded-circle btn-mais" type="button"
           data-bs-toggle="dropdown" aria-expanded="false" aria-label="Ações para ${nome}">
           <i class="bi bi-three-dots-vertical"></i>
         </button>
         <ul class="dropdown-menu dropdown-menu-end">${itens.join("")}</ul>
       </div>`
    : "";

  return `
    <div class="linha-equipe">
      <div class="leq-pessoa">
        <div class="avatar-papel ${CLASSE_PAPEL[v.papel]}" aria-hidden="true">${inicial}</div>
        <div class="min-w-0">
          <div class="le-nome">${nome}${ehEu ? ' <small class="text-muted fw-normal">(você)</small>' : ""}</div>
          <small class="text-muted d-block text-truncate">${escapeHtml(perfil.email || "Sem e-mail")}</small>
        </div>
      </div>
      <div class="leq-papel">
        <span class="badge rounded-pill ${CLASSE_PAPEL[v.papel]}">${papel}</span>
        ${validade}
      </div>
      <div class="leq-cargo">${cargo}</div>
      <div class="leq-desde">
        <span>${formatarData(v.concedido_em)}</span>
        ${concedente}
      </div>
      <div class="leq-acoes le-acoes">${menu}</div>
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
    mensagem: `${nome} passará a ser ${NOMES_PAPEL[papel]}. O vínculo atual fica registrado no histórico.`,
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
    mensagem: `${nome} perde o acesso a este laboratório. O registro continua no histórico. Motivo (opcional):`,
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
    mensagem: `${nome} passa a ser chefe do laboratório e você vira gestor. O novo chefe pode revogar seu vínculo depois. Continuar?`,
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
btnAdicionarPessoa.addEventListener("click", alternarFormulario);

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
