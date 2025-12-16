import { supabaseClient } from './supabaseClient.js';

console.log('Cliente importado em auth.js');

function showToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    
    if (!container) {
        console.warn('Toast container não encontrado! Usando alert padrão.');
        alert(mensagem);
        return;
    }

    let iconClass = 'bi-check-circle-fill';
    let typeClass = 'toast-success';
    
    if (tipo === 'error') {
        iconClass = 'bi-x-circle-fill';
        typeClass = 'toast-error';
    } else if (tipo === 'warning') {
        iconClass = 'bi-exclamation-triangle-fill';
        typeClass = 'toast-warning';
    }

    const toast = document.createElement('div');
    toast.className = `toast-box ${typeClass}`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${iconClass} fs-4 me-3"></i>
            <span class="fw-semibold text-dark">${mensagem}</span>
        </div>
        <button type="button" class="btn-close ms-3" aria-label="Close"></button>
    `;

    toast.querySelector('.btn-close').onclick = () => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => toast.remove(), 500);
        }
    }, 4000);
}


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