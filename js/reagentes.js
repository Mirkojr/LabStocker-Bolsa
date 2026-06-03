import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils/toast.js';

// --- Seletores de Elementos ---
const listaReagentesEl = document.getElementById('lista-reagentes');
const formReagente = document.getElementById('form-reagente');
const inputBusca = document.getElementById('input-busca');
const spinner = document.getElementById('loading-spinner');
const btnCadastrar = document.querySelector('[data-bs-target="#modal-reagente"]');

// Modais
const modalEl = document.getElementById('modal-reagente');
const modalReagente = new bootstrap.Modal(modalEl);

const modalConfirmEl = document.getElementById('modal-confirmacao');
const modalConfirmacao = new bootstrap.Modal(modalConfirmEl);
const btnConfirmarExclusao = document.getElementById('btn-confirmar-exclusao');

// Elementos do Form
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formReagente.querySelector('button[type="submit"]');
const editIdInput = document.getElementById('reagente-edit-id');
const nomeInput = document.getElementById('reagente-nome');
const composicaoInput = document.getElementById('reagente-composicao');
const controladoraInput = document.getElementById('reagente-controladora');

// Variável para armazenar o ID temporariamente antes de excluir
let ID_PARA_EXCLUIR = null;

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
            listaReagentesEl.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-eyedropper text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3">Nenhum reagente encontrado no catálogo.</p>
                </div>`;
        } else {
            renderReagentes(data);
        }
    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Erro ao carregar reagentes.', 'error');
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderReagentes(reagentes) {
    listaReagentesEl.innerHTML = '';
    
    reagentes.forEach(reagente => {
        let badgeControlado = '';
        if (reagente.instituicao_controladora) {
            badgeControlado = `
                <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 ms-2">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> ${reagente.instituicao_controladora}
                </span>`;
        }

        const div = document.createElement('div');
        div.className = 'list-group-item p-3 mb-2 shadow-sm rounded border-0';
        div.style.transition = 'transform 0.2s';
        div.onmouseover = () => div.style.transform = 'translateX(5px)';
        div.onmouseout = () => div.style.transform = 'translateX(0)';

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="bg-light rounded-circle p-3 me-3 text-success d-none d-md-block">
                        <i class="bi bi-eyedropper fs-4"></i>
                    </div>
                    <div>
                        <h5 class="mb-1 fw-bold text-dark">
                            ${reagente.nome}
                        </h5>
                        <p class="mb-1 text-muted small font-monospace">
                            ${reagente.composicao_quimica || '<span class="text-muted opacity-50">Sem fórmula</span>'}
                        </p>
                        <div class="mt-1">
                             ${badgeControlado || '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">Não Controlado</span>'}
                        </div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-edit rounded-start-pill px-3" 
                        data-id="${reagente.id}"
                        data-nome="${reagente.nome}"
                        data-composicao="${reagente.composicao_quimica || ''}"
                        data-controladora="${reagente.instituicao_controladora || ''}">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-delete rounded-end-pill px-3" data-id="${reagente.id}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </div>
            </div>
        `;
        listaReagentesEl.appendChild(div);
    });
}

// --- CADASTRO E EDIÇÃO ---
async function handleFormSubmit(evento) {
    evento.preventDefault();
    
    const id = editIdInput.value;
    const dadosForm = {
        nome: nomeInput.value,
        composicao_quimica: composicaoInput.value,
        instituicao_controladora: controladoraInput.value || null
    };

    try {
        let query;
        if (id) {
            query = supabaseClient.from('Reagente').update(dadosForm).eq('id', id);
        } else {
            query = supabaseClient.from('Reagente').insert(dadosForm);
        }

        const { error } = await query;
        if (error) throw error;

        showToast(id ? 'Reagente atualizado!' : 'Reagente cadastrado!', 'success');
        modalReagente.hide();
        fetchReagentes(inputBusca.value);

    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Erro ao salvar: ' + error.message, 'error');
    }
}

// --- CLIQUE BOTÃO EDITAR ---
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

// --- CLIQUE BOTÃO EXCLUIR (ABRE O MODAL) ---
function handleDeleteClick(button) {
    ID_PARA_EXCLUIR = button.dataset.id; // Guarda o ID na variável global
    modalConfirmacao.show();             // Mostra o modal bonito
}

// --- AÇÃO REAL DE EXCLUIR (NO MODAL) ---
btnConfirmarExclusao.addEventListener('click', async () => {
    if (!ID_PARA_EXCLUIR) return;

    // Fecha o modal imediatamente
    modalConfirmacao.hide();

    try {
        const { error } = await supabaseClient.from('Reagente').delete().eq('id', ID_PARA_EXCLUIR);
        
        if (error) {
            // Tratamento de erro de chave estrangeira (FK)
            if (error.code === '23503') {
                showToast('Não é possível excluir: Reagente em uso no estoque.', 'warning');
                return;
            }
            throw error;
        }
        
        showToast('Reagente excluído com sucesso.', 'success');
        fetchReagentes(inputBusca.value);

    } catch (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
    } finally {
        ID_PARA_EXCLUIR = null; // Limpa o ID
    }
});

function resetModal() {
    formReagente.reset();
    editIdInput.value = '';
    modalTitle.textContent = 'Cadastrar Novo Reagente';
    modalSubmitBtn.textContent = 'Salvar';
}

// --- Listeners de Inicialização ---
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
    const btnEdit = e.target.closest('.btn-edit');
    const btnDelete = e.target.closest('.btn-delete');

    if (btnEdit) handleEditClick(btnEdit);
    if (btnDelete) handleDeleteClick(btnDelete);
});

if (btnCadastrar) {
    btnCadastrar.addEventListener('click', resetModal);
}
modalEl.addEventListener('hidden.bs.modal', resetModal);