// Helpers genéricos de DOM.

// Escapa texto antes de inserir em innerHTML (previne XSS).
export function escapeHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Atalho para document.getElementById.
export const $ = (id) => document.getElementById(id);