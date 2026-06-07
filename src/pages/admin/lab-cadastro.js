import { showToast } from '../../shared/utils/toast.js';
import { criarLaboratorio } from '../../shared/services/laboratoriosService.js';

// --- LOGICA DO FORMULARIO ---
document.addEventListener('DOMContentLoaded', () => {

    const formlaboratorio = document.getElementById('form-laboratorio');

    if (formlaboratorio) {
        formlaboratorio.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const nome = document.getElementById('lab-nome').value;
            const codigo = document.getElementById('lab-sipac').value;

            try {
                const { error } = await criarLaboratorio([{ nome_laboratorio: nome, codigo_sipac: codigo }]);

                if (error) throw error;

                showToast('Laboratorio cadastrado com sucesso!', 'success');
                formlaboratorio.reset();

            } catch (error) {
                console.error('Erro:', error);
                // Trata erro de codigo duplicado de forma amigavel
                if (error.message.includes('unique constraint')) {
                    showToast('Erro: Este codigo SIPAC ja esta cadastrado.', 'error');
                } else {
                    showToast('Erro ao cadastrar: ' + error.message, 'error');
                }
            }
        });
    }
});
