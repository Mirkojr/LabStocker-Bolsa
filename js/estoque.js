import { supabaseClient } from './supabaseClient.js';
// MUDANÇA: Importando o gerenciador de sessão (para suportar Admin)
import { getCurrentLabId } from './sessionManager.js';

// --- Seletores de Elementos ---
const listaEstoqueEl = document.getElementById('lista-estoque');
const formEstoque = document.getElementById('form-estoque');
const inputBusca = document.getElementById('input-busca-estoque');
const spinner = document.getElementById('loading-spinner-estoque');
const btnCadastrarEstoque = document.querySelector('[data-bs-target="#modal-estoque"]');
const modalEl = document.getElementById('modal-estoque');
const modalEstoque = new bootstrap.Modal(modalEl);

// Seletores do formulário do modal
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formEstoque.querySelector('button[type="submit"]');
const editIdInput = document.getElementById('estoque-edit-id');
const selectReagente = document.getElementById('estoque-reagente');
const quantidadeInput = document.getElementById('estoque-quantidade');
const unidadeInput = document.getElementById('estoque-unidade');
const validadeInput = document.getElementById('estoque-validade');
const observacoesInput = document.getElementById('estoque-observacoes');

// Variável global
let ID_LAB_DO_USUARIO = null;

// --- Funções Principais ---

// (A função getLabIdDoUsuario foi removida pois agora usamos o sessionManager)

async function fetchEstoque(labId, filtroNome = '') {
    spinner.classList.remove('d-none');
    listaEstoqueEl.innerHTML = '';

    try {
        let query = supabaseClient
            .from('EstoqueLab')
            .select(`
                id,
                quantidade,
                unidade_medida,
                data_validade,
                observacoes_operacionais,
                id_reagente,
                Reagente ( nome ) 
            `)
            .eq('id_laboratorio', labId)
            .order('data_validade');
            
        const { data, error } = await query;
        if (error) throw error;

        const itensFiltrados = data.filter(item => 
            !filtroNome || (item.Reagente && item.Reagente.nome.toLowerCase().includes(filtroNome.toLowerCase()))
        );

        if (itensFiltrados.length === 0) {
            listaEstoqueEl.innerHTML = '<div class="list-group-item text-center text-muted">Nenhum item no estoque.</div>';
        } else {
            renderEstoque(itensFiltrados);
        }
    } catch (error) {
        console.error('Erro ao buscar estoque:', error.message);
        listaEstoqueEl.innerHTML = '<div class="list-group-item text-center text-danger">Erro ao carregar estoque.</div>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderEstoque(itens) {
    itens.forEach(item => {
        const itemHtml = `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="mb-1">${item.Reagente.nome} - ${item.quantidade} ${item.unidade_medida}</h5>
                    <p class="mb-1">${item.observacoes_operacionais || 'Sem observações.'}</p>
                    <small class="text-muted">Val: ${item.data_validade || 'N/A'}</small>
                </div>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-secondary btn-sm btn-edit-estoque" 
                        data-id="${item.id}"
                        data-reagente-id="${item.id_reagente}"
                        data-quantidade="${item.quantidade}"
                        data-unidade="${item.unidade_medida}"
                        data-validade="${item.data_validade || ''}"
                        data-observacoes="${item.observacoes_operacionais || ''}">
                        Editar
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm btn-delete-estoque" data-id="${item.id}">
                        Excluir
                    </button>
                </div>
            </div>
        `;
        listaEstoqueEl.innerHTML += itemHtml;
    });
}

async function fetchReagentesParaModal() {
    try {
        const { data, error } = await supabaseClient.from('Reagente').select('id, nome').order('nome');
        if (error) throw error;
        
        selectReagente.innerHTML = '<option value="" disabled selected>Selecione um reagente...</option>';
        data.forEach(reagente => {
            selectReagente.innerHTML += `<option value="${reagente.id}">${reagente.nome}</option>`;
        });
    } catch (error) {
        console.error('Erro ao buscar reagentes para o modal:', error.message);
        selectReagente.innerHTML = '<option value="" disabled>Erro ao carregar</option>';
    }
}

async function handleFormSubmitEstoque(evento) {
    evento.preventDefault();
    if (!ID_LAB_DO_USUARIO) {
        alert('Erro: ID do laboratório não encontrado.');
        return;
    }

    const id = editIdInput.value;
    const dadosForm = {
        id_laboratorio: ID_LAB_DO_USUARIO,
        id_reagente: selectReagente.value,
        quantidade: quantidadeInput.value,
        unidade_medida: unidadeInput.value,
        data_validade: validadeInput.value || null,
        observacoes_operacionais: observacoesInput.value || null
    };

    try {
        let query;
        if (id) {
            // ATUALIZAR
            query = supabaseClient.from('EstoqueLab').update(dadosForm).eq('id', id);
        } else {
            // CRIAR
            query = supabaseClient.from('EstoqueLab').insert(dadosForm);
        }

        const { error } = await query;
        if (error) throw error;

        alert(id ? 'Item atualizado no estoque!' : 'Item adicionado ao estoque!');
        modalEstoque.hide();
        fetchEstoque(ID_LAB_DO_USUARIO, inputBusca.value);

    } catch (error) {
        console.error('Erro ao salvar item no estoque:', error.message);
        alert('Erro ao salvar: ' + error.message);
    }
}

function handleEditClickEstoque(button) {
    const { id, reagenteId, quantidade, unidade, validade, observacoes } = button.dataset;

    editIdInput.value = id;
    selectReagente.value = reagenteId;
    quantidadeInput.value = quantidade;
    unidadeInput.value = unidade;
    validadeInput.value = validade;
    observacoesInput.value = observacoes;

    modalTitle.textContent = 'Editar Item do Estoque';
    modalSubmitBtn.textContent = 'Atualizar';

    modalEstoque.show();
}

async function handleDeleteClickEstoque(button) {
    const id = button.dataset.id;
    
    if (confirm('Tem certeza que deseja excluir este item do seu estoque?')) {
        try {
            const { error } = await supabaseClient.from('EstoqueLab').delete().eq('id', id);

            if (error) throw error;
            
            alert('Item excluído do estoque.');
            fetchEstoque(ID_LAB_DO_USUARIO, inputBusca.value);

        } catch (error) {
            console.error('Erro ao excluir item:', error.message);
            alert('Erro ao excluir: ' + error.message);
        }
    }
}

function resetModalEstoque() {
    formEstoque.reset();
    editIdInput.value = '';
    modalTitle.textContent = 'Adicionar Item ao Estoque';
    modalSubmitBtn.textContent = 'Salvar no Estoque';
    selectReagente.value = "";
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
    // MUDANÇA: Usamos a nova função que suporta o "Modo Admin"
    ID_LAB_DO_USUARIO = await getCurrentLabId();
    
    if (ID_LAB_DO_USUARIO) {
        fetchEstoque(ID_LAB_DO_USUARIO);
        fetchReagentesParaModal();
    } else {
        listaEstoqueEl.innerHTML = '<div class="alert alert-danger text-center">Erro: Laboratório não identificado.</div>';
    }
});

formEstoque.addEventListener('submit', handleFormSubmitEstoque);

let debounceTimer;
inputBusca.addEventListener('keyup', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (ID_LAB_DO_USUARIO) {
            fetchEstoque(ID_LAB_DO_USUARIO, inputBusca.value);
        }
    }, 300);
});

listaEstoqueEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-edit-estoque')) handleEditClickEstoque(e.target);
    if (e.target.classList.contains('btn-delete-estoque')) handleDeleteClickEstoque(e.target);
});

if (btnCadastrarEstoque) {
    btnCadastrarEstoque.addEventListener('click', resetModalEstoque);
}

modalEl.addEventListener('hidden.bs.modal', resetModalEstoque);