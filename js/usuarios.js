import { supabaseClient } from './supabaseClient.js';
// MUDANÇA: Importando o gerenciador de sessão (para suportar Admin)
import { getCurrentLabId } from './sessionManager.js';

const listaUsuariosEl = document.getElementById('lista-usuarios');
const spinner = document.getElementById('spinner-users');
let MEU_LAB_ID = null;

async function init() {
    try {
        // MUDANÇA: Usamos a nova função que suporta o "Modo Admin"
        MEU_LAB_ID = await getCurrentLabId();
        
        if (MEU_LAB_ID) {
            fetchUsuarios();
        } else {
            listaUsuariosEl.innerHTML = '<div class="alert alert-danger">Erro: Laboratório não identificado.</div>';
        }

    } catch (error) {
        console.error(error);
        listaUsuariosEl.innerHTML = '<div class="alert alert-danger">Erro ao carregar dados.</div>';
    }
}

async function fetchUsuarios() {
    spinner.classList.remove('d-none');
    listaUsuariosEl.innerHTML = '';

    try {
        // Busca TODOS os perfis que tenham o mesmo ID de laboratório
        const { data, error } = await supabaseClient
            .from('Perfis')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .order('nome'); // Ordem alfabética

        if (error) throw error;

        if (data.length === 0) {
            listaUsuariosEl.innerHTML = '<div class="text-center text-muted">Nenhum usuário encontrado.</div>';
        } else {
            renderUsuarios(data);
        }

    } catch (error) {
        console.error(error);
        listaUsuariosEl.innerHTML = '<div class="alert alert-danger">Erro ao buscar equipe.</div>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderUsuarios(usuarios) {
    // Vamos separar em dois grupos para ficar organizado
    const tecnicos = usuarios.filter(u => u.tipo_identificador === 'SIAPE');
    const alunos = usuarios.filter(u => u.tipo_identificador === 'MATRICULA');

    let html = '';

    // 1. Renderizar Técnicos
    if (tecnicos.length > 0) {
        html += `<h5 class="text-primary mb-3 border-bottom pb-2"><i class="bi bi-person-badge-fill"></i> Técnicos / Servidores</h5>`;
        html += `<div class="list-group mb-4">`;
        tecnicos.forEach(user => {
            html += criarItemUsuario(user, 'bg-primary-subtle');
        });
        html += `</div>`;
    }

    // 2. Renderizar Alunos
    if (alunos.length > 0) {
        html += `<h5 class="text-success mb-3 border-bottom pb-2"><i class="bi bi-backpack-fill"></i> Alunos / Pesquisadores</h5>`;
        html += `<div class="list-group mb-4">`;
        alunos.forEach(user => {
            html += criarItemUsuario(user, 'bg-success-subtle');
        });
        html += `</div>`;
    }

    listaUsuariosEl.innerHTML = html;
}

function criarItemUsuario(user, iconeBgClass) {
    // Formata o nome completo
    const nomeCompleto = `${user.nome} ${user.sobrenome}`;
    const tipoDoc = user.tipo_identificador === 'SIAPE' ? 'SIAPE' : 'Matrícula';
    
    return `
        <div class="list-group-item d-flex align-items-center">
            <div class="me-3">
                <div class="avatar-placeholder rounded-circle d-flex align-items-center justify-content-center ${iconeBgClass}" style="width: 45px; height: 45px;">
                    <span class="fw-bold">${user.nome.charAt(0)}</span>
                </div>
            </div>
            <div>
                <h6 class="mb-0 fw-bold">${nomeCompleto}</h6>
                <small class="text-muted">${tipoDoc}: ${user.identificador}</small>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);