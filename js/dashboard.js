import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils/toast.js';
import { buscarNomePorId } from './services/perfisService.js';

// Seletores
const logoutButton = document.getElementById('btn-logout');
const greetingElement = document.getElementById('user-greeting');
const pageTitle = document.querySelector('h2'); 

async function loadDashboardInfo() {
    const adminLabName = sessionStorage.getItem('ADMIN_SELECTED_LAB_NAME');

    if (adminLabName) {
        // MODO ADMINISTRADOR ATIVO
        if (pageTitle) pageTitle.textContent = `Painel: ${adminLabName}`;
        greetingElement.innerHTML = `<span class="badge bg-warning text-dark px-3 py-2">MODO ADMINISTRADOR ATIVO</span>`;

        const btnSairModo = document.createElement('button');
        btnSairModo.className = "btn btn-sm btn-outline-warning mt-3 d-block mx-auto fw-bold rounded-pill"; 
        btnSairModo.textContent = "Sair do Laboratório (Voltar ao Admin)";
        
        btnSairModo.onclick = () => {
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_ID');
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_NAME');
            showToast("Voltando ao painel administrativo...", "warning");
            setTimeout(() => window.location.reload(), 1000);
        };
        greetingElement.appendChild(btnSairModo);

    } else {
        // MODO NORMAL
        await loadUserName();

        try {
            const { checkIsAdmin } = await import('./sessionManager.js');
            const isAdmin = await checkIsAdmin();

            if (isAdmin) {
                const btnContainer = document.createElement('div');
                btnContainer.className = "text-center mb-4";
                btnContainer.innerHTML = `
                    <a href="admin-labs.html" class="btn btn-warning fw-bold shadow-sm rounded-pill px-4">
                        <i class="bi bi-plus-circle-fill me-2"></i> Gerenciar Laboratórios
                    </a>
                `;
                greetingElement.after(btnContainer);
            }
        } catch (error) {
            console.error("Erro ao verificar admin:", error);
        }
    }
}

async function loadUserName() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { data, error } = await buscarNomePorId(user.id);

            if (error) throw error;
            if (data) greetingElement.textContent = `Olá, ${data.nome}!`;
        }
    } catch (error) {
        greetingElement.textContent = 'Bem-vindo(a)!';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardInfo();

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_ID');
            sessionStorage.removeItem('ADMIN_SELECTED_LAB_NAME');
            
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                showToast('Erro ao sair.', 'error');
            } else {
                showToast('Sessão encerrada. Até logo!', 'success');
                setTimeout(() => window.location.href = '../index.html', 1500);
            }
        });
    }
});