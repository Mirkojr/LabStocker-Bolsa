import { supabaseClient } from './supabaseClient.js';
import { getCurrentLabId } from './sessionManager.js';
import { showToast } from './utils/toast.js';

// --- Seletores ---
const listaPedidos = document.getElementById('lista-pedidos');
const spinner = document.getElementById('spinner-solic');
let MEU_LAB_ID = null;





async function init() {
    try {
        // Busca o ID do laboratório atual (suporta modo Admin)
        MEU_LAB_ID = await getCurrentLabId();
        
        if (MEU_LAB_ID) {
            fetchPedidosRecebidos();
        } else {
            listaPedidos.innerHTML = '<div class="text-center text-warning p-5">Laboratório não identificado.</div>';
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar dados da sessão.", "error");
    }
}

async function fetchPedidosRecebidos() {
    if (!spinner || !listaPedidos) return;
    
    spinner.classList.remove('d-none');
    listaPedidos.innerHTML = '';

    try {
        // Busca transferências onde EU sou o ORIGEM (alguém quer algo meu) ou DESTINO conforme sua lógica original
        const { data, error } = await supabaseClient
            .from('transferencia')
            .select(`
                id,
                quantidade_transferida,
                data_solicitacao,
                laboratorio:id_lab_origem ( nome_laboratorio ),
                estoquelab:id_item_estoque (
                    unidade_medida,
                    reagente ( nome )
                )
            `)
            .eq('id_lab_destino', MEU_LAB_ID)
            .eq('status', 'pendente')
            .order('data_solicitacao', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            listaPedidos.innerHTML = `
                <div class="text-center py-5 text-muted-light">
                    <i class="bi bi-inbox fs-1 opacity-25"></i>
                    <p class="mt-3">Nenhuma solicitação pendente no momento.</p>
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
    if (!confirm("Confirmar a transferência? Esta ação debitará o item do seu estoque imediatamente.")) return;

    try {
        // Chama a função RPC complexa do banco que cuida de toda a transação
        const { error } = await supabaseClient.rpc('aprovar_transferencia', { p_transfer_id: id });
        if (error) throw error;

        showToast("Transferência aprovada! estoques atualizados com sucesso.", "success");
        fetchPedidosRecebidos();

    } catch (error) {
        console.error(error);
        showToast("Erro ao processar aprovação: " + error.message, "error");
    }
}

async function handleRecusar(id) {
    if (!confirm("Deseja realmente recusar esta solicitação?")) return;

    try {
        const { error } = await supabaseClient
            .from('transferencia')
            .update({ status: 'Recusado' })
            .eq('id', id);
            
        if (error) throw error;

        showToast("Solicitação recusada e notificada.", "warning");
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