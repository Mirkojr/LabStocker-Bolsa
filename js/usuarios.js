import { supabaseClient } from './supabaseClient.js';
import { getCurrentLabId } from './labContext.js';

const listaUsuariosEl = document.getElementById('lista-usuarios');
const spinner = document.getElementById('spinner-users');
let MEU_LAB_ID = null;


function showToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let iconClass = 'bi-check-circle-fill', typeClass = 'toast-success';
    if (tipo === 'error') { iconClass = 'bi-x-circle-fill'; typeClass = 'toast-error'; }

    const toast = document.createElement('div');
    toast.className = `toast-box ${typeClass}`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${iconClass} fs-4 me-3"></i>
            <span class="fw-semibold text-dark">${mensagem}</span>
        </div>
        <button type="button" class="btn-close ms-3"></button>`;
    
    toast.querySelector('.btn-close').onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentElement) toast.remove(); }, 4000);
}

async function init() {
    try {
        MEU_LAB_ID = await getCurrentLabId();
        
        if (MEU_LAB_ID) {
            fetchUsuarios();
        } else {
            showToast("Laboratório não identificado.", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar sessão.", "error");
    }
}

async function fetchUsuarios() {
    spinner.classList.remove('d-none');
    listaUsuariosEl.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('Perfis')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .order('nome');

        if (error) throw error;
        renderUsuarios(data);

    } catch (error) {
        console.error(error);
        showToast("Erro ao buscar equipe.", "error");
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderUsuarios(perfis) {
    if (perfis.length === 0) {
        listaUsuariosEl.innerHTML = '<p class="text-center text-muted-light my-5">Nenhum membro cadastrado.</p>';
        return;
    }

    // Filtros de grupo conforme sua lógica original
    const tecnicos = perfis.filter(p => p.cargo === 'Tecnico' || p.cargo === 'Docente');
    const alunos = perfis.filter(p => p.cargo !== 'Tecnico' && p.cargo !== 'Docente');

    let html = '';

    // Renderizar Técnicos/Docentes
    if (tecnicos.length > 0) {
        html += `<h6 class="text-warning mb-3 fw-bold text-uppercase small letter-spacing-1"><i class="bi bi-person-badge-fill me-2"></i>Corpo Técnico / Científico</h6>`;
        html += `<div class="mb-4">`;
        tecnicos.forEach(user => {
            html += criarItemUsuario(user, 'bg-warning text-dark');
        });
        html += `</div>`;
    }

    // Renderizar Alunos
    if (alunos.length > 0) {
        html += `<h6 class="text-info mb-3 fw-bold text-uppercase small letter-spacing-1"><i class="bi bi-backpack-fill me-2"></i>Alunos e Pesquisadores</h6>`;
        html += `<div class="mb-4">`;
        alunos.forEach(user => {
            html += criarItemUsuario(user, 'bg-info text-dark');
        });
        html += `</div>`;
    }

    listaUsuariosEl.innerHTML = html;
}

function criarItemUsuario(user, iconeBgClass) {
    const nomeCompleto = `${user.nome} ${user.sobrenome}`;
    const idValor = user.identificador || 'N/A';
    
    return `
        <div class="d-flex align-items-center p-3 mb-2 rounded-4 border border-white border-opacity-10" style="background: rgba(255,255,255,0.03);">
            <div class="me-3">
                <div class="rounded-circle d-flex align-items-center justify-content-center ${iconeBgClass} shadow-sm" style="width: 48px; height: 48px;">
                    <span class="fw-bold fs-5">${user.nome.charAt(0).toUpperCase()}</span>
                </div>
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-0 fw-bold text-white">${nomeCompleto}</h6>
                <div class="d-flex gap-2 mt-1">
                    <small class="text-muted-light"><i class="bi bi-card-text me-1"></i>${idValor}</small>
                    <small class="text-muted-light">| <i class="bi bi-envelope me-1"></i>${user.email || 'Sem e-mail'}</small>
                </div>
            </div>
            <div class="d-none d-md-block text-end">
                <span class="badge bg-light bg-opacity-10 text-white-50 rounded-pill border border-white border-opacity-10 px-3">
                    ${user.cargo || 'Membro'}
                </span>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);