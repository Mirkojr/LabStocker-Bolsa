import { supabaseClient } from './js/supabaseClient.js';
import { showToast } from './js/utils/toast.js';

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
                // 1. Faz a autenticação no Supabase Auth
                const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: senha,
                });

                if (authError) throw authError;

                // 2. Busca o perfil na tabela (com nome corrigido para minúsculo)
                const { data: perfilData, error: perfilError } = await supabaseClient
                    .from('perfis')
                    .select('is_admin')
                    .eq('id', authData.user.id)
                    .single();

                // Se houver erro ao buscar o perfil (ex: o usuário não existe na tabela perfis)
                if (perfilError) {
                    console.error('Erro ao buscar perfil:', perfilError.message);
                    // Opcional: Desloga o usuário se ele não tiver perfil vinculado
                    await supabaseClient.auth.signOut();
                    throw new Error('Usuário autenticado, mas nenhum perfil correspondente foi encontrado.');
                }

                // SUCESSO!
                showToast('Login realizado com sucesso! Redirecionando...', 'success');
                
                setTimeout(() => {
                    // Aqui você decide para onde mandar baseado no is_admin do banco
                    if (perfilData && perfilData.is_admin) {
                        window.location.href = 'pages/dashboard.html'; // Mude para a rota de admin se tiver uma específica
                    } else {
                        window.location.href = 'pages/dashboard.html';
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