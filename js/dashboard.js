import { supabaseClient } from './supabaseClient.js';

// Espera o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
    
    const logoutButton = document.getElementById('btn-logout');

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log('Fazendo logout...');
            
            // Comando de logout do Supabase
            const { error } = await supabaseClient.auth.signOut();
            
            if (error) {
                console.error('Erro ao fazer logout:', error.message);
                alert('Erro ao sair.');
            } else {
                // Sucesso! Redireciona para a página de login
                alert('Você saiu com segurança.');
                window.location.href = '../index.html';
            }
        });
    }
});