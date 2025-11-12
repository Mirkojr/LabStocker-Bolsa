// --- 1. CONEXÃO COM O SUPABASE ---
// Substitua pelas suas credenciais do Supabase
const SUPABASE_URL = 'https://tnhjibckjzjthgmlpimw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuaGppYmNranpqdGhnbWxwaW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTI4NjEsImV4cCI6MjA3ODA4ODg2MX0.R3pw9Xmxj-Q2F9JWTNz-Bjh-aFftvoxDefLKKhDCllQ';

// A biblioteca do CDN (que você importou no HTML) cria um objeto
// global chamado 'supabase'. O erro aconteceu porque tentamos
// criar uma *nova* variável com o mesmo nome.

// A FORMA CORRETA:
// Vamos chamar nossa variável de 'supabaseClient' para evitar o conflito.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase conectado!', supabaseClient);


// --- 2. LÓGICA DO FORMULÁRIO ---

// Espera o HTML estar 100% carregado para executar o código
document.addEventListener('DOMContentLoaded', () => {
    
    // Seleciona o formulário pelo ID que demos a ele
    const formLaboratorio = document.getElementById('form-laboratorio');

    // Adiciona um "escutador" para quando o formulário for enviado
    formLaboratorio.addEventListener('submit', async (evento) => {
        
        // Impede que a página recarregue (comportamento padrão do form)
        evento.preventDefault();

        // Pega os valores digitados nos campos do formulário
        const nome = document.getElementById('lab-nome').value;
        const codigo = document.getElementById('lab-sipac').value;

        // Bloco try...catch para capturar erros (ex: Código SIPAC duplicado)
        try {
            // O COMANDO CENTRAL DO SUPABASE
            // *** MUDANÇA AQUI: usando 'supabaseClient' ***
            const { data, error } = await supabaseClient
                .from('Laboratorio') // 1. De qual tabela?
                .insert([             // 2. O que inserir?
                    { nome_laboratorio: nome, codigo_sipac: codigo }
                ])
                .select(); // 3. (Opcional) Retorna o que foi inserido

            // Se deu erro (ex: violou a regra "Unique" do SIPAC)
            if (error) {
                throw error; // Joga o erro para o bloco 'catch'
            }

            // Se deu tudo certo
            alert('Laboratório cadastrado com sucesso!');
            console.log('Dados inseridos:', data);
            formLaboratorio.reset(); // Limpa o formulário

        } catch (error) {
            // Se deu algum erro, mostra para o usuário
            alert('Erro ao cadastrar: ' + error.message);
            console.error('Erro:', error);
        }
    });
});