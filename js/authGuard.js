import { supabaseClient } from './supabaseClient.js';

// Esta é uma função auto-executável que roda assim que o script é carregado
(async () => {
    // Pega a sessão atual do usuário
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Se NÃO houver sessão (usuário não logado)
        alert('Você precisa estar logado para acessar esta página.');
        // Redireciona para a página de login
        window.location.href = '../index.html';
    } else {
        // Se houver sessão, apenas exibe no console (para teste)
        console.log('Usuário autenticado:', session.user.email);
    }
})();