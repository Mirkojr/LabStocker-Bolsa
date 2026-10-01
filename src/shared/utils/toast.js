import { escapeHtml } from "./dom.js";

// Garante que exista um container de toasts na pagina.
// Centralizar isso aqui faz o feedback visual funcionar em QUALQUER tela,
// sem depender de cada HTML declarar manualmente o #toast-container.
function obterContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

// No celular os toasts ficam embaixo da tela (ver #toast-container no CSS).
// Com um modal aberto, sobem para logo acima do rodapé dele, para não
// cobrir os botões; a altura do modal varia, então a posição é medida.
const TELA_PEQUENA = "(max-width: 576px)";

function posicionar(container) {
  container.style.bottom = "";
  if (!window.matchMedia(TELA_PEQUENA).matches) return;
  const rodape = document.querySelector(".modal.show .modal-footer");
  if (!rodape) return;
  const acimaDoRodape = window.innerHeight - rodape.getBoundingClientRect().top + 8;
  if (acimaDoRodape > 12) container.style.bottom = `${acimaDoRodape}px`;
}

export function showToast(mensagem, tipo = "success") {
  const container = obterContainer();
  posicionar(container);

  let iconClass = "bi-check-circle-fill";
  let typeClass = "toast-success";

  if (tipo === "error") {
    iconClass = "bi-x-circle-fill";
    typeClass = "toast-error";
  } else if (tipo === "warning") {
    iconClass = "bi-exclamation-triangle-fill";
    typeClass = "toast-warning";
  }

  const toast = document.createElement("div");
  toast.className = `toast-box ${typeClass}`;
  toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${iconClass} fs-4 me-3"></i>
            <span class="fw-semibold text-dark">${escapeHtml(mensagem)}</span>
        </div>
        <button type="button" class="btn-close ms-3" aria-label="Fechar"></button>
    `;

  toast.querySelector(".btn-close").onclick = () => {
    toast.style.animation = "fadeOut 0.5s forwards";
    setTimeout(() => toast.remove(), 500);
  };

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = "fadeOut 0.5s forwards";
      setTimeout(() => toast.remove(), 500);
    }
  }, 4000);
}
