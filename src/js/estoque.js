import { getCurrentLabId } from './sessionManager.js';
import { showToast } from './utils/toast.js';
import {
    excluirItemestoque,
    listarestoquePorlaboratorio,
    registrarMovimentacaoEntradaestoque,
    salvarItemestoque,
} from './services/estoqueService.js';
import { listarreagentesParaestoque } from './services/reagentesService.js';

// --- Seletores ---
const listaestoqueEl = document.getElementById('lista-estoque');
const formestoque = document.getElementById('form-estoque');
const inputBusca = document.getElementById('input-busca-estoque');
const spinner = document.getElementById('loading-spinner-estoque');
const modalEl = document.getElementById('modal-estoque');
const modalestoque = new bootstrap.Modal(modalEl);

// Elementos do Form
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formestoque.querySelector('button[type="submit"]');
const editIdInput = document.getElementById('estoque-edit-id');
const selectreagente = document.getElementById('estoque-reagente');
const quantidadeInput = document.getElementById('estoque-quantidade');
const unidadeInput = document.getElementById('estoque-unidade');
const validadeInput = document.getElementById('estoque-validade');
const observacoesInput = document.getElementById('estoque-observacoes');

let ID_LAB_DO_USUARIO = null;

// ===============================================
// 2. LÓGICA DO ESTOQUE
// ===============================================

async function fetchestoque(labId, filtroNome = '') {
    spinner.classList.remove('d-none');
    listaestoqueEl.innerHTML = '';

    try {
        const { data, error } = await listarestoquePorlaboratorio(labId);
        if (error) throw error;

        const itensFiltrados = data.filter(item => 
            !filtroNome || (item.reagente && item.reagente.nome.toLowerCase().includes(filtroNome.toLowerCase()))
        );

        if (itensFiltrados.length === 0) {
            listaestoqueEl.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-box-seam text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3">Nenhum item encontrado.</p>
                </div>`;
        } else {
            renderestoque(itensFiltrados);
        }
    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Erro ao carregar estoque.', 'error');
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderestoque(itens) {
    listaestoqueEl.innerHTML = '';

    itens.forEach(item => {
        // Lógica visual para Validade
        let validadeHTML = '<span class="badge bg-secondary badge-validade">Indefinida</span>';
        let borderClass = '';
        
        if (item.data_validade) {
            const hoje = new Date();
            const validade = new Date(item.data_validade);
            const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            const dataFormatada = new Date(item.data_validade).toLocaleDateString('pt-BR', {timeZone: 'UTC'});

            if (diffDias < 0) {
                // VENCIDO
                validadeHTML = `<span class="badge bg-danger badge-validade"><i class="bi bi-exclamation-octagon"></i> Venceu: ${dataFormatada}</span>`;
                borderClass = 'border-start border-danger border-4';
            } else if (diffDias < 30) {
                // VENCE EM BREVE
                validadeHTML = `<span class="badge bg-warning text-dark badge-validade"><i class="bi bi-hourglass-split"></i> Vence: ${dataFormatada}</span>`;
                borderClass = 'border-start border-warning border-4';
            } else {
                // NO PRAZO
                validadeHTML = `<span class="badge bg-success badge-validade">Val: ${dataFormatada}</span>`;
            }
        }

        const div = document.createElement('div');
        div.className = `list-group-item p-3 mb-3 shadow-sm rounded border-0 ${borderClass}`;
        // Efeito de hover
        div.style.transition = 'transform 0.2s';
        div.onmouseover = () => div.style.transform = 'translateX(5px)';
        div.onmouseout = () => div.style.transform = 'translateX(0)';

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="bg-light rounded-circle p-3 me-3 text-primary d-none d-md-block">
                        <i class="bi bi-flask fs-4"></i>
                    </div>
                    <div>
                        <h5 class="mb-1 fw-bold text-dark">${item.reagente.nome}</h5>
                        <div class="mb-1">
                            <span class="text-primary fw-bold fs-5">${item.quantidade}</span> 
                            <small class="text-muted text-uppercase fw-bold">${item.unidade_medida}</small>
                        </div>
                        <small class="text-muted d-block text-truncate" style="max-width: 300px;">
                            ${item.observacoes_operacionais || 'Sem observações operacionais.'}
                        </small>
                    </div>
                </div>
                
                <div class="text-end">
                    <div class="mb-2">${validadeHTML}</div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary btn-edit-estoque me-1 rounded-pill px-3" 
                            data-id="${item.id}"
                            data-reagente-id="${item.id_reagente}"
                            data-quantidade="${item.quantidade}"
                            data-unidade="${item.unidade_medida}"
                            data-validade="${item.data_validade || ''}"
                            data-observacoes="${item.observacoes_operacionais || ''}">
                            <i class="bi bi-pencil-fill"></i> <span class="d-none d-md-inline">Editar</span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-estoque rounded-circle" data-id="${item.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        listaestoqueEl.appendChild(div);
    });
}

async function fetchreagentesParaModal() {
    try {
        const { data, error } = await listarreagentesParaestoque();
        if (error) throw error;
        
        selectreagente.innerHTML = '<option value="" disabled selected>Selecione um reagente...</option>';
        data.forEach(reagente => {
            selectreagente.innerHTML += `<option value="${reagente.id}">${reagente.nome}</option>`;
        });
    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Erro ao carregar lista de reagentes.', 'error');
    }
}

async function handleFormSubmitestoque(evento) {
    evento.preventDefault();
    if (!ID_LAB_DO_USUARIO) {
        showToast('Sessão inválida. Recarregue a página.', 'error');
        return;
    }

    const id = editIdInput.value;
    const dadosForm = {
        id_laboratorio: ID_LAB_DO_USUARIO,
        id_reagente: selectreagente.value,
        quantidade: parseFloat(quantidadeInput.value),
        unidade_medida: unidadeInput.value,
        data_validade: validadeInput.value || null,
        observacoes_operacionais: observacoesInput.value || null
    };

    try {
        let query;
        if (id) {
            query = await salvarItemestoque(id, dadosForm);
        } else {
            query = await salvarItemestoque(null, dadosForm);

            // Mantendo sua lógica de histórico
            const nomereagente = selectreagente.options[selectreagente.selectedIndex].text;
            await registrarMovimentacaoEntradaestoque({
                id_laboratorio: ID_LAB_DO_USUARIO,
                tipo: 'ENTRADA',
                item_nome: nomereagente,
                quantidade: dadosForm.quantidade,
                unidade: dadosForm.unidade_medida,
                observacao: 'Cadastro inicial no estoque'
            });
        }

        const { error } = query;
        if (error) throw error;

        showToast(id ? 'Item atualizado com sucesso!' : 'Item adicionado ao estoque!', 'success');
        
        modalestoque.hide();
        fetchestoque(ID_LAB_DO_USUARIO, inputBusca.value);

    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Falha ao salvar: ' + error.message, 'error');
    }
}

function handleEditClickestoque(button) {
    const { id, reagenteId, quantidade, unidade, validade, observacoes } = button.dataset;
    editIdInput.value = id;
    selectreagente.value = reagenteId;
    quantidadeInput.value = quantidade;
    unidadeInput.value = unidade;
    validadeInput.value = validade;
    observacoesInput.value = observacoes;
    modalTitle.textContent = 'Editar Item';
    modalSubmitBtn.textContent = 'Salvar Alterações';
    modalestoque.show();
}

async function handleDeleteClickestoque(button) {
    const id = button.dataset.id;
    // Ainda usamos confirm nativo aqui por ser mais rápido, mas pode ser melhorado depois
    if (confirm('Tem certeza que deseja excluir este item?')) {
        try {
            const { error } = await excluirItemestoque(id);
            if (error) throw error;
            showToast('Item removido do estoque.', 'warning');
            fetchestoque(ID_LAB_DO_USUARIO, inputBusca.value);
        } catch (error) {
            showToast('Erro ao excluir: ' + error.message, 'error');
        }
    }
}

function resetModalestoque() {
    formestoque.reset();
    editIdInput.value = '';
    modalTitle.textContent = 'Adicionar Item ao estoque';
    modalSubmitBtn.textContent = 'Salvar no estoque';
    selectreagente.value = "";
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    ID_LAB_DO_USUARIO = await getCurrentLabId();
    if (ID_LAB_DO_USUARIO) {
        fetchestoque(ID_LAB_DO_USUARIO);
        fetchreagentesParaModal();
    } else {
        showToast('Laboratório não identificado. Faça login novamente.', 'error');
    }
});

formestoque.addEventListener('submit', handleFormSubmitestoque);

let debounceTimer;
inputBusca.addEventListener('keyup', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (ID_LAB_DO_USUARIO) fetchestoque(ID_LAB_DO_USUARIO, inputBusca.value);
    }, 300);
});

listaestoqueEl.addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btn-edit-estoque');
    const btnDelete = e.target.closest('.btn-delete-estoque');

    if (btnEdit) handleEditClickestoque(btnEdit);
    if (btnDelete) handleDeleteClickestoque(btnDelete);
});

modalEl.addEventListener('hidden.bs.modal', resetModalestoque);