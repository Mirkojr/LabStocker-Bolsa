import { supabaseClient } from './supabaseClient.js';
import { getCurrentLabId, checkIsAdmin } from './sessionManager.js';

const formRelatorio = document.getElementById('form-relatorio');
const tbodyPreview = document.getElementById('tbody-preview');
const dataInicioInput = document.getElementById('data-inicio');
const dataFimInput = document.getElementById('data-fim');
const tituloPagina = document.querySelector('h2');

let MEU_LAB_ID = null;
let SOU_ADMIN = false;
let MODO_GLOBAL = false;
let MAPA_LABORATORIOS = {}; 

async function init() {
    try {
        MEU_LAB_ID = await getCurrentLabId();
        SOU_ADMIN = await checkIsAdmin();

        // Verifica Modo Global
        const labSelecionado = sessionStorage.getItem('ADMIN_SELECTED_LAB_ID');
        if (SOU_ADMIN && !labSelecionado) {
            MODO_GLOBAL = true;
            if (tituloPagina) tituloPagina.innerHTML = '<i class="bi bi-globe-americas"></i> Relatório Geral (Todos os Laboratórios)';
            
            const headerRow = document.querySelector('#tabela-preview thead tr');
            if (headerRow && !headerRow.innerHTML.includes('Laboratório')) {
                const thLab = document.createElement('th');
                thLab.textContent = 'Laboratório';
                headerRow.insertBefore(thLab, headerRow.children[1]);
            }
        }

        await fetchMapaLaboratorios();

        if (MEU_LAB_ID || MODO_GLOBAL) {
            const hoje = new Date();
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(hoje.getDate() - 30);

            // Ajuste simples para os inputs de data
            dataFimInput.value = hoje.toISOString().split('T')[0];
            dataInicioInput.value = trintaDiasAtras.toISOString().split('T')[0];

            carregarDados(dataInicioInput.value, dataFimInput.value, false);
        } else {
            if (!SOU_ADMIN) alert("Erro: Laboratório não identificado.");
        }
    } catch (error) {
        console.error(error);
    }
}

async function fetchMapaLaboratorios() {
    try {
        const { data, error } = await supabaseClient
            .from('Laboratorio')
            .select('id, nome_laboratorio');
        
        if (!error && data) {
            data.forEach(lab => {
                MAPA_LABORATORIOS[lab.id] = lab.nome_laboratorio;
            });
        }
    } catch (e) {
        console.warn("Erro ao carregar mapa de laboratórios:", e);
    }
}

function getNomeLab(id) {
    return MAPA_LABORATORIOS[id] || 'Desconhecido';
}

async function carregarDados(dataInicio, dataFim, isDownload) {
    if (!isDownload) tbodyPreview.innerHTML = '<tr><td colspan="100%" class="text-center">Carregando...</td></tr>';

    // === CORREÇÃO CRÍTICA DE DATAS ===
    // Garante que pegamos desde o início do dia (00:00 UTC) até o fim do dia (23:59:59 UTC)
    
    // Data Início: 00:00 UTC (Padrão do new Date("YYYY-MM-DD"))
    const inicioISO = new Date(dataInicio).toISOString(); 
    
    // Data Fim: Forçamos 23:59:59 UTC
    const fimDate = new Date(dataFim);
    fimDate.setUTCHours(23, 59, 59, 999); // <--- MUDANÇA AQUI: Usar UTC Hours
    const fimISO = fimDate.toISOString();

    try {
        // 1. Movimentações (Compras)
        let qMov = supabaseClient.from('Movimentacao')
            .select('*') 
            .gte('data_movimentacao', inicioISO)
            .lte('data_movimentacao', fimISO);
        
        if (!MODO_GLOBAL) qMov = qMov.eq('id_laboratorio', MEU_LAB_ID);

        // 2. Transferências
        let qTransf = supabaseClient.from('Transferencia')
            .select(`*, LabOrigem:id_lab_origem(nome_laboratorio), LabDestino:id_lab_destino(nome_laboratorio), EstoqueLab:id_item_estoque(Reagente(nome), unidade_medida)`)
            .gte('data_solicitacao', inicioISO)
            .lte('data_solicitacao', fimISO);

        if (!MODO_GLOBAL) {
            qTransf = qTransf.or(`id_lab_origem.eq.${MEU_LAB_ID},id_lab_destino.eq.${MEU_LAB_ID}`);
        }

        // 3. Resíduos
        let qRes = supabaseClient.from('Residuo')
            .select('*')
            .eq('status', 'Descartado')
            .gte('data_criacao', inicioISO)
            .lte('data_criacao', fimISO);

        if (!MODO_GLOBAL) qRes = qRes.eq('id_laboratorio', MEU_LAB_ID);

        // Executa
        const [resMov, resTransf, resRes] = await Promise.all([qMov, qTransf, qRes]);

        // Unificação
        let lista = [];

        // Compras
        if (resMov.data) {
            resMov.data.forEach(m => {
                const nomeLab = getNomeLab(m.id_laboratorio);
                lista.push({
                    data: m.data_movimentacao,
                    laboratorio: nomeLab,
                    tipo: 'COMPRA/ENTRADA',
                    item: m.item_nome,
                    qtd: m.quantidade,
                    unidade: m.unidade,
                    detalhes: m.observacao || '-'
                });
            });
        }

        // Transferências
        if (resTransf.data) {
            resTransf.data.forEach(t => {
                let tipoLabel = 'TRANSFERÊNCIA';
                let labPrincipal = t.LabOrigem?.nome_laboratorio;
                let detalheTexto = `Para: ${t.LabDestino?.nome_laboratorio}`;

                if (!MODO_GLOBAL) {
                    const souOrigem = t.id_lab_origem === MEU_LAB_ID;
                    const parceiro = souOrigem ? t.LabDestino?.nome_laboratorio : t.LabOrigem?.nome_laboratorio;
                    tipoLabel = souOrigem ? 'SAÍDA (TROCA)' : 'ENTRADA (TROCA)';
                    labPrincipal = souOrigem ? t.LabOrigem?.nome_laboratorio : t.LabDestino?.nome_laboratorio; 
                    detalheTexto = souOrigem ? `Enviado para ${parceiro}` : `Recebido de ${parceiro}`;
                }

                const nomeItem = t.EstoqueLab?.Reagente?.nome || 'Item desconhecido';
                const un = t.EstoqueLab?.unidade_medida || '';

                lista.push({
                    data: t.data_solicitacao,
                    laboratorio: labPrincipal || 'Desconhecido',
                    tipo: tipoLabel,
                    item: nomeItem,
                    qtd: t.quantidade_transferida,
                    unidade: un,
                    detalhes: detalheTexto
                });
            });
        }

        // Resíduos
        if (resRes.data) {
            resRes.data.forEach(r => {
                const nomeLab = getNomeLab(r.id_laboratorio);
                lista.push({
                    data: r.data_criacao,
                    laboratorio: nomeLab,
                    tipo: 'SAÍDA (DESCARTE)',
                    item: r.descricao,
                    qtd: r.quantidade,
                    unidade: r.unidade_medida,
                    detalhes: `Tipo: ${r.tipo_perigo}`
                });
            });
        }

        lista.sort((a, b) => new Date(b.data) - new Date(a.data));

        if (isDownload) {
            gerarCSV(lista);
        } else {
            renderPreview(lista);
        }

    } catch (error) {
        console.error(error);
        alert("Erro ao gerar relatório.");
    }
}

function renderPreview(lista) {
    tbodyPreview.innerHTML = '';
    if (lista.length === 0) {
        tbodyPreview.innerHTML = '<tr><td colspan="100%" class="text-center">Nenhum registro no período.</td></tr>';
        return;
    }

    lista.forEach(item => {
        const dataF = new Date(item.data).toLocaleDateString('pt-BR');
        let colLab = MODO_GLOBAL ? `<td><small class="fw-bold text-primary">${item.laboratorio}</small></td>` : '';

        const tr = `
            <tr>
                <td>${dataF}</td>
                ${colLab}
                <td>${item.tipo}</td>
                <td>${item.item}</td>
                <td>${item.qtd} ${item.unidade}</td>
                <td>${item.detalhes}</td>
            </tr>
        `;
        tbodyPreview.innerHTML += tr;
    });
}

function gerarCSV(lista) {
    let header = "Data,Tipo,Item,Quantidade,Unidade,Detalhes";
    if (MODO_GLOBAL) header = "Data,Laboratorio,Tipo,Item,Quantidade,Unidade,Detalhes";
    let csvContent = header + "\n";

    lista.forEach(row => {
        const dataF = new Date(row.data).toLocaleDateString('pt-BR');
        const itemL = `"${row.item.replace(/"/g, '""')}"`;
        const detL = `"${row.detalhes.replace(/"/g, '""')}"`;
        const labL = `"${row.laboratorio.replace(/"/g, '""')}"`;

        if (MODO_GLOBAL) {
            csvContent += `${dataF},${labL},${row.tipo},${itemL},${row.qtd},${row.unidade},${detL}\n`;
        } else {
            csvContent += `${dataF},${row.tipo},${itemL},${row.qtd},${row.unidade},${detL}\n`;
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${MODO_GLOBAL ? 'GLOBAL' : 'lab'}_${dataInicioInput.value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', init);
formRelatorio.addEventListener('submit', (e) => {
    e.preventDefault();
    carregarDados(dataInicioInput.value, dataFimInput.value, true);
});