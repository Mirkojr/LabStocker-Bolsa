import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils/toast.js';

// --- Seletores ---
const formFeedback = document.getElementById('form-feedback');
const tipoSelect = document.getElementById('tipo-feedback');
const msgInput = document.getElementById('msg-feedback');
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