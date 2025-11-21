import { supabaseClient } from './supabaseClient.js';

const listaPedidos = document.getElementById('lista-pedidos');
const spinner = document.getElementById('spinner-solic');
let MEU_LAB_ID = null;

async function init() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const { data: perfil } = await supabaseClient.from('Perfis').select('id_laboratorio').eq('id', user.id).single();
        MEU_LAB_ID = perfil.id_laboratorio;
        
        fetchPedidosRecebidos();
    } catch (error) {
        console.error(error);
        listaPedidos.innerHTML = '<div class="list-group-item text-danger text-center">Erro ao carregar perfil.</div>';
    }
}

async function fetchPedidosRecebidos() {
    spinner.classList.remove('d-none');
    listaPedidos.innerHTML = '';

    try {
        // Busca transferências onde EU sou o DESTINO
        const { data, error } = await supabaseClient
            .from('Transferencia')
            .select(`
                id,
                quantidade_transferida,
                data_solicitacao,
                Laboratorio:id_lab_origem ( nome_laboratorio ),
                EstoqueLab:id_item_estoque (
                    unidade_medida,
                    Reagente ( nome )
                )
            `)
            .eq('id_lab_destino', MEU_LAB_ID)
            .eq('status', 'Pendente')
            .order('data_solicitacao', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            listaPedidos.innerHTML = '<div class="list-group-item text-muted text-center">Nenhuma solicitação pendente.</div>';
        } else {
            renderPedidos(data);
        }

    } catch (error) {
        console.error(error);
        listaPedidos.innerHTML = '<div class="list-group-item text-danger text-center">Erro ao carregar pedidos.</div>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderPedidos(pedidos) {
    pedidos.forEach(pedido => {
        const nomeLabSolicitante = pedido.Laboratorio.nome_laboratorio;
        const nomeReagente = pedido.EstoqueLab.Reagente.nome;
        const quantidade = pedido.quantidade_transferida;
        const unidade = pedido.EstoqueLab.unidade_medida;
        const data = new Date(pedido.data_solicitacao).toLocaleDateString('pt-BR');

        const html = `
            <div class="list-group-item">
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-1 text-primary">${nomeReagente}</h5>
                        <p class="mb-1"><strong>${nomeLabSolicitante}</strong> solicitou <strong>${quantidade} ${unidade}</strong>.</p>
                        <small class="text-muted">Data do pedido: ${data}</small>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-success btn-aprovar" data-id="${pedido.id}">
                            Aprovar
                        </button>
                        <button class="btn btn-outline-danger btn-recusar" data-id="${pedido.id}">
                            Recusar
                        </button>
                    </div>
                </div>
            </div>
        `;
        listaPedidos.innerHTML += html;
    });
}

async function handleAprovar(id) {
    if (!confirm("Confirmar a transferência? Isso irá debitar do seu estoque.")) return;

    try {
        const { error } = await supabaseClient.rpc('aprovar_transferencia', { p_transfer_id: id });
        if (error) throw error;

        alert("Transferência aprovada! Estoques atualizados.");
        fetchPedidosRecebidos();

    } catch (error) {
        console.error(error);
        alert("Erro ao aprovar: " + error.message);
    }
}

async function handleRecusar(id) {
    if (!confirm("Deseja realmente recusar esta solicitação?")) return;

    try {
        const { error } = await supabaseClient.from('Transferencia').update({ status: 'Recusado' }).eq('id', id);
        if (error) throw error;

        alert("Solicitação recusada.");
        fetchPedidosRecebidos();

    } catch (error) {
        console.error(error);
        alert("Erro ao recusar: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', init);

listaPedidos.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-aprovar')) handleAprovar(e.target.dataset.id);
    if (e.target.classList.contains('btn-recusar')) handleRecusar(e.target.dataset.id);
});