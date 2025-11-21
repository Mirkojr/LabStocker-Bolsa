import { supabaseClient } from './supabaseClient.js';

const formFeedback = document.getElementById('form-feedback');
const tipoSelect = document.getElementById('tipo-feedback');
const msgInput = document.getElementById('msg-feedback');

async function enviarFeedback(e) {
    e.preventDefault();

    const tipo = tipoSelect.value;
    const mensagem = msgInput.value;
    const btnSubmit = formFeedback.querySelector('button');

    // Efeito visual de carregando
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Enviando...";

    try {
        // Pega o usuário atual
        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) throw new Error("Usuário não logado.");

        // Salva no banco
        const { error } = await supabaseClient
            .from('Feedback')
            .insert({
                user_id: user.id,
                tipo: tipo,
                mensagem: mensagem,
                status: 'Pendente'
            });

        if (error) throw error;

        alert("Obrigado! Sua mensagem foi enviada com sucesso.");
        formFeedback.reset();

    } catch (error) {
        console.error(error);
        alert("Erro ao enviar: " + error.message);
    } finally {
        // Restaura o botão
        btnSubmit.disabled = false;
        btnSubmit.innerText = textoOriginal;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (formFeedback) {
        formFeedback.addEventListener('submit', enviarFeedback);
    }
});