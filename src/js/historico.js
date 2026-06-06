import { supabaseClient } from './supabaseClient.js';
import { getCurrentLabId } from './sessionManager.js';
import { showToast } from './utils/toast.js';

// --- Seletores de Elementos ---
const listaHistorico = document.getElementById('lista-historico');
const inputBusca = document.getElementById('busca-historico');
const spinner = document.getElementById('spinner-hist');

// --- Variáveis de Estado ---
let MEU_LAB_ID = null;
let HISTORICO_CACHE = []; 



async function init() {
    try {
        // Busca o ID do laboratório atual (suporta modo Admin)
        MEU_LAB_ID = await getCurrentLabId();
        
        if (MEU_LAB_ID) {
            fetchHistorico();
        } else {
            listaHistorico.innerHTML = '<div class="text-center text-warning p-5">Laboratório não identificado.</div>';
        }
    } catch (error) {
        console.error('Erro no init:', error);
        showToast("Erro ao carregar dados do laboratório.", "error");
    }
}

async function fetchHistorico() {
    spinner.classList.remove('d-none');
    listaHistorico.innerHTML = '';

    try {
        // Realizamos as 3 buscas simultâneas para compor a linha do tempo

        // 1. Transferências (Trocas aprovadas onde o lab participou)
        const queryTransf = supabaseClient
            .from('Transferencia')
            .select(`
                id, quantidade_transferida, status, data_solicitacao, id_lab_origem, id_lab_destino,
                LabOrigem:id_lab_origem ( nome_laboratorio ),
                LabDestino:id_lab_destino ( nome_laboratorio ),
                EstoqueLab:id_item_estoque ( unidade_medida, Reagente ( nome ) )
            `)
            .or(`id_lab_origem.eq.${MEU_LAB_ID},id_lab_destino.eq.${MEU_LAB_ID}`)
            .order('data_solicitacao', { ascending: false });

        // 2. Resíduos (Itens marcados como Descartados)
        const queryResiduos = supabaseClient
            .from('Residuo')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .eq('status', 'Descartado')
            .order('data_criacao', { ascending: false });

        // 3. Movimentações (Entradas/Compras diretas no estoque)
        const queryMov = supabaseClient
            .from('Movimentacao')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .eq('tipo', 'ENTRADA')
            .order('data_movimentacao', { ascending: false });

        // Executa todas as promessas em paralelo para performance
        const [resTransf, resResiduos, resMov] = await Promise.all([queryTransf, queryResiduos, queryMov]);

        if (resTransf.error) throw resTransf.error;
        if (resResiduos.error) throw resResiduos.error;
        if (resMov.error) throw resMov.error;

        // --- Unificação e Marcação de Metadados ---
        
        const listaTransf = resTransf.data.map(item => ({
            ...item, 
            tipo_registro: 'TRANSFERENCIA',
            data_ordenacao: item.data_solicitacao
        }));

        const listaResiduos = resResiduos.data.map(item => ({
            ...item, 
            tipo_registro: 'RESIDUO',
            data_ordenacao: item.data_criacao
        }));

        const listaMov = resMov.data.map(item => ({
            ...item,
            tipo_registro: 'ENTRADA_ESTOQUE',
            data_ordenacao: item.data_movimentacao
        }));

        // Junta tudo em uma única array e ordena por data decrescente
        const listaCompleta = [...listaTransf, ...listaResiduos, ...listaMov];
        listaCompleta.sort((a, b) => new Date(b.data_ordenacao) - new Date(a.data_ordenacao));

        HISTORICO_CACHE = listaCompleta;

        if (listaCompleta.length === 0) {
            listaHistorico.innerHTML = `
                <div class="text-center py-5 text-muted-light">
                    <i class="bi bi-clock-history fs-1 opacity-25"></i>
                    <p class="mt-3">Nenhuma movimentação registrada até o momento.</p>
                </div>`;
        } else {
            renderHistorico(listaCompleta);
        }

    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        showToast("Falha ao reconstruir a linha do tempo.", "error");
    } finally {
        spinner.classList.add('d-none');
    }
}

/**
 * Renderiza os itens na interface seguindo o padrão Dark Glass
 */
function renderHistorico(itens) {
    listaHistorico.innerHTML = '';

    itens.forEach(item => {
        // Formatação de data e hora para exibição amigável
        const dataObj = new Date(item.data_ordenacao);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataCompleta = `${dataFormatada} às ${horaFormatada}`;

        let html = '';

        // TIPO 1: ENTRADA DE ESTOQUE (COMPRA)
        if (item.tipo_registro === 'ENTRADA_ESTOQUE') {
            html = `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi bi-cart-plus-fill text-primary fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${item.item_nome}</h6>
                                <span class="badge bg-primary text-uppercase" style="font-size: 0.65rem;">Compra</span>
                            </div>
                            <p class="mb-1 small text-muted-light">Novo item adicionado ao inventário.</p>
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Qtd: <strong>${item.quantidade} ${item.unidade}</strong></small>
                                <small class="text-white-50 opacity-75">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
        }
        // TIPO 2: RESÍDUO (DESCARTE)
        else if (item.tipo_registro === 'RESIDUO') {
            html = `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-secondary bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi bi-trash3-fill text-white-50 fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${item.descricao}</h6>
                                <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">Descarte</span>
                            </div>
                            <p class="mb-1 small text-muted-light">
                                Enviado para tratamento (${item.tipo_perigo})
                            </p>
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Vol: <strong>${item.quantidade} ${item.unidade_medida}</strong></small>
                                <small class="text-white-50 opacity-75">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
        } 
        // TIPO 3: TRANSFERÊNCIA (TROCA)
        else {
            const euFizOPedido = String(item.id_lab_origem) === String(MEU_LAB_ID); 
            let cor, icone, textoAcao;
    
            if (euFizOPedido) { // RECEBIDO (Entrada por troca)
                cor = 'success';
                icone = 'bi-arrow-down-left-circle-fill';
                const labParceiro = item.LabDestino?.nome_laboratorio || 'Lab Externo'; 
                textoAcao = `Recebido de <strong>${labParceiro}</strong>`;
            } else { // ENVIADO (Saída por troca)
                cor = 'danger';
                icone = 'bi-arrow-up-right-circle-fill';
                const labParceiro = item.LabOrigem?.nome_laboratorio || 'Lab Externo';
                textoAcao = `Enviado para <strong>${labParceiro}</strong>`;
            }
            
            const nomeReagente = item.EstoqueLab?.Reagente?.nome || 'Item desconhecido';
            const unidade = item.EstoqueLab?.unidade_medida || '';
    
            let statusBadgeClass = item.status === 'Aprovado' ? 'bg-success' : 'bg-warning text-dark';
    
            html = `
                <div class="list-group-item bg-transparent border-white border-opacity-10 py-3 mb-2 rounded-4">
                    <div class="d-flex align-items-center">
                        <div class="bg-${cor} bg-opacity-25 rounded-circle p-3 me-3">
                            <i class="bi ${icone} text-${cor} fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-white">${nomeReagente}</h6>
                                <span class="badge ${statusBadgeClass} text-uppercase" style="font-size: 0.65rem;">${item.status}</span>
                            </div>
                            <p class="mb-1 small text-muted-light">${textoAcao}</p>
                            <div class="d-flex justify-content-between">
                                <small class="text-white-50">Qtd: <strong>${item.quantidade_transferida} ${unidade}</strong></small>
                                <small class="text-white-50 opacity-75">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        listaHistorico.innerHTML += html;
    });
}

document.addEventListener('DOMContentLoaded', init);

inputBusca.addEventListener('keyup', () => {
    const termo = inputBusca.value.toLowerCase();
    
    const filtrados = HISTORICO_CACHE.filter(item => {
        let textoPesquisavel = '';
        
        if (item.tipo_registro === 'ENTRADA_ESTOQUE') {
            textoPesquisavel = item.item_nome.toLowerCase();
        } else if (item.tipo_registro === 'RESIDUO') {
            textoPesquisavel = (item.descricao + (item.tipo_perigo || '')).toLowerCase();
        } else {
            const nomeReagente = item.EstoqueLab?.Reagente?.nome || '';
            const nomeOrigem = item.LabOrigem?.nome_laboratorio || '';
            const nomeDestino = item.LabDestino?.nome_laboratorio || '';
            textoPesquisavel = (nomeReagente + nomeOrigem + nomeDestino).toLowerCase();
        }
        return textoPesquisavel.includes(termo);
    });
    
    renderHistorico(filtrados);
});