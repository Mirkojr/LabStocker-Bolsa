import { supabaseClient } from './supabaseClient.js';

// --- Seletores ---
const formFeedback = document.getElementById('form-feedback');
const tipoSelect = document.getElementById('tipo-feedback');
const msgInput = document.getElementById('msg-feedback');
// --- Funções ---
function showToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let iconClass = 'bi-check-circle-fill', typeClass = 'toast-success';
    if (tipo === 'error') { iconClass = 'bi-x-circle-fill'; typeClass = 'toast-error'; }
    if (tipo === 'warning') { iconClass = 'bi-exclamation-triangle-fill'; typeClass = 'toast-warning'; }

    const toast = document.createElement('div');
    toast.className = `toast-box ${typeClass}`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${iconClass} fs-4 me-3"></i>
            <span class="fw-semibold text-dark">${mensagem}</span>
        </div>
        <button type="button" class="btn-close ms-3"></button>`;
    
    toast.querySelector('.btn-close').onclick = () => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    setTimeout(() => { if(toast.parentElement) { toast.style.animation = 'fadeOut 0.5s forwards'; setTimeout(() => toast.remove(), 500); } }, 4000);
}

async function enviarFeedback(e) {
    e.preventDefault();

    const tipo = tipoSelect.value;
    const mensagem = msgInput.value;
    const btnSubmit = formFeedback.querySelector('button');

    // Feedback visual de carregamento
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> ENVIANDO...';

    try {
        // Pega o usuário logado para vincular ao feedback
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) throw new Error("A sessão expirou. Faça login novamente.");

        // Salva na tabela 'Feedback'
        const { error } = await supabaseClient
            .from('Feedback')
            .insert({
                user_id: user.id,
                tipo: tipo,
                mensagem: mensagem,
                status: 'Pendente'
            });

        if (error) throw error;

        // Sucesso
        showToast("Obrigado! Sua mensagem foi enviada à equipe técnica.", "success");
        formFeedback.reset();

    } catch (error) {
        console.error('Erro suporte:', error);
        showToast("Erro ao enviar: " + error.message, "error");
    } finally {
        // Restaura o botão original
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = textoOriginal;
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    if (formFeedback) {
        formFeedback.addEventListener('submit', enviarFeedback);
    }
});