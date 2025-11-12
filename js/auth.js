import { supabaseClient } from './supabaseClient.js';

console.log('Cliente importado em auth.js');

// --- 2. LÓGICA DO LOGIN ---

document.addEventListener('DOMContentLoaded', () => {
    
    const formLogin = document.getElementById('form-login');

    // Escutador para o formulário de LOGIN
    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault(); // Impede recarregar a página

            const email = document.getElementById('login-email').value;
            const senha = document.getElementById('login-senha').value;

            try {
                // Comando de Login do Supabase
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: senha,
                });

                if (error) throw error;

                // SUCESSO!
                console.log('Login bem-sucedido!', data.user);
                alert('Login efetuado com sucesso!');
                
                // Redireciona o usuário para a página principal do app
                // (ainda não a criamos, mas vamos chamá-la de 'dashboard.html')
                window.location.href = 'pages/dashboard.html';

            } catch (error) {
                console.error('Erro no login:', error.message);
                alert('Falha no login: ' + error.message);
            }
        });
    }

    // (O botão 'Cadastrar-se' é um link <a>, então ele 
    // já funciona e nos leva para 'register.html' sem precisar de JS)
});