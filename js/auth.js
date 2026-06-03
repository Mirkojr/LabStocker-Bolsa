import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils/toast.js';


document.addEventListener('DOMContentLoaded', () => {
    
    const formLogin = document.getElementById('form-login');
    const btnSubmit = formLogin ? formLogin.querySelector('button[type="submit"]') : null;

    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const originalBtnText = btnSubmit.innerHTML;
            if (btnSubmit) {
                btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Entrando...';
                btnSubmit.disabled = true;
            }

            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-senha').value;

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: senha,
                });

                if (error) throw error;

                // SUCESSO!
                showToast('Login realizado com sucesso! Redirecionando...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'pages/dashboard.html';
                }, 1500);

            } catch (error) {
                console.error('Erro no login:', error.message);
                
                if (error.message.includes('Invalid login credentials')) {
                    showToast('Email ou senha incorretos.', 'error');
                } else {
                    showToast('Erro ao entrar: ' + error.message, 'error');
                }

                if (btnSubmit) {
                    btnSubmit.innerHTML = originalBtnText;
                    btnSubmit.disabled = false;
                }
            }
        });
    }
});