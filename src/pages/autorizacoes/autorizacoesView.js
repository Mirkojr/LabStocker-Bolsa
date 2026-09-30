import { escapeHtml, $ } from "../../shared/utils/dom.js";
import { formatarQuantidade, formatarTelefone } from "../../shared/utils/formatters.js";
import { gerarSignedUrl } from "../../shared/services/projetosService.js";
import { UNIDADES } from "../../shared/constants.js";

// Configuração visual de cada status de solicitação.
const STATUS = {
  aprovado: { label: "Aprovado", badge: "bg-success" },
  recusado: { label: "Recusado", badge: "bg-danger" },
  pendente: { label: "Pendente", badge: "bg-warning text-dark" },
};

const resolverStatus = (status) => STATUS[status] || STATUS.pendente;

// ---- Lista "Meus projetos" -------------------------------------------------

export function renderEstadoLista(mensagem, tipo = "info") {
  const container = $("lista-meus-projetos");
  if (!container) return;
  const cor = tipo === "erro" ? "text-danger" : "text-muted";
  container.innerHTML = `<div class="text-center py-3 ${cor} small">${escapeHtml(mensagem)}</div>`;
}

export function renderListaProjetos(projetos, aoClicar) {
  const container = $("lista-meus-projetos");
  if (!container) return;
  container.innerHTML = "";

  projetos.forEach((proj) => {
    const { label, badge } = resolverStatus(proj.status);
    const dataCriacao = new Date(proj.created_at).toLocaleDateString("pt-BR");

    const item = document.createElement("button");
    item.type = "button";
    item.className =
      "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
    item.innerHTML = `
            <div class="text-start">
                <div class="fw-semibold">${escapeHtml(proj.titulo_projeto || "Sem título")}</div>
                <small class="text-muted">Enviado em ${dataCriacao}</small>
            </div>
            <span class="badge ${badge} rounded-pill">${label}</span>
        `;
    item.addEventListener("click", () => aoClicar(proj));
    container.appendChild(item);
  });
}

// ---- Modal de detalhes -----------------------------------------------------

export async function abrirModalDetalhes(proj) {
  $("modal-proj-titulo").textContent = proj.titulo_projeto || "-";
  $("modal-resp-nome").textContent = proj.responsavel_nome || "-";
  $("modal-resp-email").textContent = proj.responsavel_email || "-";
  $("modal-resp-telefone").textContent = formatarTelefone(proj.responsavel_telefone);
  $("modal-lab-nome").textContent = proj.lab_nome || "-";

  renderProdutosModal(proj.produtos || []);
  limparElementosDinamicos();
  await renderBotaoDownload(proj);
  renderMotivoRecusa(proj);

  new bootstrap.Modal($("modalDetalhes")).show();
}

function renderProdutosModal(produtos) {
  const lista = $("modal-lista-produtos");
  lista.innerHTML = "";
  produtos.forEach((p) => {
    const li = document.createElement("li");
    li.className = "list-group-item bg-transparent d-flex justify-content-between";
    li.innerHTML =
      `<span>${escapeHtml(p.nome)}</span>` +
      `<span class="text-muted">${escapeHtml(formatarQuantidade(p.quantidade, p.unidade))}</span>`;
    lista.appendChild(li);
  });
}

// Remove elementos criados em aberturas anteriores do modal.
function limparElementosDinamicos() {
  $("modal-btn-download")?.remove();
  $("modal-motivo-recusa")?.remove();
}

async function renderBotaoDownload(proj) {
  if (proj.status !== "aprovado" || !proj.pdf_assinado_url) return;

  const footer = document.querySelector("#modalDetalhes .modal-footer");
  const btn = document.createElement("a");
  btn.id = "modal-btn-download";
  btn.className = "btn btn-success rounded-pill px-4 me-auto";
  btn.target = "_blank";
  btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Baixar ofício assinado';

  const { data: signed } = await gerarSignedUrl(proj.pdf_assinado_url);
  btn.href = signed?.signedUrl || "#";
  footer.insertBefore(btn, footer.firstChild);
}

function renderMotivoRecusa(proj) {
  if (proj.status !== "recusado" || !proj.motivo_recusa) return;

  const aviso = document.createElement("div");
  aviso.id = "modal-motivo-recusa";
  aviso.className = "alert alert-danger mt-3 mb-0 small";
  aviso.innerHTML = `<strong>Solicitação recusada.</strong> Motivo: ${escapeHtml(proj.motivo_recusa)}`;
  document.querySelector("#modalDetalhes .modal-body").appendChild(aviso);
}

// ---- Tabela de produtos do formulário --------------------------------------

export function adicionarLinhaProduto() {
  const tbody = $("corpo-tabela-produtos");
  const index = tbody.rows.length + 1;
  const opcoesUnidade = UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join("");

  const tr = document.createElement("tr");
  tr.innerHTML = `
        <td class="text-muted">${index}</td>
        <td><input type="text" class="form-control form-control-sm product-name" placeholder="Nome do reagente/material"></td>
        <td><input type="number" min="0" step="any" class="form-control form-control-sm product-qty" placeholder="Quantidade"></td>
        <td>
            <select class="form-select form-select-sm product-unit">${opcoesUnidade}</select>
        </td>
        <td>
            <button type="button" class="btn btn-outline-danger btn-sm btn-remover-item" aria-label="Remover item">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
  tr.querySelector(".btn-remover-item").addEventListener("click", () => {
    tr.remove();
    renumerarLinhas();
  });
  tbody.appendChild(tr);
}

function renumerarLinhas() {
  const tbody = $("corpo-tabela-produtos");
  Array.from(tbody.rows).forEach((row, i) => {
    row.cells[0].textContent = i + 1;
  });
}
