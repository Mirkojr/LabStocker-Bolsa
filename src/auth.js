import { showToast } from './shared/utils/toast.js';
import { login, logout } from './shared/services/authService.js';
import { buscarFlagAdminPorId } from './shared/services/perfisService.js';

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const btnSubmit = formLogin ? formLogin.querySelector('button[type="submit"]') : null;

    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const originalBtnText = btnSubmit ? btnSubmit.innerHTML : 'Entrar';
            if (btnSubmit) {
                btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Entrando...';
                btnSubmit.disabled = true;
            }

            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-senha').value;

            try {
                // 1. Faz a autenticacao via camada de service (Supabase Auth)
                const { data: authData, error: authError } = await login(email, senha);

                if (authError) throw authError;

                // 2. Busca a flag de admin do perfil correspondente
                const { data: perfilData, error: perfilError } = await buscarFlagAdminPorId(authData.user.id);

                // Se houver erro ao buscar o perfil (ex: o usuario nao existe na tabela perfis)
                if (perfilError) {
                    console.error('Erro ao buscar perfil:', perfilError.message);
                    // Desloga o usuario se ele nao tiver perfil vinculado
                    await logout();
                    throw new Error('Usuario autenticado, mas nenhum perfil correspondente foi encontrado.');
                }

                // SUCESSO!
                showToast('Login realizado com sucesso! Redirecionando...', 'success');

                setTimeout(() => {
                    if (perfilData && perfilData.is_admin) {
                        window.location.href = 'pages/dashboard/dashboard.html';
                    } else {
                        window.location.href = 'pages/dashboard/dashboard.html';
                    }
                }, 1500);

            } catch (error) {
                console.error('Erro completo retornado pelo Supabase:', error);

                const mensagemErro = error && error.message ? error.message : 'Erro desconhecido';

                if (mensagemErro.includes('Invalid login credentials')) {
                    showToast('Email ou senha incorretos.', 'error');
                } else if (mensagemErro.includes('Email not confirmed')) {
                    showToast('Por favor, confirme seu e-mail antes de acessar.', 'error');
                } else {
                    showToast('Erro ao entrar: ' + mensagemErro, 'error');
                }

                if (btnSubmit) {
                    btnSubmit.innerHTML = originalBtnText;
                    btnSubmit.disabled = false;
                }
            }
        });
    }
});
