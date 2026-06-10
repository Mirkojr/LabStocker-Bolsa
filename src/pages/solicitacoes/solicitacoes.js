import { getCurrentLabId } from '../../shared/sessionManager.js';
import { showToast } from '../../shared/utils/toast.js';
import { confirmar, confirmarRecusa } from '../../shared/utils/confirmacao.js';
import { listarSolicitacoesPendentes, aprovarTransferencia, recusarTransferencia } from '../../shared/services/transferenciasService.js';

// --- Seletores ---
const listaPedidos = document.getElementById('lista-pedidos');
const spinner = document.getElementById('spinner-solic');
let MEU_LAB_ID = null;

async function init() {
    try {
        MEU_LAB_ID = await getCurrentLabId();

        if (MEU_LAB_ID) {
            fetchPedidosRecebidos();
        } else {
            listaPedidos.innerHTML = '<div class="text-center text-warning p-5">Laboratorio nao identificado.</div>';
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar dados da sessao.", "error");
    }
}

async function fetchPedidosRecebidos() {
    if (!spinner || !listaPedidos) return;

    spinner.classList.remove('d-none');
    listaPedidos.innerHTML = '';

    try {
        const { data, error } = await listarSolicitacoesPendentes(MEU_LAB_ID);
        if (error) throw error;

        if (data.length === 0) {
            listaPedidos.innerHTML = `
                <div class="text-center py-5 text-muted-light">
                    <i class="bi bi-inbox fs-1 opacity-25"></i>
                    <p class="mt-3">Nenhuma solicitacao pendente no momento.</p>
                </div>`;
        } else {
            renderPedidos(data);
        }

    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar lista de pedidos.", "error");
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderPedidos(pedidos) {
    pedidos.forEach(pedido => {
        const nomeLabSolicitante = pedido.laboratorio?.nome_laboratorio || "Lab Externo";
        const nomereagente = pedido.estoquelab?.reagente?.nome || "Item desconhecido";
        const quantidade = pedido.quantidade_transferida;
        const unidade = pedido.estoquelab?.unidade_medida || "un";
        const data = new Date(pedido.data_solicitacao).toLocaleDateString('pt-BR');

        const div = document.createElement('div');
        div.className = 'list-group-item bg-transparent border-white border-opacity-10 mb-3 p-4 rounded-4 shadow-sm';
        div.style.background = 'rgba(255, 255, 255, 0.03)';

        div.innerHTML = `
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center">
                <div class="mb-3 mb-md-0">
                    <h5 class="mb-1 fw-bold text-white">${nomereagente}</h5>
                    <p class="mb-1 text-muted-light">
                        <span class="text-info fw-bold">${nomeLabSolicitante}</span> solicitou 
                        <span class="badge bg-light bg-opacity-10 text-white border border-white border-opacity-25">${quantidade} ${unidade}</span>
                    </p>
                    <small class="opacity-50 text-white"><i class="bi bi-calendar3 me-1"></i>Pedido em: ${data}</small>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-success rounded-pill px-4 fw-bold btn-aprovar shadow-sm" data-id="${pedido.id}">
                        <i class="bi bi-check-lg me-1"></i> Aprovar
                    </button>
                    <button class="btn btn-outline-danger rounded-pill px-4 btn-recusar" data-id="${pedido.id}">
                        <i class="bi bi-x-lg me-1"></i> Recusar
                    </button>
                </div>
            </div>
        `;
        listaPedidos.appendChild(div);
    });
}

async function handleAprovar(id) {
    const ok = await confirmar({
        titulo: 'Aprovar transferência',
        mensagem: 'O item será debitado do seu estoque imediatamente e o histórico será registrado.',
        textoConfirmar: 'Aprovar',
        tipo: 'success',
        icone: 'bi-check-circle-fill',
    });
    if (!ok) return;

    try {
        const { error } = await aprovarTransferencia(id);
        if (error) throw error;

        showToast("Transferencia aprovada! estoques atualizados com sucesso.", "success");
        fetchPedidosRecebidos();

    } catch (error) {
        console.error(error);
        showToast("Erro ao processar aprovacao: " + error.message, "error");
    }
}

async function handleRecusar(id) {
    const { confirmado, motivo } = await confirmarRecusa({
        titulo: 'Recusar solicitação',
        mensagem: 'Descreva o motivo da recusa. Ele ficará visível no histórico do solicitante.',
        textoConfirmar: 'Recusar pedido',
    });
    if (!confirmado) return;

    try {
        const { error } = await recusarTransferencia(id, motivo);
        if (error) throw error;

        showToast("Solicitacao recusada.", "warning");
        fetchPedidosRecebidos();

    } catch (error) {
        console.error(error);
        showToast("Erro ao recusar: " + error.message, "error");
    }
}

document.addEventListener('DOMContentLoaded', init);

listaPedidos.addEventListener('click', (e) => {
    const btnAprovar = e.target.closest('.btn-aprovar');
    const btnRecusar = e.target.closest('.btn-recusar');

    if (btnAprovar) handleAprovar(btnAprovar.dataset.id);
    if (btnRecusar) handleRecusar(btnRecusar.dataset.id);
});