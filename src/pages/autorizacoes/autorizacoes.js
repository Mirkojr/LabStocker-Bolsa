import { checkIsAdmin } from '../../shared/sessionManager.js';
import { showToast } from '../../shared/utils/toast.js';
import { $ } from '../../shared/utils/dom.js';
import {
    aplicarMascara,
    mascararCPF,
    mascararTelefone,
    mascararSiape,
    mascararPeriodo,
} from '../../shared/utils/masks.js';
import { listarProjetosPorEmail } from '../../shared/services/projetosService.js';
import {
    preencherDadosUsuario,
    iniciarLogicaFormulario,
    getEmailUsuarioLogado,
} from './autorizacoesForm.js';
import {
    renderListaProjetos,
    renderEstadoLista,
    abrirModalDetalhes,
    adicionarLinhaProduto,
} from './autorizacoesView.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
    configurarMascaras();
    await inicializarPagina();
}

function configurarMascaras() {
    aplicarMascara($('responsavel-cpf'), mascararCPF);
    aplicarMascara($('responsavel-telefone'), mascararTelefone);
    aplicarMascara($('responsavel-siape'), mascararSiape);
    aplicarMascara($('projeto-periodo'), mascararPeriodo);
}

async function inicializarPagina() {
    const loadingDiv = $('auth-loading');
    const contentDiv = $('main-content');

    try {
        if (await checkIsAdmin()) {
            window.location.replace('../admin/admin-autorizacoes.html');
            return;
        }

        revelarConteudo(loadingDiv, contentDiv);

        await preencherDadosUsuario();
        await carregarMeusProjetos();
        iniciarLogicaFormulario(aposEnviarSolicitacao);
        adicionarLinhaProduto();
    } catch (e) {
        console.error('Erro ao inicializar a página de autorizações:', e);
        revelarConteudo(loadingDiv, contentDiv); // nunca deixa preso no loading
        showToast('Erro ao carregar a página de autorizações.', 'error');
    }
}

function revelarConteudo(loadingDiv, contentDiv) {
    loadingDiv?.classList.add('d-none');
    if (contentDiv) contentDiv.style.display = 'block';
}

async function aposEnviarSolicitacao() {
    await preencherDadosUsuario();
    await carregarMeusProjetos();
}

async function carregarMeusProjetos() {
    const email = getEmailUsuarioLogado();
    if (!email) {
        renderEstadoLista('Não foi possível identificar o usuário.');
        return;
    }

    const { data: projetos, error } = await listarProjetosPorEmail(email);
    if (error) {
        renderEstadoLista('Erro ao carregar histórico.', 'erro');
        return;
    }
    if (!projetos || projetos.length === 0) {
        renderEstadoLista('Você ainda não possui solicitações.');
        return;
    }

    renderListaProjetos(projetos, abrirModalDetalhes);
}