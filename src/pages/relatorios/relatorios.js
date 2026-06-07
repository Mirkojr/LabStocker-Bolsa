import { getCurrentLabId, checkIsAdmin } from '../../shared/sessionManager.js';
import { showToast } from '../../shared/utils/toast.js';
import { listarLaboratoriosResumo } from '../../shared/services/laboratoriosService.js';
import { listarMovimentacoesPorPeriodo } from '../../shared/services/movimentacoesService.js';
import { listarTransferenciasPorPeriodo } from '../../shared/services/transferenciasService.js';
import { listarResiduosDescartadosPorPeriodo } from '../../shared/services/residuosService.js';

// --- Seletores ---
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

        // Verifica Modo Global (Admin vendo tudo)
        const labSelecionado = sessionStorage.getItem('ADMIN_SELECTED_LAB_ID');
        if (SOU_ADMIN && !labSelecionado) {
            MODO_GLOBAL = true;
            if (tituloPagina) tituloPagina.innerHTML = 'Relatorio Geral (Todos os Laboratorios)';

            // Adiciona coluna "Laboratorio" se for admin global
            const headerRow = document.querySelector('#tabela-preview thead tr');
            if (headerRow && !headerRow.innerHTML.includes('Laboratorio')) {
                const thLab = document.createElement('th');
                thLab.textContent = 'Laboratorio';
                thLab.className = 'py-3';
                headerRow.insertBefore(thLab, headerRow.children[1]); 
            }
        }

        await fetchMapalaboratorios();

        if (MEU_LAB_ID || MODO_GLOBAL) {
            // Define datas padrao (ultimos 30 dias)
            const hoje = new Date();
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(hoje.getDate() - 30);

            dataFimInput.value = hoje.toISOString().split('T')[0];
            dataInicioInput.value = trintaDiasAtras.toISOString().split('T')[0];

            // Carrega preview inicial
            carregarDados(dataInicioInput.value, dataFimInput.value, false);
        } else {
            if (!SOU_ADMIN) showToast("Erro: Laboratorio nao identificado.", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro na inicializacao da pagina.", "error");
    }
}

async function fetchMapalaboratorios() {
    try {
        const { data, error } = await listarLaboratoriosResumo();

        if (!error && data) {
            data.forEach(lab => {
                MAPA_LABORATORIOS[lab.id] = lab.nome_laboratorio;
            });
        }
    } catch (e) {
        console.warn("Erro ao carregar mapa de laboratorios:", e);
    }
}

function getNomeLab(id) {
    return MAPA_LABORATORIOS[id] || 'Desconhecido';
}

async function carregarDados(dataInicio, dataFim, isDownload) {
    const btnSubmit = formRelatorio.querySelector('button[type="submit"]');
    let resetBtn;

    if (!isDownload) {
        tbodyPreview.innerHTML = '<tr><td colspan="100%" class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div> Carregando dados...</td></tr>';
    } else {
        // feedback visual no botao de baixar
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Gerando CSV...';

        resetBtn = () => {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        };
    }

    // Configuracao de Datas (UTC)
    const inicioISO = new Date(dataInicio).toISOString(); 
    const fimDate = new Date(dataFim);
    fimDate.setUTCHours(23, 59, 59, 999);
    const fimISO = fimDate.toISOString();

    // Em modo global nao filtramos por laboratorio
    const labFiltro = MODO_GLOBAL ? null : MEU_LAB_ID;

    try {
        // Consultas via camada de services, executadas em paralelo
        const [resMov, resTransf, resRes] = await Promise.all([
            listarMovimentacoesPorPeriodo(inicioISO, fimISO, labFiltro),
            listarTransferenciasPorPeriodo(inicioISO, fimISO, labFiltro),
            listarResiduosDescartadosPorPeriodo(inicioISO, fimISO, labFiltro)
        ]);

        // Processamento dos dados
        let lista = [];

        // 1. Compras/Entradas
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

        // 2. Transferencias
        if (resTransf.data) {
            resTransf.data.forEach(t => {
                let tipoLabel = 'TRANSFERENCIA';
                let labPrincipal = t.LabOrigem?.nome_laboratorio;
                let detalheTexto = `Para: ${t.LabDestino?.nome_laboratorio}`;

                if (!MODO_GLOBAL) {
                    const souOrigem = t.id_lab_origem === MEU_LAB_ID;
                    const parceiro = souOrigem ? t.LabDestino?.nome_laboratorio : t.LabOrigem?.nome_laboratorio;
                    tipoLabel = souOrigem ? 'SAIDA (TROCA)' : 'ENTRADA (TROCA)';
                    labPrincipal = souOrigem ? t.LabOrigem?.nome_laboratorio : t.LabDestino?.nome_laboratorio; 
                    detalheTexto = souOrigem ? `Enviado para ${parceiro}` : `Recebido de ${parceiro}`;
                }

                const nomeItem = t.estoquelab?.reagente?.nome || 'Item desconhecido';
                const un = t.estoquelab?.unidade_medida || '';

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

        // 3. Descartes
        if (resRes.data) {
            resRes.data.forEach(r => {
                const nomeLab = getNomeLab(r.id_laboratorio);
                lista.push({
                    data: r.data_criacao,
                    laboratorio: nomeLab,
                    tipo: 'SAIDA (DESCARTE)',
                    item: r.descricao,
                    qtd: r.quantidade,
                    unidade: r.unidade_medida,
                    detalhes: `Tipo: ${r.tipo_perigo}`
                });
            });
        }

        // Ordenar por data (mais recente primeiro)
        lista.sort((a, b) => new Date(b.data) - new Date(a.data));

        if (isDownload) {
            if (lista.length === 0) {
                showToast("Nao ha dados para gerar relatorio neste periodo.", "warning");
            } else {
                gerarCSV(lista);
                showToast("Relatorio gerado com sucesso! Download iniciado.", "success");
            }
            if (resetBtn) resetBtn();
        } else {
            renderPreview(lista);
        }

    } catch (error) {
        console.error(error);
        showToast("Erro ao processar dados do relatorio.", "error");
        if (resetBtn) resetBtn();
        if (!isDownload) tbodyPreview.innerHTML = '<tr><td colspan="100%" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function renderPreview(lista) {
    tbodyPreview.innerHTML = '';
    if (lista.length === 0) {
        tbodyPreview.innerHTML = '<tr><td colspan="100%" class="text-center text-muted py-5">Nenhum registro encontrado neste periodo.</td></tr>';
        return;
    }

    lista.forEach(item => {
        const dataF = new Date(item.data).toLocaleDateString('pt-BR');
        let colLab = MODO_GLOBAL ? `<td><span class="badge bg-light text-dark border">${item.laboratorio}</span></td>` : '';

        let badgeTipo = 'bg-secondary';
        if(item.tipo.includes('ENTRADA')) badgeTipo = 'bg-success';
        if(item.tipo.includes('SAIDA')) badgeTipo = 'bg-danger';
        if(item.tipo.includes('TRANSFERENCIA')) badgeTipo = 'bg-primary';

        const tr = `
            <tr>
                <td class="ps-3">${dataF}</td>
                ${colLab}
                <td><span class="badge ${badgeTipo}" style="font-size: 0.75rem;">${item.tipo}</span></td>
                <td class="fw-semibold">${item.item}</td>
                <td>${item.qtd} <small class="text-muted text-uppercase">${item.unidade}</small></td>
                <td class="pe-3 text-muted small">${item.detalhes}</td>
            </tr>
        `;
        tbodyPreview.innerHTML += tr;
    });
}

function gerarCSV(lista) {
    let header = "Data,Tipo,Item,Quantidade,Unidade,Detalhes";
    if (MODO_GLOBAL) header = "Data,laboratorio,Tipo,Item,Quantidade,Unidade,Detalhes";
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
