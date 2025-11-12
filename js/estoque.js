import { supabaseClient } from './supabaseClient.js';

// --- Seletores de Elementos ---
const listaEstoqueEl = document.getElementById('lista-estoque');
const formEstoque = document.getElementById('form-estoque');
const inputBusca = document.getElementById('input-busca-estoque');
const spinner = document.getElementById('loading-spinner-estoque');
const selectReagente = document.getElementById('estoque-reagente');
const modalEstoque = new bootstrap.Modal(document.getElementById('modal-estoque'));

// Variável global para guardar o ID do laboratório do usuário
let ID_LAB_DO_USUARIO = null;


// --- Funções Principais ---

/**
 * Passo 1: Descobre o ID do usuário e, em seguida, o ID do seu laboratório.
 */
async function getLabIdDoUsuario() {
    // Pega o usuário logado
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        console.error('Usuário não encontrado.');
        return null;
    }

    // Busca o perfil do usuário para encontrar o 'id_laboratorio'
    // (Requer a Política RLS de 'SELECT' na tabela 'Perfis' que criamos)
    try {
        const { data, error } = await supabaseClient
            .from('Perfis')
            .select('id_laboratorio')
            .eq('id', user.id) // Onde o 'id' do perfil é o 'id' do usuário logado
            .single(); // Esperamos SÓ UM resultado

        if (error) throw error;
        if (!data.id_laboratorio) {
            throw new Error('Usuário não está associado a nenhum laboratório.');
        }

        return data.id_laboratorio; // Retorna o UUID do laboratório

    } catch (error) {
        listaEstoqueEl.innerHTML = `<p class="text-center text-danger">Erro: ${error.message}</p>`;
        return null;
    }
}

/**
 * Passo 2: Busca os itens de ESTOQUE do laboratório específico.
 */
async function fetchEstoque(labId, filtroNome = '') {
    spinner.classList.remove('d-none');
    listaEstoqueEl.innerHTML = '';

    try {
        // Esta é a MÁGICA:
        // 1. Pega tudo de 'EstoqueLab'
        // 2. Pega ( * ) (tudo) da tabela 'Reagente' relacionada
        // 3. Onde o 'id_laboratorio' for o do nosso usuário
        let query = supabaseClient
            .from('EstoqueLab')
            .select(`
                id,
                quantidade,
                unidade_medida,
                data_validade,
                observacoes_operacionais,
                Reagente ( nome ) 
            `) // Otimizado: só pega o 'nome' do Reagente
            .eq('id_laboratorio', labId)
            .order('data_validade');

        // Adiciona o filtro de busca se houver
        // (Nota: filtrar por nome de tabela relacionada é avançado,
        // vamos filtrar na lista de resultados por enquanto)
            
        // (Filtro de busca simples - faremos no front-end por agora)

        const { data, error } = await query;
        if (error) throw error;

        // Filtro de busca (pós-query)
        const itensFiltrados = data.filter(item => 
            !filtroNome || item.Reagente.nome.toLowerCase().includes(filtroNome.toLowerCase())
        );

        if (itensFiltrados.length === 0) {
            listaEstoqueEl.innerHTML = '<p class="text-center text-muted">Nenhum item no estoque.</p>';
        } else {
            renderEstoque(itensFiltrados);
        }

    } catch (error) {
        console.error('Erro ao buscar estoque:', error.message);
        listaEstoqueEl.innerHTML = '<p class="text-center text-danger">Erro ao carregar estoque.</p>';
    } finally {
        spinner.classList.add('d-none');
    }
}

/**
 * Renderiza a lista de estoque no HTML.
 */
function renderEstoque(itens) {
    itens.forEach(item => {
        const itemHtml = `
            <div class="list-group-item">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${item.Reagente.nome} - ${item.quantidade} ${item.unidade_medida}</h5>
                    <small class="text-muted">Val: ${item.data_validade || 'N/A'}</small>
                </div>
                <p class="mb-1">${item.observacoes_operacionais || 'Sem observações.'}</p>
            </div>
        `;
        listaEstoqueEl.innerHTML += itemHtml;
    });
}

/**
 * Passo 3: Busca os REAGENTES (do catálogo) para preencher o Modal.
 */
async function fetchReagentesParaModal() {
    try {
        const { data, error } = await supabaseClient
            .from('Reagente')
            .select('id, nome')
            .order('nome');
        
        if (error) throw error;

        // Preenche o <select>
        selectReagente.innerHTML = '<option value="" disabled selected>Selecione um reagente...</option>';
        data.forEach(reagente => {
            const option = `<option value="${reagente.id}">${reagente.nome}</option>`;
            selectReagente.innerHTML += option;
        });

    } catch (error) {
        console.error('Erro ao buscar reagentes para o modal:', error.message);
        selectReagente.innerHTML = '<option value="" disabled>Erro ao carregar</option>';
    }
}

/**
 * Lida com o cadastro de um novo item de ESTOQUE.
 */
async function handleCadastroEstoque(evento) {
    evento.preventDefault();
    if (!ID_LAB_DO_USUARIO) {
        alert('Erro: ID do laboratório não encontrado.');
        return;
    }

    // Pega os dados do formulário do modal
    const reagenteId = document.getElementById('estoque-reagente').value;
    const quantidade = document.getElementById('estoque-quantidade').value;
    const unidade = document.getElementById('estoque-unidade').value;
    const validade = document.getElementById('estoque-validade').value;
    const observacoes = document.getElementById('estoque-observacoes').value;

    try {
        const { error } = await supabaseClient
            .from('EstoqueLab')
            .insert({
                id_laboratorio: ID_LAB_DO_USUARIO, // O ID que buscamos
                id_reagente: reagenteId,
                quantidade: quantidade,
                unidade_medida: unidade,
                data_validade: validade || null, // Se for vazio, insere NULO
                observacoes_operacionais: observacoes || null
            });
        
        if (error) throw error;

        alert('Item adicionado ao estoque!');
        formEstoque.reset();
        modalEstoque.hide();
        fetchEstoque(ID_LAB_DO_USUARIO); // Atualiza a lista

    } catch (error) {
        console.error('Erro ao cadastrar no estoque:', error.message);
        alert('Erro ao cadastrar: ' + error.message);
    }
}


// --- Event Listeners (Ouvintes de Eventos) ---

// 1. Quando o DOM carregar, começa a cadeia de eventos
document.addEventListener('DOMContentLoaded', async () => {
    // Passo 1: Descobre o lab
    ID_LAB_DO_USUARIO = await getLabIdDoUsuario();
    
    if (ID_LAB_DO_USUARIO) {
        // Passo 2: Busca o estoque
        fetchEstoque(ID_LAB_DO_USUARIO);
        // Passo 3: Prepara o modal
        fetchReagentesParaModal();
    }
});

// 2. Quando o formulário do modal for enviado
formEstoque.addEventListener('submit', handleCadastroEstoque);

// 3. Busca
let debounceTimer;
inputBusca.addEventListener('keyup', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchEstoque(ID_LAB_DO_USUARIO, inputBusca.value);
    }, 300);
});