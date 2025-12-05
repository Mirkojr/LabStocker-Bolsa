import { supabaseClient } from './supabaseClient.js';
// MUDANÇA: Importando o gerenciador de sessão para suportar Admin
import { getCurrentLabId, checkIsAdmin, setAdminLabContext } from './sessionManager.js';

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
let SOU_ADMIN = false; // MUDANÇA: Variável para controlar status de admin
let ESTOQUE_ATUAL_CACHE = [];

// --- Funções ---

async function init() {
    try {
        // MUDANÇA: Usando getCurrentLabId() em vez de buscar direto no banco
        // Isso permite que o Admin "finja" ser de um laboratório específico se já estiver logado nele
        MEU_LAB_ID = await getCurrentLabId();
        
        // MUDANÇA: Verifica se é Admin
        SOU_ADMIN = await checkIsAdmin();

        // Se for admin, mostramos um aviso visual no topo da tela
        if (SOU_ADMIN) {
            const container = document.querySelector('.container');
            const aviso = document.createElement('div');
            aviso.className = 'alert alert-warning text-center fw-bold shadow-sm';
            aviso.innerHTML = '<i class="bi bi-shield-lock-fill"></i> Modo Administrador Ativo: Você pode gerenciar qualquer laboratório abaixo.';
            container.insertBefore(aviso, container.firstChild);
        }
        
        fetchLaboratorios();
    } catch (error) {
        console.error("Erro ao iniciar:", error);
        alert("Erro ao carregar dados do usuário.");
    }
}

async function fetchLaboratorios(filtro = '') {
    spinner.classList.remove('d-none');
    gridLabs.innerHTML = '';

    try {
        let query = supabaseClient
            .from('Laboratorio')
            .select('*')
            .order('nome_laboratorio');

        if (filtro) {
            query = query.ilike('nome_laboratorio', `%${filtro}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data.length === 0) {
            gridLabs.innerHTML = '<p class="text-center text-muted col-12">Nenhum laboratório encontrado.</p>';
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
        // Se eu NÃO sou admin, não preciso ver meu próprio laboratório na lista de parceiros
        if (!SOU_ADMIN && lab.id === MEU_LAB_ID) return;

        // MUDANÇA: Cria o botão de Admin se o usuário for Admin
        let btnAdmin = '';
        let btnAcoesNormais = '';

        // Botões normais (Ver estoque/Solicitar)
        // Se eu sou admin, posso ver o estoque de qualquer um (modo leitura), 
        // mas a função principal do admin aqui será "Acessar Painel".
        btnAcoesNormais = `
            <button class="btn btn-outline-primary btn-ver-estoque w-100 mt-2" 
                data-id="${lab.id}" 
                data-nome="${lab.nome_laboratorio}">
                Ver Reagentes Disponíveis
            </button>
        `;

        if (SOU_ADMIN) {
            btnAdmin = `
                <button class="btn btn-warning w-100 mt-2 btn-gerenciar-admin fw-bold"
                    data-id="${lab.id}"
                    data-nome="${lab.nome_laboratorio}">
                    <i class="bi bi-gear-fill"></i> Acessar Painel
                </button>
            `;
        }

        const card = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm hover-effect">
                    <div class="card-body text-center">
                        <div class="mb-3 text-primary">
                            <i class="bi bi-building-fill" style="font-size: 2.5rem;"></i>
                        </div>
                        <h5 class="card-title">${lab.nome_laboratorio}</h5>
                        <p class="card-text text-muted small">SIPAC: ${lab.codigo_sipac}</p>
                        
                        ${btnAcoesNormais}
                        ${btnAdmin}
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
            .gt('quantidade', 0)
            .order('quantidade', { ascending: false });

        if (error) throw error;
        
        ESTOQUE_ATUAL_CACHE = data; 
        ESTOQUE_ATUAL_CACHE.labId = labId;
        
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
        // Se eu sou admin e estou apenas navegando, ou se estou vendo o estoque do lab que estou "logado",
        // talvez não faça sentido pedir para mim mesmo. Mas deixaremos o botão por compatibilidade.
        
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

    document.getElementById('solic-item-id').value = id;
    document.getElementById('solic-lab-destino').value = labDestino;
    document.getElementById('solic-max-qtd').value = max;
    
    textoSolicitacao.textContent = `Solicitando: ${nome}`;
    unidadeSolicitadaSpan.textContent = unidade;
    qtdSolicitadaInput.max = max;
    qtdSolicitadaInput.value = '';
    erroQtd.classList.add('d-none');

    modalEstoqueExt.hide();
    modalSolicitar.show();
}

async function enviarSolicitacao(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('solic-item-id').value;
    const labDestino = document.getElementById('solic-lab-destino').value; 
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
                id_lab_origem: MEU_LAB_ID,   // EU sou a Origem do PEDIDO
                id_lab_destino: labDestino,  // O outro lab é o Destino do PEDIDO
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
    const btnSolicitar = e.target.closest('.btn-solicitar');
    if (btnSolicitar) {
        abrirModalSolicitacao(btnSolicitar);
    }

    // MUDANÇA: Botão de Admin "Acessar Painel"
    const btnAdmin = e.target.closest('.btn-gerenciar-admin');
    if (btnAdmin) {
        const id = btnAdmin.dataset.id;
        const nome = btnAdmin.dataset.nome;
        
        if(confirm(`Entrar no painel do ${nome} com privilégios de Administrador?`)) {
            setAdminLabContext(id, nome); // Salva na sessão que agora somos desse lab
            window.location.href = 'dashboard.html'; // Redireciona para o dashboard simulando ser desse lab
        }
    }
});

// Envio do formulário
formSolicitacao.addEventListener('submit', enviarSolicitacao);

modalSolicitarEl.addEventListener('hidden.bs.modal', () => {
    // Opcional: reabrir modal de estoque
});