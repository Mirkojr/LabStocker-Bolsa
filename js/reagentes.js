import { supabaseClient } from './supabaseClient.js';

// --- Seletores de Elementos ---
const listaReagentesEl = document.getElementById('lista-reagentes');
const formReagente = document.getElementById('form-reagente');
const inputBusca = document.getElementById('input-busca');
const spinner = document.getElementById('loading-spinner');
const btnCadastrar = document.querySelector('[data-bs-target="#modal-reagente"]');
const modalEl = document.getElementById('modal-reagente');
// Inicializa o Modal do Bootstrap corretamente
const modalReagente = new bootstrap.Modal(modalEl);

// Seletores internos do modal
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formReagente.querySelector('button[type="submit"]');
const editIdInput = document.getElementById('reagente-edit-id');
const nomeInput = document.getElementById('reagente-nome');
const composicaoInput = document.getElementById('reagente-composicao');
const controladoraInput = document.getElementById('reagente-controladora');

// --- Funções ---

async function fetchReagentes(filtroNome = '') {
    spinner.classList.remove('d-none');
    listaReagentesEl.innerHTML = '';

    try {
        let query = supabaseClient.from('Reagente').select('*').order('nome');
        if (filtroNome) {
            query = query.ilike('nome', `%${filtroNome}%`);
        }
        const { data, error } = await query;
        if (error) throw error;

        if (data.length === 0) {
            listaReagentesEl.innerHTML = '<div class="list-group-item text-center text-muted">Nenhum reagente encontrado.</div>';
        } else {
            renderReagentes(data);
        }
    } catch (error) {
        console.error('Erro ao buscar reagentes:', error.message);
        listaReagentesEl.innerHTML = '<div class="list-group-item text-center text-danger">Erro ao carregar reagentes.</div>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderReagentes(reagentes) {
    reagentes.forEach(reagente => {
        const itemHtml = `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-1">${reagente.nome}</h5>
                    <p class="mb-1">${reagente.composicao_quimica || 'Sem composição'}</p>
                    <small class="text-muted">${reagente.instituicao_controladora || 'Sem controle'}</small>
                </div>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-secondary btn-sm btn-edit" 
                        data-id="${reagente.id}"
                        data-nome="${reagente.nome}"
                        data-composicao="${reagente.composicao_quimica || ''}"
                        data-controladora="${reagente.instituicao_controladora || ''}">
                        Editar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm btn-delete" data-id="${reagente.id}">
                        Excluir
                    </button>
                </div>
            </div>
        `;
        listaReagentesEl.innerHTML += itemHtml;
    });
}

async function handleFormSubmit(evento) {
    evento.preventDefault();
    
    const id = editIdInput.value;
    const dadosForm = {
        nome: nomeInput.value,
        composicao_quimica: composicaoInput.value,
        instituicao_controladora: controladoraInput.value
    };

    try {
        let query;
        if (id) {
            // ATUALIZAR
            query = supabaseClient.from('Reagente').update(dadosForm).eq('id', id);
        } else {
            // CRIAR
            query = supabaseClient.from('Reagente').insert(dadosForm);
        }

        const { error } = await query;
        if (error) throw error;

        alert(id ? 'Reagente atualizado com sucesso!' : 'Reagente cadastrado com sucesso!');
        modalReagente.hide();
        fetchReagentes(inputBusca.value);

    } catch (error) {
        console.error('Erro ao salvar reagente:', error.message);
        alert('Erro ao salvar: ' + error.message);
    }
}

function handleEditClick(button) {
    const { id, nome, composicao, controladora } = button.dataset;

    editIdInput.value = id;
    nomeInput.value = nome;
    composicaoInput.value = composicao;
    controladoraInput.value = controladora;

    modalTitle.textContent = 'Editar Reagente';
    modalSubmitBtn.textContent = 'Atualizar';

    modalReagente.show();
}

async function handleDeleteClick(button) {
    const id = button.dataset.id;
    
    if (confirm('Tem certeza que deseja excluir este reagente do catálogo?')) {
        try {
            const { error } = await supabaseClient.from('Reagente').delete().eq('id', id);
            
            if (error) {
                // Se o erro for violação de chave estrangeira (Código 23503)
                if (error.code === '23503') {
                    throw new Error('Não é possível excluir este reagente pois ele está cadastrado no estoque de um ou mais laboratórios. Remova-o dos estoques antes de excluir do catálogo.');
                }
                throw error; // Lança outros erros normalmente
            }
            
            alert('Reagente excluído com sucesso.');
            fetchReagentes(inputBusca.value);

        } catch (error) {
            console.error('Erro ao excluir:', error.message);
            alert('Erro: ' + error.message);
        }
    }
}

function resetModal() {
    formReagente.reset();
    editIdInput.value = '';
    modalTitle.textContent = 'Cadastrar Novo Reagente';
    modalSubmitBtn.textContent = 'Salvar';
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchReagentes();
});

formReagente.addEventListener('submit', handleFormSubmit);

let debounceTimer;
inputBusca.addEventListener('keyup', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchReagentes(inputBusca.value);
    }, 300);
});

listaReagentesEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-edit')) handleEditClick(e.target);
    if (e.target.classList.contains('btn-delete')) handleDeleteClick(e.target);
});

// Correção importante: Verifica se o botão existe antes de adicionar evento
if (btnCadastrar) {
    btnCadastrar.addEventListener('click', resetModal);
}

modalEl.addEventListener('hidden.bs.modal', resetModal);