import { supabaseClient } from './supabaseClient.js';

// --- Seletores de Elementos ---
const listaReagentesEl = document.getElementById('lista-reagentes');
const formReagente = document.getElementById('form-reagente');
const inputBusca = document.getElementById('input-busca');
const spinner = document.getElementById('loading-spinner');
// Pega a instância do Modal do Bootstrap
const modalReagente = new bootstrap.Modal(document.getElementById('modal-reagente'));


// --- Funções ---

/**
 * Busca reagentes no Supabase (com filtro opcional) e atualiza a tela.
 */
async function fetchReagentes(filtroNome = '') {
    // Mostra o spinner e limpa a lista
    spinner.classList.remove('d-none');
    listaReagentesEl.innerHTML = '';

    try {
        let query = supabaseClient.from('Reagente').select('*').order('nome');

        // Se houver filtro, adiciona a busca .ilike() (case-insensitive)
        if (filtroNome) {
            query = query.ilike('nome', `%${filtroNome}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data.length === 0) {
            listaReagentesEl.innerHTML = '<p class="text-center text-muted">Nenhum reagente encontrado.</p>';
        } else {
            // Renderiza os itens na tela
            renderReagentes(data);
        }

    } catch (error) {
        console.error('Erro ao buscar reagentes:', error.message);
        listaReagentesEl.innerHTML = '<p class="text-center text-danger">Erro ao carregar reagentes.</p>';
    } finally {
        // Esconde o spinner
        spinner.classList.add('d-none');
    }
}

/**
 * Renderiza a lista de reagentes no HTML.
 */
function renderReagentes(reagentes) {
    reagentes.forEach(reagente => {
        // (Como você pediu, por enquanto não é um link, mas é aqui que você o faria)
        const itemHtml = `
            <div classj="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${reagente.nome}</h5>
                </div>
                <p class="mb-1">${reagente.composicao_quimica || 'Sem composição'}</p>
                <small class="text-muted">${reagente.instituicao_controladora || 'Sem controle'}</small>
            </div>
        `;
        listaReagentesEl.innerHTML += itemHtml;
    });
}

/**
 * Lida com o cadastro de um novo reagente (submit do modal).
 */
async function handleCadastro(evento) {
    evento.preventDefault();
    
    // Pega os dados do formulário do modal
    const nome = document.getElementById('reagente-nome').value;
    const composicao = document.getElementById('reagente-composicao').value;
    const controladora = document.getElementById('reagente-controladora').value;

    try {
        const { error } = await supabaseClient
            .from('Reagente')
            .insert({
                nome: nome,
                composicao_quimica: composicao,
                instituicao_controladora: controladora
            });
        
        if (error) throw error;

        alert('Reagente cadastrado com sucesso!');
        formReagente.reset(); // Limpa o formulário
        modalReagente.hide(); // Fecha o modal
        fetchReagentes(); // Atualiza a lista na tela

    } catch (error) {
        console.error('Erro ao cadastrar:', error.message);
        alert('Erro ao cadastrar: ' + error.message);
    }
}


// --- Event Listeners (Ouvintes de Eventos) ---

// 1. Quando o DOM carregar, busca os reagentes
document.addEventListener('DOMContentLoaded', () => {
    fetchReagentes();
});

// 2. Quando o formulário do modal for enviado
formReagente.addEventListener('submit', handleCadastro);

// 3. Quando o usuário digitar na busca (com debounce)
let debounceTimer;
inputBusca.addEventListener('keyup', () => {
    clearTimeout(debounceTimer);
    // Espera 300ms após o usuário parar de digitar para fazer a busca
    debounceTimer = setTimeout(() => {
        fetchReagentes(inputBusca.value);
    }, 300);
});