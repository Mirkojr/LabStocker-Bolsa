import { supabaseClient } from './supabaseClient.js';

// --- Elementos ---
const gridLabs = document.getElementById('grid-laboratorios');
const buscaLab = document.getElementById('busca-lab');
const spinner = document.getElementById('spinner-lab');

// Modal Estoque Externo
const modalEstoqueExtEl = document.getElementById('modal-estoque-externo');
const modalEstoqueExt = new bootstrap.Modal(modalEstoqueExtEl);
const listaEstoqueExt = document.getElementById('lista-estoque-externo');
const tituloLabSelecionado = document.getElementById('titulo-lab-selecionado');
const buscaEstoqueExt = document.getElementById('busca-estoque-externo');

// Modal Solicitação
const modalSolicitarEl = document.getElementById('modal-solicitar');
const modalSolicitar = new bootstrap.Modal(modalSolicitarEl);
const formSolicitacao = document.getElementById('form-solicitacao');
const qtdSolicitadaInput = document.getElementById('qtd-solicitada');
const unidadeSolicitadaSpan = document.getElementById('unidade-solicitada');
const textoSolicitacao = document.getElementById('texto-solicitacao');
const erroQtd = document.getElementById('erro-qtd');

// Variáveis Globais
let MEU_LAB_ID = null;
let ESTOQUE_ATUAL_CACHE = []; // Para guardar o estoque que estamos vendo

// --- Funções ---

async function init() {
    // 1. Descobrir qual é o meu laboratório (para não mostrar ele na lista e para ser a "Origem" da troca)
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const { data: perfil } = await supabaseClient.from('Perfis').select('id_laboratorio').eq('id', user.id).single();
        MEU_LAB_ID = perfil.id_laboratorio;
        
        fetchLaboratorios();
    } catch (error) {
        console.error("Erro ao iniciar:", error);
        alert("Erro ao carregar perfil do usuário.");
    }
}

async function fetchLaboratorios(filtro = '') {
    spinner.classList.remove('d-none');
    gridLabs.innerHTML = '';

    try {
        // Busca todos os laboratórios exceto o meu (.neq)
        let query = supabaseClient
            .from('Laboratorio')
            .select('*')
            .neq('id', MEU_LAB_ID) 
            .order('nome_laboratorio');

        if (filtro) {
            query = query.ilike('nome_laboratorio', `%${filtro}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data.length === 0) {
            gridLabs.innerHTML = '<p class="text-center text-muted col-12">Nenhum outro laboratório encontrado.</p>';
        } else {
            renderLabs(data);
        }
    } catch (error) {
        console.error(error);
        gridLabs.innerHTML = '<p class="text-danger col-12">Erro ao carregar laboratórios.</p>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderLabs(labs) {
    labs.forEach(lab => {
        const card = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm hover-effect">
                    <div class="card-body text-center">
                        <div class="mb-3 text-primary">
                            <i class="bi bi-building-fill" style="font-size: 2.5rem;"></i>
                        </div>
                        <h5 class="card-title">${lab.nome_laboratorio}</h5>
                        <p class="card-text text-muted small">SIPAC: ${lab.codigo_sipac}</p>
                        <button class="btn btn-outline-primary btn-ver-estoque w-100 mt-2" 
                            data-id="${lab.id}" 
                            data-nome="${lab.nome_laboratorio}">
                            Ver Reagentes Disponíveis
                        </button>
                    </div>
                </div>
            </div>
        `;
        gridLabs.innerHTML += card;
    });
}

// Busca o estoque de um laboratório específico
async function fetchEstoqueExterno(labId, labNome) {
    tituloLabSelecionado.textContent = `Estoque de: ${labNome}`;
    listaEstoqueExt.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';
    modalEstoqueExt.show();

    try {
        const { data, error } = await supabaseClient
            .from('EstoqueLab')
            .select(`
                id,
                quantidade,
                unidade_medida,
                data_validade,
                Reagente ( nome, composicao_quimica )
            `)
            .eq('id_laboratorio', labId)
            .gt('quantidade', 0) // Só mostra o que tem quantidade positiva
            .order('quantidade', { ascending: false });

        if (error) throw error;
        
        ESTOQUE_ATUAL_CACHE = data; // Guarda em memória para filtrar
        ESTOQUE_ATUAL_CACHE.labId = labId; // Guarda o ID do dono desse estoque
        
        renderEstoqueExterno(data, labId);

    } catch (error) {
        console.error(error);
        listaEstoqueExt.innerHTML = '<p class="text-danger text-center">Erro ao carregar estoque.</p>';
    }
}

function renderEstoqueExterno(itens, labIdDono) {
    listaEstoqueExt.innerHTML = '';

    if (itens.length === 0) {
        listaEstoqueExt.innerHTML = '<p class="text-muted text-center">Este laboratório não possui reagentes em estoque no momento.</p>';
        return;
    }

    itens.forEach(item => {
        const html = `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0">${item.Reagente.nome} <small class="text-muted">(${item.Reagente.composicao_quimica || ''})</small></h6>
                    <small class="text-muted">Disp: ${item.quantidade} ${item.unidade_medida} | Val: ${item.data_validade || 'N/A'}</small>
                </div>
                <button class="btn btn-sm btn-success btn-solicitar"
                    data-id="${item.id}"
                    data-nome="${item.Reagente.nome}"
                    data-max="${item.quantidade}"
                    data-unidade="${item.unidade_medida}"
                    data-lab-destino="${labIdDono}">
                    <i class="bi bi-arrow-left-right"></i> Solicitar
                </button>
            </div>
        `;
        listaEstoqueExt.innerHTML += html;
    });
}

function abrirModalSolicitacao(btn) {
    const { id, nome, max, unidade, labDestino } = btn.dataset;

    // Preenche o modal pequeno
    document.getElementById('solic-item-id').value = id;
    document.getElementById('solic-lab-destino').value = labDestino;
    document.getElementById('solic-max-qtd').value = max;
    
    textoSolicitacao.textContent = `Solicitando: ${nome}`;
    unidadeSolicitadaSpan.textContent = unidade;
    qtdSolicitadaInput.max = max;
    qtdSolicitadaInput.value = '';
    erroQtd.classList.add('d-none');

    // Esconde o modal grande (estoque) e abre o pequeno (solicitação)
    modalEstoqueExt.hide();
    modalSolicitar.show();
}

async function enviarSolicitacao(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('solic-item-id').value;
    const labDestino = document.getElementById('solic-lab-destino').value; // O Outro Lab
    const quantidade = parseFloat(qtdSolicitadaInput.value);
    const max = parseFloat(document.getElementById('solic-max-qtd').value);

    if (quantidade > max) {
        erroQtd.textContent = `Máximo disponível: ${max}`;
        erroQtd.classList.remove('d-none');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('Transferencia')
            .insert({
                id_item_estoque: itemId,
                // PADRÃO CORRETO:
                id_lab_origem: MEU_LAB_ID,   // EU sou a Origem do PEDIDO (estou pedindo)
                id_lab_destino: labDestino,  // O outro lab é o Destino do PEDIDO (ele vai aprovar)
                quantidade_transferida: quantidade,
                status: 'Pendente'
            });

        if (error) throw error;

        alert("Solicitação enviada com sucesso! O laboratório parceiro será notificado.");
        modalSolicitar.hide();

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao enviar solicitação: " + error.message);
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', init);

// Busca com debounce
let debounce;
buscaLab.addEventListener('keyup', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => fetchLaboratorios(buscaLab.value), 300);
});

// Filtro dentro do modal de estoque
buscaEstoqueExt.addEventListener('keyup', () => {
    const termo = buscaEstoqueExt.value.toLowerCase();
    const filtrados = ESTOQUE_ATUAL_CACHE.filter(item => 
        item.Reagente.nome.toLowerCase().includes(termo)
    );
    renderEstoqueExterno(filtrados, ESTOQUE_ATUAL_CACHE.labId);
});

// Clique nos botões (Delegação de Eventos)
document.addEventListener('click', (e) => {
    // Botão "Ver Estoque" (no Card)
    if (e.target.classList.contains('btn-ver-estoque')) {
        fetchEstoqueExterno(e.target.dataset.id, e.target.dataset.nome);
    }
    
    // Botão "Solicitar" (na Lista)
    // Precisamos usar .closest() porque o usuário pode clicar no ícone <i> dentro do botão
    const btnSolicitar = e.target.closest('.btn-solicitar');
    if (btnSolicitar) {
        abrirModalSolicitacao(btnSolicitar);
    }
});

// Envio do formulário
formSolicitacao.addEventListener('submit', enviarSolicitacao);

// Quando fecha o modal de solicitação, reabre o de estoque (UX melhor)
modalSolicitarEl.addEventListener('hidden.bs.modal', () => {
    // Só reabre se não tivermos acabado de enviar com sucesso (opcional, mas bom fluxo)
    // Por simplicidade, vamos deixar fechado ou o usuário reabre se quiser ver mais.
});