// Modal de confirmacao reutilizavel (substitui o confirm() nativo).
// Cria o modal dinamicamente no body, entao funciona em qualquer pagina
// sem precisar declarar o HTML. Sempre retorna uma Promise.
//
// Depende do bundle do Bootstrap (window.bootstrap), ja carregado nas paginas.

function criarModalBase() {
  const wrapper = document.createElement("div");
  wrapper.className = "modal fade";
  wrapper.tabIndex = -1;
  wrapper.setAttribute("aria-hidden", "true");
  document.body.appendChild(wrapper);
  return wrapper;
}

/**
 * Exibe um modal de confirmacao simples.
 * @param {object} [opcoes]
 * @returns {Promise<boolean>} true se confirmado, false caso contrario.
 */
export function confirmar({
  titulo = "Confirmar ação",
  mensagem = "Tem certeza?",
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  tipo = "danger",
  icone = "bi-exclamation-triangle-fill",
} = {}) {
  return new Promise((resolve) => {
    const wrapper = criarModalBase();
    wrapper.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius:20px; overflow:hidden;">
                    <div class="modal-body p-4 text-center">
                        <div class="mb-3"><i class="bi ${icone} text-${tipo}" style="font-size:2.5rem;"></i></div>
                        <h5 class="fw-bold mb-2 text-dark-emphasis">${titulo}</h5>
                        <p class="text-muted mb-4">${mensagem}</p>
                        <div class="d-flex gap-2 justify-content-center">
                            <button type="button" class="btn btn-outline-secondary rounded-pill px-4" data-acao="cancelar">${textoCancelar}</button>
                            <button type="button" class="btn btn-${tipo} rounded-pill px-4 fw-bold" data-acao="confirmar">${textoConfirmar}</button>
                        </div>
                    </div>
                </div>
            </div>`;

    const modal = new bootstrap.Modal(wrapper);
    let resultado = false;

    wrapper.querySelector('[data-acao="confirmar"]').addEventListener("click", () => {
      resultado = true;
      modal.hide();
    });
    wrapper.querySelector('[data-acao="cancelar"]').addEventListener("click", () => modal.hide());

    wrapper.addEventListener("hidden.bs.modal", () => {
      wrapper.remove();
      resolve(resultado);
    });

    modal.show();
  });
}

/**
 * Modal de recusa: confirma a acao E coleta um motivo (textarea).
 * @param {object} [opcoes]
 * @returns {Promise<{confirmado: boolean, motivo: string}>}
 */
export function confirmarRecusa({
  titulo = "Recusar pedido",
  mensagem = "Descreva o motivo da recusa. Ele fica visível para quem fez o pedido.",
  textoConfirmar = "Recusar",
  obrigatorio = true,
  maxLength = 300,
} = {}) {
  return new Promise((resolve) => {
    const wrapper = criarModalBase();
    wrapper.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius:20px; overflow:hidden;">
                    <div class="modal-header bg-danger text-white border-0">
                        <h5 class="modal-title fw-bold">${titulo}</h5>
                        <button type="button" class="btn-close btn-close-white" data-acao="cancelar" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body p-4">
                        <p class="text-muted small mb-2">${mensagem}</p>
                        <textarea class="form-control" data-campo="motivo" rows="3" maxlength="${maxLength}"
                            placeholder="Ex.: estoque insuficiente no momento."></textarea>
                        <div class="text-danger small mt-1 d-none" data-erro="motivo"></div>
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-outline-secondary rounded-pill px-4" data-acao="cancelar">Cancelar</button>
                        <button type="button" class="btn btn-danger rounded-pill px-4 fw-bold" data-acao="confirmar">${textoConfirmar}</button>
                    </div>
                </div>
            </div>`;

    const modal = new bootstrap.Modal(wrapper);
    const textarea = wrapper.querySelector('[data-campo="motivo"]');
    const erroEl = wrapper.querySelector('[data-erro="motivo"]');
    let payload = { confirmado: false, motivo: "" };

    wrapper.querySelector('[data-acao="confirmar"]').addEventListener("click", () => {
      const motivo = textarea.value.trim();
      if (obrigatorio && !motivo) {
        erroEl.textContent = "Informe o motivo da recusa.";
        erroEl.classList.remove("d-none");
        textarea.classList.add("is-invalid");
        return;
      }
      payload = { confirmado: true, motivo };
      modal.hide();
    });

    wrapper
      .querySelectorAll('[data-acao="cancelar"]')
      .forEach((b) => b.addEventListener("click", () => modal.hide()));

    wrapper.addEventListener("hidden.bs.modal", () => {
      wrapper.remove();
      resolve(payload);
    });

    modal.show();
    setTimeout(() => textarea.focus(), 300);
  });
}
