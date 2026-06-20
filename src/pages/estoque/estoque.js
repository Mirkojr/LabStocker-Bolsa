import { getCurrentLabId } from '../../shared/sessionManager.js';
import { showToast } from '../../shared/utils/toast.js';
import { escapeHtml } from '../../shared/utils/dom.js';
import { UNIDADES } from '../../shared/constants.js';
import {
    excluirItemestoque,
    listarestoquePorlaboratorio,
    registrarMovimentacaoEntradaestoque,
    salvarItemestoque,
} from '../../shared/services/estoqueService.js';
import { listarreagentesParaestoque } from '../../shared/services/reagentesService.js';
import { confirmar } from '../../shared/utils/confirmacao.js';
import {
    garantirContainerPaginador,
    paginarLista,
    renderPaginador,
    TAMANHO_PAGINA_PADRAO,
} from '../../shared/utils/paginacao.js';
// --- Seletores ---
const listaestoqueEl = document.getElementById('lista-estoque');
const formestoque = document.getElementById('form-estoque');
const inputBusca = document.getElementById('input-busca-estoque');
const filtroValidade = document.getElementById('filtro-validade-estoque');
const filtroUnidade = document.getElementById('filtro-unidade-estoque');
const ordenarSelect = document.getElementById('ordenar-estoque');
const spinner = document.getElementById('loading-spinner-estoque');
const modalEl = document.getElementById('modal-estoque');
const modalestoque = new bootstrap.Modal(modalEl);

// Elementos do Form
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formestoque.querySelector('button[type="submit"]');
const editIdInput = document.getElementById('estoque-edit-id');
const selectreagente = document.getElementById('estoque-reagente');
const quantidadeInput = document.getElementById('estoque-quantidade');
const unidadeInput = document.getElementById('estoque-unidade');
const validadeInput = document.getElementById('estoque-validade');
const observacoesInput = document.getElementById('estoque-observacoes');

let ID_LAB_DO_USUARIO = null;
let itensCache = []; // dados carregados do banco; filtros/ordenacao operam sobre ele
let itensFiltrados = []; // resultado dos filtros/ordenacao; paginado no cliente
let paginaAtualEstoque = 1;

// Container de paginacao (inserido logo abaixo da lista)
const paginadorEstoqueEl = garantirContainerPaginador(listaestoqueEl, 'paginador-estoque');

// Formata número no padrão pt-BR (vírgula decimal, sem zeros sobrando)
function formatarQuantidade(valor) {
    const num = Number(valor);
    if (Number.isNaN(num)) return escapeHtml(String(valor ?? ''));
    return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Preenche o <select> de unidades do FORM a partir da fonte única (constants.js)
function popularUnidadesForm() {
    if (!unidadeInput) return;
    unidadeInput.innerHTML =
        '<option value="" disabled selected>Selecione...</option>' +
        UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join('');
}

// Preenche o <select> de unidades do FILTRO
function popularUnidadesFiltro() {
    if (!filtroUnidade) return;
    filtroUnidade.innerHTML =
        '<option value="">Todas as unidades</option>' +
        UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join('');
}

// ===============================================
// CLASSIFICAÇÃO DE VALIDADE (usada no filtro e no badge)
// ===============================================
function classificarValidade(item) {
    if (!item.data_validade) return 'sem_data';
    const diffDias = Math.ceil((new Date(item.data_validade) - new Date()) / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return 'vencido';
    if (diffDias < 30) return 'vence_breve';
    return 'no_prazo';
}

function montarValidade(item) {
    const status = classificarValidade(item);
    if (status === 'sem_data') {
        return { html: '<span class="badge bg-secondary badge-validade">Sem validade</span>', borderClass: '' };
    }

    const dataFormatada = new Date(item.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

    if (status === 'vencido') {
        return {
            html: `<span class="badge bg-danger badge-validade"><i class="bi bi-exclamation-octagon"></i> Venceu: ${dataFormatada}</span>`,
            borderClass: 'border-start border-danger border-4',
        };
    }
    if (status === 'vence_breve') {
        return {
            html: `<span class="badge bg-warning text-dark badge-validade"><i class="bi bi-hourglass-split"></i> Vence: ${dataFormatada}</span>`,
            borderClass: 'border-start border-warning border-4',
        };
    }
    return { html: `<span class="badge bg-success badge-validade">Val: ${dataFormatada}</span>`, borderClass: '' };
}

// ===============================================
// CARGA + FILTROS + RENDER
// ===============================================
async function fetchestoque(labId) {
    spinner.classList.remove('d-none');
    listaestoqueEl.innerHTML = '';
    if (paginadorEstoqueEl) paginadorEstoqueEl.innerHTML = '';
    try {
        const { data, error } = await listarestoquePorlaboratorio(labId);
        if (error) throw error;
        itensCache = data || [];
        aplicarFiltrosERenderizar();
    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Erro ao carregar estoque.', 'error');
    } finally {
        spinner.classList.add('d-none');
    }
}

function aplicarFiltrosERenderizar() {
    const termo = inputBusca.value.trim().toLowerCase();
    const fValidade = filtroValidade.value; // '' = todas
    const fUnidade = filtroUnidade.value;   // '' = todas
    const ordenar = ordenarSelect.value;    // 'nome_asc' | 'nome_desc'

    itensFiltrados = itensCache
        .filter((item) => {
            const nome = item.reagente?.nome?.toLowerCase() || '';
            if (termo && !nome.includes(termo)) return false;
            if (fValidade && classificarValidade(item) !== fValidade) return false;
            if (fUnidade && item.unidade_medida !== fUnidade) return false;
            return true;
        })
        .sort((a, b) => {
            const na = a.reagente?.nome || '';
            const nb = b.reagente?.nome || '';
            return ordenar === 'nome_desc'
                ? nb.localeCompare(na, 'pt-BR')
                : na.localeCompare(nb, 'pt-BR');
        });

    // Qualquer mudanca de filtro/busca/ordenacao volta para a primeira pagina.
    paginaAtualEstoque = 1;

    if (itensFiltrados.length === 0) {
        listaestoqueEl.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-box-seam text-muted" style="font-size: 3rem;"></i>
                <p class="text-muted mt-3">Nenhum item encontrado.</p>
            </div>`;
        if (paginadorEstoqueEl) paginadorEstoqueEl.innerHTML = '';
        return;
    }
    renderPaginaEstoque();
}

// Renderiza a pagina atual do resultado filtrado e atualiza o paginador.
function renderPaginaEstoque() {
    const itensPagina = paginarLista(itensFiltrados, paginaAtualEstoque, TAMANHO_PAGINA_PADRAO);
    renderestoque(itensPagina);
    renderPaginador(paginadorEstoqueEl, {
        paginaAtual: paginaAtualEstoque,
        totalItens: itensFiltrados.length,
        tamanhoPagina: TAMANHO_PAGINA_PADRAO,
        aoMudarPagina: (p) => {
            paginaAtualEstoque = p;
            renderPaginaEstoque();
            if (listaestoqueEl) listaestoqueEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
    });
}

function renderestoque(itens) {
    listaestoqueEl.innerHTML = '';

    itens.forEach((item) => {
        const { html: validadeHTML, borderClass } = montarValidade(item);
        const nome = escapeHtml(item.reagente?.nome);
        const obs = escapeHtml(item.observacoes_operacionais || '');
        const obsTexto = obs || 'Sem observações operacionais.';

        const div = document.createElement('div');
        div.className = `list-group-item mb-3 shadow-sm rounded border-0 ${borderClass}`;
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-3 text-primary d-none d-md-flex" style="width:48px;height:48px;">
                        <i class="bi bi-droplet-half fs-4"></i>
                    </div>
                    <div>
                        <h5 class="mb-1 fw-bold text-dark">${nome}</h5>
                        <div class="mb-1">
                            <span class="text-primary fw-bold fs-5">${formatarQuantidade(item.quantidade)}</span>
                            <small class="text-muted fw-bold">${escapeHtml(item.unidade_medida)}</small>
                        </div>
                        <small class="text-muted d-block text-truncate" style="max-width: 300px;" title="${obsTexto}">
                            ${obsTexto}
                        </small>
                    </div>
                </div>

                <div class="text-end">
                    <div class="mb-2">${validadeHTML}</div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary btn-edit-estoque me-1 rounded-pill px-3"
                            data-id="${escapeHtml(item.id)}"
                            data-reagente-id="${escapeHtml(item.id_reagente)}"
                            data-quantidade="${escapeHtml(item.quantidade)}"
                            data-unidade="${escapeHtml(item.unidade_medida)}"
                            data-validade="${escapeHtml(item.data_validade || '')}"
                            data-observacoes="${obs}">
                            <i class="bi bi-pencil-fill"></i> <span class="d-none d-md-inline">Editar</span>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-estoque rounded-circle" data-id="${escapeHtml(item.id)}" title="Excluir item">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        listaestoqueEl.appendChild(div);
    });
}

async function fetchreagentesParaModal() {
    try {
        const { data, error } = await listarreagentesParaestoque();
        if (error) throw error;

        selectreagente.innerHTML = '<option value="" disabled selected>Selecione um reagente...</option>';
        data.forEach((reagente) => {
            const opt = document.createElement('option');
            opt.value = reagente.id;
            opt.textContent = reagente.nome;
            selectreagente.appendChild(opt);
        });
    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Erro ao carregar lista de reagentes.', 'error');
    }
}

async function handleFormSubmitestoque(evento) {
    evento.preventDefault();
    if (!ID_LAB_DO_USUARIO) {
        showToast('Sessão inválida. Recarregue a página.', 'error');
        return;
    }

    const QTD_MAX = 1000000;
    const OBS_MAX = 500;

    const id = editIdInput.value;
    const dadosForm = {
        id_laboratorio: ID_LAB_DO_USUARIO,
        id_reagente: selectreagente.value,
        quantidade: parseFloat(quantidadeInput.value),
        unidade_medida: unidadeInput.value,
        data_validade: validadeInput.value || null,
        observacoes_operacionais: observacoesInput.value || null,
    };

    // Validações (defesa no cliente; o banco também garante via CHECK)
    if (!(dadosForm.quantidade > 0) || dadosForm.quantidade > QTD_MAX) {
        showToast(`Quantidade deve ser maior que zero e até ${QTD_MAX.toLocaleString('pt-BR')}.`, 'error');
        return;
    }
    if (!UNIDADES.includes(dadosForm.unidade_medida)) {
        showToast('Selecione uma unidade válida.', 'error');
        return;
    }
    if (dadosForm.observacoes_operacionais && dadosForm.observacoes_operacionais.length > OBS_MAX) {
        showToast(`As observações devem ter no máximo ${OBS_MAX} caracteres.`, 'error');
        return;
    }

    try {
        const { error } = id
            ? await salvarItemestoque(id, dadosForm)
            : await salvarItemestoque(null, dadosForm);
        if (error) throw error;

        if (!id) {
            const nomereagente = selectreagente.options[selectreagente.selectedIndex].text;
            const { error: erroMov } = await registrarMovimentacaoEntradaestoque({
                id_laboratorio: ID_LAB_DO_USUARIO,
                tipo: 'ENTRADA',
                item_nome: nomereagente,
                quantidade: dadosForm.quantidade,
                unidade: dadosForm.unidade_medida,
                observacao: 'Cadastro inicial no estoque',
            });
            if (erroMov) {
                console.error('Falha ao registrar movimentação de entrada:', erroMov.message);
                showToast('Item salvo, mas a entrada não foi registrada no histórico.', 'warning');
            }
        }

        showToast(id ? 'Item atualizado com sucesso!' : 'Item adicionado ao estoque!', 'success');
        modalestoque.hide();
        fetchestoque(ID_LAB_DO_USUARIO); // recarrega o cache
    } catch (error) {
        console.error('Erro:', error.message);
        showToast('Falha ao salvar: ' + error.message, 'error');
    }
}

function handleEditClickestoque(button) {
    const { id, reagenteId, quantidade, unidade, validade, observacoes } = button.dataset;
    editIdInput.value = id;
    selectreagente.value = reagenteId;
    quantidadeInput.value = quantidade;
    unidadeInput.value = unidade;
    validadeInput.value = validade;
    observacoesInput.value = observacoes;
    modalTitle.textContent = 'Editar Item';
    modalSubmitBtn.textContent = 'Salvar Alterações';
    modalestoque.show();
}
async function handleDeleteClickestoque(button) {
    const id = button.dataset.id;
    const ok = await confirmar({
        titulo: 'Excluir item',
        mensagem: 'Tem certeza que deseja excluir este item do estoque? Esta ação não pode ser desfeita.',
        textoConfirmar: 'Excluir',
        tipo: 'danger',
        icone: 'bi-trash-fill',
    });
    if (!ok) return;

    try {
        const { error } = await excluirItemestoque(id);
        if (error) throw error;
        showToast('Item removido do estoque.', 'warning');
        fetchestoque(ID_LAB_DO_USUARIO); // recarrega o cache
    } catch (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
    }
}

function resetModalestoque() {
    formestoque.reset();
    editIdInput.value = '';
    modalTitle.textContent = 'Adicionar Item ao estoque';
    modalSubmitBtn.textContent = 'Salvar no estoque';
    selectreagente.value = '';
    unidadeInput.value = '';
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    popularUnidadesForm();
    popularUnidadesFiltro();

    ID_LAB_DO_USUARIO = await getCurrentLabId();
    if (ID_LAB_DO_USUARIO) {
        fetchestoque(ID_LAB_DO_USUARIO);
        fetchreagentesParaModal();
    } else {
        showToast('Laboratório não identificado. Faça login novamente.', 'error');
    }
});

formestoque.addEventListener('submit', handleFormSubmitestoque);

// Busca, filtros e ordenação operam sobre o cache (sem novas consultas ao banco)
inputBusca.addEventListener('input', aplicarFiltrosERenderizar);
filtroValidade.addEventListener('change', aplicarFiltrosERenderizar);
filtroUnidade.addEventListener('change', aplicarFiltrosERenderizar);
ordenarSelect.addEventListener('change', aplicarFiltrosERenderizar);

listaestoqueEl.addEventListener('click', (e) => {
    const btnEdit = e.target.closest('.btn-edit-estoque');
    const btnDelete = e.target.closest('.btn-delete-estoque');
    if (btnEdit) handleEditClickestoque(btnEdit);
    if (btnDelete) handleDeleteClickestoque(btnDelete);
});

modalEl.addEventListener('hidden.bs.modal', resetModalestoque);