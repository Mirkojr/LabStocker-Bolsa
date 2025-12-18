import { supabaseClient } from './supabaseClient.js';

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
function showToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let iconClass = 'bi-check-circle-fill', typeClass = 'toast-success';
    if (tipo === 'error') { iconClass = 'bi-x-circle-fill'; typeClass = 'toast-error'; }

    const toast = document.createElement('div');
    toast.className = `toast-box ${typeClass}`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${iconClass} fs-4 me-3"></i>
            <span class="fw-semibold text-dark">${mensagem}</span>
        </div>
        <button type="button" class="btn-close ms-3"></button>`;
    
    toast.querySelector('.btn-close').onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentElement) toast.remove(); }, 4000);
}

// --- LÓGICA DO FORMULÁRIO ---
document.addEventListener('DOMContentLoaded', () => {
    
    const formLaboratorio = document.getElementById('form-laboratorio');

    if (formLaboratorio) {
        formLaboratorio.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const nome = document.getElementById('lab-nome').value;
            const codigo = document.getElementById('lab-sipac').value;

            try {
                const { data, error } = await supabaseClient
                    .from('Laboratorio')
                    .insert([{ nome_laboratorio: nome, codigo_sipac: codigo }])
                    .select();

                if (error) throw error;

                showToast('Laboratório cadastrado com sucesso!', 'success');
                formLaboratorio.reset();

            } catch (error) {
                console.error('Erro:', error);
                // Trata erro de código duplicado de forma amigável
                if (error.message.includes('unique constraint')) {
                    showToast('Erro: Este código SIPAC já está cadastrado.', 'error');
                } else {
                    showToast('Erro ao cadastrar: ' + error.message, 'error');
                }
            }
        });
    }
});