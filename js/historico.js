import { supabaseClient } from './supabaseClient.js';
import { getCurrentLabId } from './sessionManager.js';

const listaHistorico = document.getElementById('lista-historico');
const inputBusca = document.getElementById('busca-historico');
const spinner = document.getElementById('spinner-hist');

let MEU_LAB_ID = null;
let HISTORICO_CACHE = []; 

async function init() {
    try {
        MEU_LAB_ID = await getCurrentLabId();
        if (MEU_LAB_ID) {
            fetchHistorico();
        } else {
            listaHistorico.innerHTML = '<div class="list-group-item text-danger text-center">Erro: Laboratório não identificado.</div>';
        }
    } catch (error) {
        console.error(error);
        listaHistorico.innerHTML = '<div class="list-group-item text-danger text-center">Erro ao carregar dados.</div>';
    }
}

async function fetchHistorico() {
    spinner.classList.remove('d-none');
    listaHistorico.innerHTML = '';

    try {
        // Faremos 3 buscas simultâneas para compor o histórico completo

        // 1. Transferências (Trocas entre labs)
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

        // 2. Resíduos (Descartes)
        const queryResiduos = supabaseClient
            .from('Residuo')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .eq('status', 'Descartado')
            .order('data_criacao', { ascending: false });

        // 3. Movimentações (Entradas/Compras) - NOVO!
        const queryMov = supabaseClient
            .from('Movimentacao')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .eq('tipo', 'ENTRADA') // Por enquanto só estamos gravando entradas aqui
            .order('data_movimentacao', { ascending: false });

        // Executa tudo junto
        const [resTransf, resResiduos, resMov] = await Promise.all([queryTransf, queryResiduos, queryMov]);

        if (resTransf.error) throw resTransf.error;
        if (resResiduos.error) throw resResiduos.error;
        if (resMov.error) throw resMov.error;

        // --- Unificação e Formatação ---
        
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

        // Junta tudo e ordena
        const listaCompleta = [...listaTransf, ...listaResiduos, ...listaMov];
        listaCompleta.sort((a, b) => new Date(b.data_ordenacao) - new Date(a.data_ordenacao));

        HISTORICO_CACHE = listaCompleta;

        if (listaCompleta.length === 0) {
            listaHistorico.innerHTML = '<div class="list-group-item text-muted text-center">Nenhuma movimentação registrada.</div>';
        } else {
            renderHistorico(listaCompleta);
        }

    } catch (error) {
        console.error(error);
        listaHistorico.innerHTML = '<div class="list-group-item text-danger text-center">Erro ao carregar histórico.</div>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderHistorico(itens) {
    listaHistorico.innerHTML = '';

    itens.forEach(item => {
        // Formata a data e hora (Item 2 da sua lista)
        const dataObj = new Date(item.data_ordenacao);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataCompleta = `${dataFormatada} às ${horaFormatada}`;

        let html = '';

        // TIPO 1: ENTRADA DE ESTOQUE (COMPRA)
        if (item.tipo_registro === 'ENTRADA_ESTOQUE') {
            html = `
                <div class="list-group-item list-group-item-action border-start border-4 border-primary">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <i class="bi bi-bag-plus-fill text-primary" style="font-size: 1.5rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-dark">${item.item_nome}</h6>
                                <span class="badge bg-primary">Compra / Entrada</span>
                            </div>
                            <p class="mb-1 small text-muted">Item cadastrado no estoque.</p>
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">Qtd: <strong>${item.quantidade} ${item.unidade}</strong></small>
                                <small class="text-muted">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        // TIPO 2: RESÍDUO (DESCARTE)
        else if (item.tipo_registro === 'RESIDUO') {
            html = `
                <div class="list-group-item list-group-item-action border-start border-4 border-dark">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <i class="bi bi-trash-fill text-dark" style="font-size: 1.5rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold text-dark">${item.descricao}</h6>
                                <span class="badge bg-secondary">Descarte</span>
                            </div>
                            <p class="mb-1 small text-muted">
                                Enviado para incineração (${item.tipo_perigo})
                            </p>
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">Vol: <strong>${item.quantidade} ${item.unidade_medida}</strong></small>
                                <small class="text-muted">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } 
        // TIPO 3: TRANSFERÊNCIA (TROCA)
        else {
            const euFizOPedido = item.id_lab_origem === MEU_LAB_ID; 
            let corIcone, icone, labParceiroNome, textoAcao, corBorda;
    
            if (euFizOPedido) { // ENTRADA (Recebido)
                corIcone = 'text-success';
                icone = 'bi-arrow-down-circle-fill';
                corBorda = 'border-success';
                labParceiroNome = item.LabDestino ? item.LabDestino.nome_laboratorio : 'Lab Desconhecido'; 
                textoAcao = `Recebido de <strong>${labParceiroNome}</strong>`;
            } else { // SAÍDA (Enviado)
                corIcone = 'text-danger';
                icone = 'bi-arrow-up-circle-fill';
                corBorda = 'border-danger';
                labParceiroNome = item.LabOrigem ? item.LabOrigem.nome_laboratorio : 'Lab Desconhecido';
                textoAcao = `Enviado para <strong>${labParceiroNome}</strong>`;
            }
            
            const nomeReagente = item.EstoqueLab?.Reagente?.nome || 'Item desconhecido';
            const unidade = item.EstoqueLab?.unidade_medida || '';
    
            // Define cor do badge de status
            let badgeClass = 'bg-secondary';
            if (item.status === 'Aprovado') badgeClass = 'bg-success';
            if (item.status === 'Recusado') badgeClass = 'bg-danger';
            if (item.status === 'Pendente') badgeClass = 'bg-warning text-dark';
    
            html = `
                <div class="list-group-item list-group-item-action border-start border-4 ${corBorda}">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <i class="bi ${icone} ${corIcone}" style="font-size: 1.5rem;"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="mb-0 fw-bold">${nomeReagente}</h6>
                                <span class="badge ${badgeClass}">${item.status}</span>
                            </div>
                            <p class="mb-1 small">${textoAcao}</p>
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">Qtd: <strong>${item.quantidade_transferida} ${unidade}</strong></small>
                                <small class="text-muted">${dataCompleta}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
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
            textoPesquisavel = (item.descricao + item.tipo_perigo).toLowerCase();
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