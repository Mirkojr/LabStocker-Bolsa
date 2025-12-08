import { supabaseClient } from './supabaseClient.js';
import { checkIsAdmin } from './sessionManager.js';

const formLab = document.getElementById('form-lab');
const listaLabs = document.getElementById('lista-labs');

// 1. Verificação de Segurança ao Carregar
async function init() {
    try {
        const isAdmin = await checkIsAdmin();
        if (!isAdmin) {
            alert("Acesso Negado: Esta página é restrita para administradores.");
            window.location.href = 'dashboard.html';
            return;
        }
        // Se for admin, carrega a lista
        fetchLabs();
    } catch (error) {
        console.error("Erro ao verificar admin:", error);
    }
}

// 2. Buscar Lista de Laboratórios
async function fetchLabs() {
    listaLabs.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';
    
    const { data, error } = await supabaseClient
        .from('Laboratorio')
        .select('*')
        .order('nome_laboratorio');

    if (error) {
        console.error(error);
        listaLabs.innerHTML = '<div class="alert alert-danger">Erro ao carregar laboratórios.</div>';
        return;
    }

    renderLabs(data);
}

// 3. Renderizar na Tela
function renderLabs(labs) {
    listaLabs.innerHTML = '';
    
    if (labs.length === 0) {
        listaLabs.innerHTML = '<div class="text-muted text-center">Nenhum laboratório cadastrado.</div>';
        return;
    }

    labs.forEach(lab => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div>
                <strong>${lab.nome_laboratorio}</strong>
                <span class="text-muted ms-2 small">(SIPAC: ${lab.codigo_sipac})</span>
            </div>
            <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${lab.id}">
                <i class="bi bi-trash"></i>
            </button>
        `;
        listaLabs.appendChild(item);
    });
}

// 4. Cadastrar Novo Laboratório
async function handleCadastro(e) {
    e.preventDefault();
    
    const nomeInput = document.getElementById('lab-nome');
    const sipacInput = document.getElementById('lab-sipac');
    const btnSubmit = formLab.querySelector('button');

    const nome = nomeInput.value.trim();
    const sipac = sipacInput.value.trim();

    if (!nome || !sipac) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Salvando...';

    try {
        const { error } = await supabaseClient
            .from('Laboratorio')
            .insert({ nome_laboratorio: nome, codigo_sipac: sipac });

        if (error) throw error;

        alert("Laboratório criado com sucesso!");
        formLab.reset();
        fetchLabs(); // Atualiza a lista

    } catch (error) {
        console.error(error);
        alert("Erro ao cadastrar: " + error.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Criar';
    }
}

// 5. Excluir Laboratório
async function handleDelete(id) {
    if(!confirm("ATENÇÃO: Tem certeza que deseja excluir este laboratório?")) return;

    try {
        const { error } = await supabaseClient
            .from('Laboratorio')
            .delete()
            .eq('id', id);

        if (error) {
            // Se houver erro de chave estrangeira (FK), avisa o usuário
            if (error.code === '23503') {
                throw new Error("Não é possível excluir: Existem usuários ou estoque vinculados a este laboratório.");
            }
            throw error;
        }
        
        fetchLabs(); // Atualiza a lista

    } catch (error) {
        alert("Erro ao excluir: " + error.message);
    }
}

// Inicialização e Event Listeners
document.addEventListener('DOMContentLoaded', init);

if (formLab) {
    formLab.addEventListener('submit', handleCadastro);
}

if (listaLabs) {
    listaLabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) handleDelete(btn.dataset.id);
    });
}