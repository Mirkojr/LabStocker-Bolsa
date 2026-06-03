import { supabaseClient } from './supabaseClient.js';
import { getCurrentLabId } from './sessionManager.js';
import { showToast } from './utils/toast.js';

// --- Seletores de Elementos ---
const listaResiduos = document.getElementById('lista-residuos');
const formResiduo = document.getElementById('form-residuo');
const spinner = document.getElementById('spinner-res');
const modalEl = document.getElementById('modal-residuo');
const modalResiduo = new bootstrap.Modal(modalEl);

const editIdInput = document.getElementById('edit-residuo-id');
const descInput = document.getElementById('res-descricao');
const tipoInput = document.getElementById('res-tipo');
const qtdInput = document.getElementById('res-qtd');
const unidadeInput = document.getElementById('res-unidade');
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formResiduo.querySelector('button[type="submit"]');
const btnNovoResiduo = document.querySelector('[data-bs-target="#modal-residuo"]');

let MEU_LAB_ID = null;

// ===============================================
// LÓGICA DE INICIALIZAÇÃO
// ===============================================

async function init() {
    try {
        // Busca o ID do laboratório atual (suporta modo Admin)
        MEU_LAB_ID = await getCurrentLabId();
        
        if (MEU_LAB_ID) {
            fetchResiduos();
        } else {
            listaResiduos.innerHTML = '<div class="col-12 text-center text-warning p-5">Laboratório não identificado. Verifique sua sessão.</div>';
        }

    } catch (error) {
        console.error('Erro no init:', error);
        showToast("Erro ao carregar dados de sessão.", "error");
    }
}

async function fetchResiduos() {
    spinner.classList.remove('d-none');
    listaResiduos.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('Residuo')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .order('data_criacao', { ascending: false });

        if (error) throw error;

        renderResiduos(data);

    } catch (error) {
        console.error('Erro ao buscar resíduos:', error.message);
        showToast("Erro ao carregar o inventário de resíduos.", "error");
    } finally {
        spinner.classList.add('d-none');
    }
}

/**
 * Renderiza os cards de resíduos seguindo o padrão Dark Glass
 */
function renderResiduos(residuos) {
    if (residuos.length === 0) {
        listaResiduos.innerHTML = '<div class="col-12 text-center text-muted-light py-5">Nenhum resíduo registrado para este laboratório.</div>';
        return;
    }

    residuos.forEach(res => {
        const isAberto = res.status === 'Em Aberto';
        const statusClass = isAberto ? 'bg-warning text-dark' : 'bg-success text-white';
        const dataF = new Date(res.data_criacao).toLocaleDateString('pt-BR');
        
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        col.innerHTML = `
            <div class="card h-100 border-white border-opacity-10 shadow-sm rounded-4 overflow-hidden" style="background: rgba(255,255,255,0.03);">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <span class="badge ${statusClass} rounded-pill px-3">${res.status}</span>
                        <small class="text-muted-light">${dataF}</small>
                    </div>
                    <h5 class="fw-bold text-white mb-2">${res.descricao}</h5>
                    <p class="small text-muted-light mb-3">
                        <i class="bi bi-shield-exclamation me-1"></i> ${res.tipo_perigo} | 
                        <strong>${res.quantidade} ${res.unidade_medida}</strong>
                    </p>
                    
                    <div class="d-flex gap-2 border-top border-white border-opacity-10 pt-3">
                        ${isAberto ? `
                            <button class="btn btn-sm btn-outline-info rounded-pill flex-grow-1 btn-editar" 
                                data-id="${res.id}" data-desc="${res.descricao}" data-tipo="${res.tipo_perigo}" 
                                data-qtd="${res.quantidade}" data-unidade="${res.unidade_medida}">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-sm btn-success rounded-pill px-3 btn-descartar" data-id="${res.id}">
                                <i class="bi bi-check-lg"></i> Descartar
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline-secondary rounded-pill flex-grow-1 btn-reabrir" data-id="${res.id}">
                                <i class="bi bi-arrow-counterclockwise"></i> Reabrir
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
        listaResiduos.appendChild(col);
    });
}

// ===============================================
// FORMULÁRIO E AÇÕES (CRUD)
// ===============================================

function handleEditClick(btn) {
    const d = btn.dataset;
    editIdInput.value = d.id;
    descInput.value = d.desc;
    tipoInput.value = d.tipo;
    qtdInput.value = d.qtd;
    unidadeInput.value = d.unidade;

    modalTitle.textContent = 'Editar Registro de Resíduo';
    modalSubmitBtn.textContent = 'Atualizar Registro';
    modalResiduo.show();
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = editIdInput.value;
    const payload = {
        id_laboratorio: MEU_LAB_ID,
        descricao: descInput.value,
        tipo_perigo: tipoInput.value,
        quantidade: parseFloat(qtdInput.value),
        unidade_medida: unidadeInput.value
    };

    try {
        let query;
        if (id) {
            query = supabaseClient.from('Residuo').update(payload).eq('id', id);
        } else {
            payload.status = 'Em Aberto';
            query = supabaseClient.from('Residuo').insert([payload]);
        }

        const { error } = await query;
        if (error) throw error;

        showToast(id ? "Registro atualizado com sucesso!" : "Resíduo adicionado ao inventário.", "success");
        modalResiduo.hide();
        fetchResiduos();

    } catch (error) {
        console.error('Erro ao salvar:', error.message);
        showToast("Erro ao salvar dados: " + error.message, "error");
    }
}

async function atualizarStatus(id, novoStatus) {
    let msg = `Deseja alterar o status para: ${novoStatus}?`;
    if (novoStatus === 'Em Aberto') msg = "Deseja reabrir este frasco? Ele voltará a figurar como um descarte pendente.";
    if (novoStatus === 'Descartado') msg = "Confirmar o descarte final deste resíduo? Esta ação finalizará o controle deste item.";

    // Mantemos o confirm nativo para ações críticas, mas o resultado é via Toast
    if (!confirm(msg)) return;

    try {
        const { error } = await supabaseClient
            .from('Residuo')
            .update({ status: novoStatus })
            .eq('id', id);

        if (error) throw error;
        
        showToast(`Resíduo atualizado para ${novoStatus}.`, "success");
        fetchResiduos();

    } catch (error) {
        console.error('Erro ao atualizar status:', error.message);
        showToast("Erro na atualização: " + error.message, "error");
    }
}

// ===============================================
// EVENTOS E INICIALIZAÇÃO
// ===============================================

document.addEventListener('DOMContentLoaded', init);
formResiduo.addEventListener('submit', handleFormSubmit);

// Reset do modal ao abrir para novo registro
if (btnNovoResiduo) {
    btnNovoResiduo.addEventListener('click', () => {
        formResiduo.reset();
        editIdInput.value = '';
        modalTitle.textContent = 'Registrar Novo Resíduo';
        modalSubmitBtn.textContent = 'Registrar';
    });
}

// Delegação de Eventos para botões dinâmicos
listaResiduos.addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btn-editar');
    if (btnEdit) handleEditClick(btnEdit);

    const btnReabrir = e.target.closest('.btn-reabrir');
    if (btnReabrir) {
        atualizarStatus(btnReabrir.dataset.id, 'Em Aberto');
    }

    const btnDescartar = e.target.closest('.btn-descartar');
    if (btnDescartar) {
        atualizarStatus(btnDescartar.dataset.id, 'Descartado');
    }
});