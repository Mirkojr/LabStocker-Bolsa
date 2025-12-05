import { supabaseClient } from './supabaseClient.js';
// MUDANÇA: Importando o gerenciador de sessão (para suportar Admin)
import { getCurrentLabId } from './sessionManager.js';

const listaHistorico = document.getElementById('lista-historico');
const inputBusca = document.getElementById('busca-historico');
const spinner = document.getElementById('spinner-hist');

let MEU_LAB_ID = null;
let HISTORICO_CACHE = []; 

async function init() {
    try {
        // MUDANÇA: Usamos a nova função que suporta o "Modo Admin"
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
        // Faremos duas buscas simultâneas: Transferências e Resíduos Descartados

        // 1. Buscar Transferências
        const queryTransf = supabaseClient
            .from('Transferencia')
            .select(`
                id,
                quantidade_transferida,
                status,
                data_solicitacao,
                id_lab_origem,  
                id_lab_destino,
                LabOrigem:id_lab_origem ( nome_laboratorio ),
                LabDestino:id_lab_destino ( nome_laboratorio ),
                EstoqueLab:id_item_estoque (
                    unidade_medida,
                    Reagente ( nome )
                )
            `)
            .or(`id_lab_origem.eq.${MEU_LAB_ID},id_lab_destino.eq.${MEU_LAB_ID}`)
            .order('data_solicitacao', { ascending: false });

        // 2. Buscar Resíduos (Apenas os descartados/finalizados)
        const queryResiduos = supabaseClient
            .from('Residuo')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .eq('status', 'Descartado') // Só queremos ver o que já foi embora
            .order('data_criacao', { ascending: false });

        // Executa as duas ao mesmo tempo
        const [resTransf, resResiduos] = await Promise.all([queryTransf, queryResiduos]);

        if (resTransf.error) throw resTransf.error;
        if (resResiduos.error) throw resResiduos.error;

        // --- UNIFICAÇÃO DAS LISTAS ---
        
        // Adiciona um campo "tipo_registro" para sabermos diferenciar depois
        const listaTransf = resTransf.data.map(item => ({
            ...item, 
            tipo_registro: 'TRANSFERENCIA',
            data_ordenacao: item.data_solicitacao
        }));

        const listaResiduos = resResiduos.data.map(item => ({
            ...item, 
            tipo_registro: 'RESIDUO',
            data_ordenacao: item.data_criacao // Ou data de atualização, se preferir
        }));

        // Junta tudo
        const listaCompleta = [...listaTransf, ...listaResiduos];

        // Ordena pela data (do mais recente para o mais antigo)
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
        let html = '';

        // SE FOR UM RESÍDUO
        if (item.tipo_registro === 'RESIDUO') {
            const data = new Date(item.data_ordenacao).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: '2-digit'
            });
            
            // Ícone de lixeira para descarte
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
                            <p class="mb-1 small">
                                Enviado para incineração (Tipo: <strong>${item.tipo_perigo}</strong>)
                            </p>
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">Volume: <strong>${item.quantidade} ${item.unidade_medida}</strong></small>
                                <small class="text-muted">${data}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } 
        
        // SE FOR UMA TRANSFERÊNCIA (Lógica anterior)
        else {
            const euFizOPedido = item.id_lab_origem === MEU_LAB_ID; 
            
            let corIcone, icone, labParceiroNome, textoAcao, corBorda;
    
            if (euFizOPedido) {
                // ENTRADA
                corIcone = 'text-success';
                icone = 'bi-arrow-down-circle-fill';
                corBorda = 'border-success';
                labParceiroNome = item.LabDestino ? item.LabDestino.nome_laboratorio : 'Lab Desconhecido'; 
                textoAcao = `Recebido de <strong>${labParceiroNome}</strong>`;
            } else {
                // SAÍDA
                corIcone = 'text-danger';
                icone = 'bi-arrow-up-circle-fill';
                corBorda = 'border-danger';
                labParceiroNome = item.LabOrigem ? item.LabOrigem.nome_laboratorio : 'Lab Desconhecido';
                textoAcao = `Enviado para <strong>${labParceiroNome}</strong>`;
            }
    
            const data = new Date(item.data_solicitacao).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit'
            });
    
            let badgeClass = 'bg-secondary';
            if (item.status === 'Aprovado') badgeClass = 'bg-success';
            if (item.status === 'Recusado') badgeClass = 'bg-danger';
            if (item.status === 'Pendente') badgeClass = 'bg-warning text-dark';
    
            const nomeReagente = item.EstoqueLab?.Reagente?.nome || 'Item desconhecido';
            const unidade = item.EstoqueLab?.unidade_medida || '';
    
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
                                <small class="text-muted">Quantidade: <strong>${item.quantidade_transferida} ${unidade}</strong></small>
                                <small class="text-muted">${data}</small>
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
        // Filtro Genérico para os dois tipos
        let textoPesquisavel = '';
        
        if (item.tipo_registro === 'RESIDUO') {
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