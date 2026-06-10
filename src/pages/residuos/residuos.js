import { getCurrentLabId } from '../../shared/sessionManager.js';
import { showToast } from '../../shared/utils/toast.js';
import { mostrarCarregando, mostrarVazio, mostrarErro } from '../../shared/utils/estados.js';
import { listarResiduosPorLaboratorio, salvarResiduo, atualizarStatusResiduo } from '../../shared/services/residuosService.js';

// --- Seletores de Elementos ---
const listaresiduos = document.getElementById('lista-residuos');
const formresiduo = document.getElementById('form-residuo');
const modalEl = document.getElementById('modal-residuo');
const modalresiduo = new bootstrap.Modal(modalEl);

const editIdInput = document.getElementById('edit-residuo-id');
const descInput = document.getElementById('res-descricao');
const tipoInput = document.getElementById('res-tipo');
const qtdInput = document.getElementById('res-qtd');
const unidadeInput = document.getElementById('res-unidade');
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formresiduo.querySelector('button[type="submit"]');
const btnNovoresiduo = document.querySelector('[data-bs-target="#modal-residuo"]');

let MEU_LAB_ID = null;

// ===============================================
// LOGICA DE INICIALIZACAO
// ===============================================

async function init() {
    try {
        // Busca o ID do laboratorio atual (suporta modo Admin)
        MEU_LAB_ID = await getCurrentLabId();

        if (MEU_LAB_ID) {
            fetchresiduos();
        } else {
            mostrarVazio(listaresiduos, {
                icone: 'bi-exclamation-triangle',
                titulo: 'Laboratorio nao identificado',
                mensagem: 'Verifique sua sessao e tente novamente.'
            });
        }

    } catch (error) {
        console.error('Erro no init:', error);
        mostrarErro(listaresiduos, {
            mensagem: 'Erro ao carregar dados de sessao.',
            onTentarNovamente: init
        });
    }
}

async function fetchresiduos() {
    mostrarCarregando(listaresiduos, 'Sincronizando inventario...');

    try {
        const { data, error } = await listarResiduosPorLaboratorio(MEU_LAB_ID);

        if (error) throw error;

        renderresiduos(data);

    } catch (error) {
        console.error('Erro ao buscar residuos:', error.message);
        mostrarErro(listaresiduos, {
            mensagem: 'Nao foi possivel carregar o inventario de residuos.',
            onTentarNovamente: fetchresiduos
        });
    }
}

/**
 * Renderiza os cards de residuos seguindo o padrao Dark Glass
 */
function renderresiduos(residuos) {
    if (residuos.length === 0) {
        mostrarVazio(listaresiduos, {
            icone: 'bi-recycle',
            titulo: 'Nenhum residuo registrado',
            mensagem: 'Os residuos cadastrados para este laboratorio aparecerao aqui.'
        });
        return;
    }

    // Limpa qualquer estado anterior (ex.: spinner de carregamento) antes de
    // renderizar os cards, evitando que o estado conviva com a lista.
    listaresiduos.innerHTML = '';

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
        listaresiduos.appendChild(col);
    });
}

// ===============================================
// FORMULARIO E ACOES (CRUD)
// ===============================================

function handleEditClick(btn) {
    const d = btn.dataset;
    editIdInput.value = d.id;
    descInput.value = d.desc;
    tipoInput.value = d.tipo;
    qtdInput.value = d.qtd;
    unidadeInput.value = d.unidade;

    modalTitle.textContent = 'Editar Registro de Residuo';
    modalSubmitBtn.textContent = 'Atualizar Registro';
    modalresiduo.show();
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
        // Em novos registros definimos o status inicial; edicoes preservam o status atual
        if (!id) {
            payload.status = 'Em Aberto';
        }

        const { error } = await salvarResiduo(id, payload);
        if (error) throw error;

        showToast(id ? "Registro atualizado com sucesso!" : "Residuo adicionado ao inventario.", "success");
        modalresiduo.hide();
        fetchresiduos();

    } catch (error) {
        console.error('Erro ao salvar:', error.message);
        showToast("Erro ao salvar dados: " + error.message, "error");
    }
}

async function atualizarStatus(id, novoStatus) {
    let msg = `Deseja alterar o status para: ${novoStatus}?`;
    if (novoStatus === 'Em Aberto') msg = "Deseja reabrir este frasco? Ele voltara a figurar como um descarte pendente.";
    if (novoStatus === 'Descartado') msg = "Confirmar o descarte final deste residuo? Esta acao finalizara o controle deste item.";

    // Mantemos o confirm nativo para acoes criticas, mas o resultado e via Toast
    if (!confirm(msg)) return;

    try {
        const { error } = await atualizarStatusResiduo(id, novoStatus);

        if (error) throw error;

        showToast(`Residuo atualizado para ${novoStatus}.`, "success");
        fetchresiduos();

    } catch (error) {
        console.error('Erro ao atualizar status:', error.message);
        showToast("Erro na atualizacao: " + error.message, "error");
    }
}

// ===============================================
// EVENTOS E INICIALIZACAO
// ===============================================

document.addEventListener('DOMContentLoaded', init);
formresiduo.addEventListener('submit', handleFormSubmit);

// Reset do modal ao abrir para novo registro
if (btnNovoresiduo) {
    btnNovoresiduo.addEventListener('click', () => {
        formresiduo.reset();
        editIdInput.value = '';
        modalTitle.textContent = 'Registrar Novo Residuo';
        modalSubmitBtn.textContent = 'Registrar';
    });
}

// Delegacao de Eventos para botoes dinamicos
listaresiduos.addEventListener('click', (e) => {
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
