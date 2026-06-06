export function showToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');

    if (!container) {
        console.warn('Toast container não encontrado! Usando alert padrão.');
        alert(mensagem);
        return;
    }

    let iconClass = 'bi-check-circle-fill';
    let typeClass = 'toast-success';

    if (tipo === 'error') {
        iconClass = 'bi-x-circle-fill';
        typeClass = 'toast-error';
    } else if (tipo === 'warning') {
        iconClass = 'bi-exclamation-triangle-fill';
        typeClass = 'toast-warning';
    }

    const toast = document.createElement('div');
    toast.className = `toast-box ${typeClass}`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${iconClass} fs-4 me-3"></i>
            <span class="fw-semibold text-dark">${mensagem}</span>
        </div>
        <button type="button" class="btn-close ms-3" aria-label="Close"></button>
    `;

    toast.querySelector('.btn-close').onclick = () => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => toast.remove(), 500);
        }
    }, 4000);
}