import { supabaseClient } from './supabaseClient.js';

// Seletores
const logoutButton = document.getElementById('btn-logout');
const greetingElement = document.getElementById('user-greeting');
// Selecionamos o H2 para mudar o título quando estiver em modo Admin
const pageTitle = document.querySelector('h2'); 

// Função Principal que decide o que mostrar
async function loadDashboardInfo() {
    // 1. Verifica se estamos em modo "Personificação" (Admin acessando um lab)
    const adminLabName = sessionStorage.getItem('ADMIN_SELECTED_LAB_NAME');

    if (adminLabName) {
        // --- CENÁRIO A: MODO ADMINISTRADOR ATIVO (Personificando um Lab) ---
        
        // Muda o título para indicar qual laboratório estamos gerenciando
        if (pageTitle) pageTitle.textContent = `Painel: ${adminLabName}`;

        // Muda a saudação para um aviso visual
        greetingElement.innerHTML = `<span class="badge bg-warning text-dark">MODO ADMINISTRADOR ATIVO</span>`;

        // Cria o botão de "Sair do Laboratório" (Voltar para o Dashboard geral)
        const btnSairModo = document.createElement('button');
        btnSairModo.className = "btn btn-sm btn-outline-warning mt-2 d-block mx-auto fw-bold"; 
        btnSairModo.textContent = "Sair do Laboratório (Voltar ao Admin)";
        
        // Ação do botão: Limpa a sessão de admin e recarrega a página
        btnSairModo.onclick = () => {
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_ID');
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_NAME');
            window.location.reload(); // Recarrega para voltar ao estado normal
        };

        greetingElement.appendChild(btnSairModo);

    } else {
        // --- CENÁRIO B: MODO NORMAL (Usuário Comum ou Admin na sua própria conta) ---
        await loadUserName();

        // === LÓGICA DO BOTÃO ADMIN (QUE ESTAVA FALTANDO) ===
        try {
            // Importação dinâmica para verificar se é admin
            const { checkIsAdmin } = await import('./sessionManager.js');
            const isAdmin = await checkIsAdmin();

            if (isAdmin) {
                // Cria o container do botão
                const btnContainer = document.createElement('div');
                btnContainer.className = "text-center mb-4";
                
                // HTML do botão amarelo
                btnContainer.innerHTML = `
                    <a href="admin-labs.html" class="btn btn-warning fw-bold shadow-sm">
                        <i class="bi bi-plus-circle-fill"></i> Gerenciar/Cadastrar Laboratórios
                    </a>
                `;
                
                // Insere logo APÓS o elemento de saudação ("Bem-vindo...")
                greetingElement.after(btnContainer);
            }
        } catch (error) {
            console.error("Erro ao verificar admin no dashboard:", error);
        }
    }
}

// Função auxiliar para carregar o nome do usuário (Lógica original)
async function loadUserName() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            const { data, error } = await supabaseClient
                .from('Perfis')
                .select('nome, sobrenome')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                greetingElement.textContent = `Bem-vindo(a), ${data.nome}`;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error.message);
        greetingElement.textContent = 'Bem-vindo(a)';
    }
}

// Espera o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
    
    // Executa a lógica principal (Admin Check ou Load User)
    loadDashboardInfo();

    // Lógica de Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            // Se estiver em modo admin, limpamos a sessão antes de sair da conta
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_ID');
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_NAME');

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