import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils/toast.js';

// --- LÓGICA DO FORMULÁRIO ---
document.addEventListener('DOMContentLoaded', () => {
    
    const formlaboratorio = document.getElementById('form-laboratorio');

    if (formlaboratorio) {
        formlaboratorio.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const nome = document.getElementById('lab-nome').value;
            const codigo = document.getElementById('lab-sipac').value;

            try {
                const { data, error } = await supabaseClient
                    .from('laboratorio')
                    .insert([{ nome_laboratorio: nome, codigo_sipac: codigo }])
                    .select();

                if (error) throw error;

                showToast('Laboratório cadastrado com sucesso!', 'success');
                formlaboratorio.reset();

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