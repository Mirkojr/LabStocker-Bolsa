
import { supabaseClient } from './supabaseClient.js';
import { criarPerfilUsuario } from './services/perfisService.js';


console.log('Cliente importado em register.js');

// --- 2. LÓGICA DE CADASTRO ---

document.addEventListener('DOMContentLoaded', () => {
    
    const formRegister = document.getElementById('form-register');

    formRegister.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        // Coletar todos os dados do formulário
        const email = document.getElementById('register-email').value;
        const senha = document.getElementById('register-senha').value;
        const confirmarSenha = document.getElementById('register-confirmar-senha').value;
        const nome = document.getElementById('register-nome').value;
        const sobrenome = document.getElementById('register-sobrenome').value;
        const codigoSipac = document.getElementById('register-sipac').value;
        const identificador = document.getElementById('register-identificador').value;
        
        // Pega o valor do botão de rádio (SIAPE ou MATRICULA)
        const tipoIdentificador = document.querySelector('input[name="tipo_identificador"]:checked')?.value;

        // --- VALIDAÇÕES INICIAIS ---
        if (senha !== confirmarSenha) {
            alert('As senhas não coincidem!');
            return;
        }
        if (!tipoIdentificador) {
            alert('Por favor, selecione se é Técnico ou Aluno.');
            return;
        }

        try {
            // --- ETAPA 1: Encontrar o ID do Laboratório usando o Código SIPAC ---
            // (Requer a política RLS de Leitura na tabela 'laboratorio' que já fizemos)
            
            const { data: labData, error: labError } = await supabaseClient
                .from('laboratorio')
                .select('id') // Queremos o 'id' (uuid)
                .eq('codigo_sipac', codigoSipac) // Onde o 'codigo_sipac' for igual ao que o usuário digitou
                .single(); // Esperamos APENAS um resultado

            if (labError || !labData) {
                throw new Error('Código SIPAC do laboratório não encontrado ou inválido.');
            }
            
            const laboratorioId = labData.id; // Este é o UUID do laboratório que precisamos!

            // --- ETAPA 2 e 3: Criar o usuário no Auth e o perfil vinculado ---
            const { error: profileError } = await criarPerfilUsuario(email, senha, {
                nome: nome,
                sobrenome: sobrenome,
                identificador: identificador,
                tipo_identificador: tipoIdentificador,
                id_laboratorio: laboratorioId,
            });

            if (profileError) throw profileError;

            // SUCESSO!
            alert('Cadastro realizado com sucesso! Você será redirecionado para o login.');
            window.location.href = '../index.html'; // Manda o usuário de volta para a tela de login

        } catch (error) {
            console.error('Erro no cadastro:', error.message);
            alert('Erro no cadastro: ' + error.message);
        }
    });
});