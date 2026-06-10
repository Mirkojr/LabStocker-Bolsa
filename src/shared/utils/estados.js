// Helpers de estados de UI: carregando, vazio e erro.
// Centralizar isso aqui padroniza a experiencia em todas as telas de
// listagem (mesmo visual, mesma estrutura) e evita codigo duplicado.
//
// O conteudo renderizado e SEMPRE texto definido pelo desenvolvedor
// (icones/titulos/mensagens fixos), nunca dado do usuario, entao e seguro
// usar innerHTML aqui.

function resolverElemento(alvo) {
    if (!alvo) return null;
    return typeof alvo === 'string' ? document.getElementById(alvo) : alvo;
}

/**
 * Mostra um estado de carregamento dentro do container informado.
 * @param {HTMLElement|string} alvo Elemento ou id do container.
 * @param {string} mensagem Texto exibido abaixo do spinner.
 */
export function mostrarCarregando(alvo, mensagem = 'Carregando...') {
    const el = resolverElemento(alvo);
    if (!el) return;
    el.innerHTML = `
        <div class="w-100 text-center py-5 text-muted-light">
            <div class="spinner-border" role="status" aria-hidden="true"></div>
            <p class="mt-3 mb-0">${mensagem}</p>
        </div>`;
}

/**
 * Mostra um estado vazio (nenhum registro / nenhum resultado).
 * @param {HTMLElement|string} alvo Elemento ou id do container.
 * @param {object} [opcoes] icone, titulo e mensagem (todos opcionais).
 */
export function mostrarVazio(alvo, opcoes = {}) {
    const el = resolverElemento(alvo);
    if (!el) return;
    const {
        icone = 'bi-inbox',
        titulo = 'Nada por aqui ainda',
        mensagem = 'Nenhum registro encontrado.'
    } = opcoes;
    el.innerHTML = `
        <div class="w-100 text-center py-5 text-muted-light">
            <i class="bi ${icone} fs-1 opacity-25 d-block mb-3"></i>
            <h6 class="fw-bold mb-1 text-white">${titulo}</h6>
            <p class="mb-0 small">${mensagem}</p>
        </div>`;
}

/**
 * Mostra um estado de erro, com botao opcional de "tentar novamente".
 * @param {HTMLElement|string} alvo Elemento ou id do container.
 * @param {object} [opcoes] mensagem, textoBotao e onTentarNovamente (todos opcionais).
 */
export function mostrarErro(alvo, opcoes = {}) {
    const el = resolverElemento(alvo);
    if (!el) return;
    const {
        mensagem = 'Nao foi possivel carregar os dados.',
        textoBotao = 'Tentar novamente',
        onTentarNovamente = null
    } = opcoes;

    el.innerHTML = `
        <div class="w-100 text-center py-5 text-muted-light">
            <i class="bi bi-exclamation-octagon-fill fs-1 text-danger opacity-75 d-block mb-3"></i>
            <h6 class="fw-bold mb-1 text-white">Ops, algo deu errado</h6>
            <p class="mb-3 small">${mensagem}</p>
            ${onTentarNovamente ? `<button type="button" class="btn btn-sm btn-outline-light rounded-pill px-4" data-acao="tentar-novamente">
                <i class="bi bi-arrow-clockwise me-1"></i>${textoBotao}
            </button>` : ''}
        </div>`;

    if (onTentarNovamente) {
        const btn = el.querySelector('[data-acao="tentar-novamente"]');
        if (btn) btn.addEventListener('click', onTentarNovamente);
    }
}

/**
 * Limpa qualquer estado renderizado no container.
 * @param {HTMLElement|string} alvo Elemento ou id do container.
 */
export function limparEstado(alvo) {
    const el = resolverElemento(alvo);
    if (el) el.innerHTML = '';
}
