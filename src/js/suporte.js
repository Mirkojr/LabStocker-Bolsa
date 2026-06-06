import { showToast } from './utils/toast.js';
import { getUsuarioLogado } from './services/authService.js';
import { enviarFeedback } from './services/feedbackService.js';

// --- Seletores ---
const formfeedback = document.getElementById('form-feedback');
const tipoSelect = document.getElementById('tipo-feedback');
const msgInput = document.getElementById('msg-feedback');

async function enviarfeedback(e) {
    e.preventDefault();

    const tipo = tipoSelect.value;
    const mensagem = msgInput.value;
    const btnSubmit = formfeedback.querySelector('button');

    // feedback visual de carregamento
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> ENVIANDO...';

    try {
        // Pega o usuario logado para vincular ao feedback
        const { data: { user } } = await getUsuarioLogado();

        if (!user) throw new Error("A sessao expirou. Faca login novamente.");

        // Salva na tabela 'feedback' via camada de service
        const { error } = await enviarFeedback({
            user_id: user.id,
            tipo: tipo,
            mensagem: mensagem,
            status: 'Pendente'
        });

        if (error) throw error;

        // Sucesso
        showToast("Obrigado! Sua mensagem foi enviada a equipe tecnica.", "success");
        formfeedback.reset();

    } catch (error) {
        console.error('Erro suporte:', error);
        showToast("Erro ao enviar: " + error.message, "error");
    } finally {
        // Restaura o botao original
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = textoOriginal;
    }
}

// --- Inicializacao ---
document.addEventListener('DOMContentLoaded', () => {
    if (formfeedback) {
        formfeedback.addEventListener('submit', enviarfeedback);
    }
});
