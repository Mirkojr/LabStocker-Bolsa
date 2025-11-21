import { supabaseClient } from './supabaseClient.js';

// Seletores
const logoutButton = document.getElementById('btn-logout');
const greetingElement = document.getElementById('user-greeting');

// Função para carregar o nome do usuário
async function loadUserName() {
    try {
        // 1. Pega o usuário logado (Auth)
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            // 2. Busca o nome na tabela Perfis
            const { data, error } = await supabaseClient
                .from('Perfis')
                .select('nome, sobrenome')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            // 3. Atualiza o texto na tela
            if (data) {
                greetingElement.textContent = `Bem-vindo(a), ${data.nome}`;
                // Se quiser nome completo use: ${data.nome} ${data.sobrenome}
            }
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error.message);
        greetingElement.textContent = 'Bem-vindo(a)';
    }
}

// Espera o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
    
    // Carrega o nome assim que a página abre
    loadUserName();

    // Lógica de Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabaseClient.auth.signOut();
            
            if (error) {
                console.error('Erro ao fazer logout:', error.message);
                alert('Erro ao sair.');
            } else {
                window.location.href = '../index.html';
            }
        });
    }
});