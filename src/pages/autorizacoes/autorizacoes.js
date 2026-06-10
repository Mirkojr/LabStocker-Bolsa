import { checkIsAdmin } from '../../shared/sessionManager.js';
import { showToast } from '../../shared/utils/toast.js';
import { formatarCPF, formatarTelefone } from '../../shared/utils/formatters.js';
import { validarCPF, validarTelefone } from '../../shared/utils/validators.js';
import { buscarPerfilPorId } from '../../shared/services/perfisService.js';
import { getUsuarioLogado } from '../../shared/services/authService.js';
import { buscarLaboratorioPorId, buscarNomePorSipac } from '../../shared/services/laboratoriosService.js';
import { listarProjetosPorEmail, criarProjeto, gerarSignedUrl } from '../../shared/services/projetosService.js';

let emailUsuarioLogado = null;

document.addEventListener('DOMContentLoaded', () => {
    const cpfInput = document.getElementById('responsavel-cpf');
    const telefoneInput = document.getElementById('responsavel-telefone');
    const siapeInput = document.getElementById('responsavel-siape');
    const periodoInput = document.getElementById('projeto-periodo');

    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });
    }

    if (telefoneInput) {
        telefoneInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, ""); 
            
            v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); 
            
            // Se tiver até 10 dígitos, formata como fixo: (XX) XXXX-XXXX
            // Se passar para 11 dígitos, formata como celular: (XX) XXXXX-XXXX
            if (v.length > 14) { 
                v = v.replace(/(\d{5})(\d{4})$/, "$1-$2");
            } else {
                v = v.replace(/(\d{4})(\d{4})$/, "$1-$2");
            }
            
            e.target.value = v;
        });
    };

    if (siapeInput) {
        siapeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, "").substring(0, 7);
        });
    }

    if (periodoInput) {
        periodoInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, ""); 
            
            if (v.length > 4) {
                v = v.replace(/^(\d{4})(\d)/, "$1-$2");
            }
            
            e.target.value = v.substring(0, 9); // Trava em 9 caracteres
        });
    }
});



document.addEventListener('DOMContentLoaded', async () => {
    const loadingDiv = document.getElementById('auth-loading');
    const contentDiv = document.getElementById('main-content');

    try {
        const isAdmin = await checkIsAdmin();
        if (isAdmin) {
            window.location.replace('../admin/admin-autorizacoes.html');
            return;
        }

        // Esconde a tela de carregamento e revela o conteúdo
        if (loadingDiv) loadingDiv.classList.add('d-none');
        if (contentDiv) contentDiv.style.display = 'block';

        await preencherDadosUsuario();
        await carregarMeusProjetos();
        iniciarLogicaFormulario();
        adicionarLinhaProduto();
    } catch (e) {
        console.error('Erro ao inicializar a página de autorizações:', e);
        // Garante que a tela nunca fique presa no carregamento
        if (loadingDiv) loadingDiv.classList.add('d-none');
        if (contentDiv) contentDiv.style.display = 'block';
        showToast('Erro ao carregar a página de autorizações.', 'error');
    }
});

async function preencherDadosUsuario() {
    try {
        const { data: { user } } = await getUsuarioLogado();
        if (!user) return;

        emailUsuarioLogado = user.email;
        const { data: perfil } = await buscarPerfilPorId(user.id);

        const emailInput = document.getElementById('responsavel-email');
        emailInput.value = user.email;
        bloquearCampo(emailInput);

        if (perfil) {
            const nomeInput = document.getElementById('responsavel-nome');
            nomeInput.value = `${perfil.nome} ${perfil.sobrenome || ''}`.trim();
            bloquearCampo(nomeInput);

            if (perfil.tipo_identificador === 'siape') {
                const siapeInput = document.getElementById('responsavel-siape');
                siapeInput.value = perfil.identificador;
                bloquearCampo(siapeInput);
            }

            if (perfil.id_laboratorio) {
                const { data: lab } = await buscarLaboratorioPorId(perfil.id_laboratorio);
                if (lab) {
                    const labNomeInput = document.getElementById('lab-nome');
                    const labSipacInput = document.getElementById('lab-sipac');
                    labNomeInput.value = lab.nome_laboratorio;
                    labSipacInput.value = lab.codigo_sipac;
                    bloquearCampo(labNomeInput);
                    bloquearCampo(labSipacInput);
                }
            }
        }
    } catch (e) {
        console.error('Erro ao preencher dados do usuário:', e);
    }
}

function bloquearCampo(input) {
    if (!input) return;
    input.readOnly = true;
    input.classList.add('bg-dark', 'bg-opacity-50');
    input.style.cursor = 'not-allowed';
}

async function carregarMeusProjetos() {
    const container = document.getElementById('lista-meus-projetos');
    if (!emailUsuarioLogado) {
        container.innerHTML = '<div class="text-center py-3 text-muted-light small">Não foi possível identificar o usuário.</div>';
        return;
    }

    const { data: projetos, error } = await listarProjetosPorEmail(emailUsuarioLogado);

    if (error) {
        container.innerHTML = '<div class="text-center py-3 text-danger small">Erro ao carregar histórico.</div>';
        return;
    }

    if (!projetos || projetos.length === 0) {
        container.innerHTML = '<div class="text-center py-3 text-muted-light small">Você ainda não possui solicitações.</div>';
        return;
    }

    container.innerHTML = '';
    projetos.forEach(proj => {
        let badgeClass, statusTexto;
        if (proj.status === 'aprovado') {
            badgeClass = 'bg-success';
            statusTexto = 'Aprovado';
        } else if (proj.status === 'recusado') {
            badgeClass = 'bg-danger';
            statusTexto = 'Recusado';
        } else {
            badgeClass = 'bg-warning text-dark';
            statusTexto = 'Pendente';
        }

        const dataCriacao = new Date(proj.created_at).toLocaleDateString('pt-BR');

        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'list-group-item list-group-item-action bg-transparent text-white d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div class="text-start">
                <div class="fw-semibold">${proj.titulo_projeto || 'Sem título'}</div>
                <small class="text-muted-light">Enviado em ${dataCriacao}</small>
            </div>
            <span class="badge ${badgeClass} rounded-pill">${statusTexto}</span>
        `;
        item.addEventListener('click', () => abrirModalDetalhes(proj));
        container.appendChild(item);
    });
}

async function abrirModalDetalhes(proj) {
    document.getElementById('modal-proj-titulo').textContent = proj.titulo_projeto || '-';
    document.getElementById('modal-resp-nome').textContent = proj.responsavel_nome || '-';
    document.getElementById('modal-resp-email').textContent = proj.responsavel_email || '-';
    document.getElementById('modal-resp-telefone').textContent = formatarTelefone(proj.responsavel_telefone);
    document.getElementById('modal-lab-nome').textContent = proj.lab_nome || '-';

    const listaProdutos = document.getElementById('modal-lista-produtos');
    listaProdutos.innerHTML = '';
    (proj.produtos || []).forEach(p => {
        const li = document.createElement('li');
        li.className = 'list-group-item bg-transparent d-flex justify-content-between';
        li.innerHTML = `<span>${p.nome}</span><span class="text-muted">${p.quantidade} ${p.unidade || ''}</span>`;
        listaProdutos.appendChild(li);
    });

    // Limpa elementos dinâmicos de aberturas anteriores
    const footer = document.querySelector('#modalDetalhes .modal-footer');
    document.getElementById('modal-btn-download')?.remove();
    document.getElementById('modal-motivo-recusa')?.remove();

    if (proj.status === 'aprovado' && proj.pdf_assinado_url) {
        const btnDownload = document.createElement('a');
        btnDownload.id = 'modal-btn-download';
        btnDownload.className = 'btn btn-success rounded-pill px-4 me-auto';
        btnDownload.target = '_blank';
        btnDownload.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Baixar Ofício Assinado';
        const { data: signed } = await gerarSignedUrl(proj.pdf_assinado_url);
        btnDownload.href = signed?.signedUrl || '#';
        footer.insertBefore(btnDownload, footer.firstChild);
    }

    if (proj.status === 'recusado' && proj.motivo_recusa) {
        const aviso = document.createElement('div');
        aviso.id = 'modal-motivo-recusa';
        aviso.className = 'alert alert-danger mt-3 mb-0 small';
        aviso.innerHTML = `<strong>Solicitação recusada.</strong> Motivo: ${proj.motivo_recusa}`;
        document.querySelector('#modalDetalhes .modal-body').appendChild(aviso);
    }

    const modal = new bootstrap.Modal(document.getElementById('modalDetalhes'));
    modal.show();
}

function iniciarLogicaFormulario() {
    const form = document.getElementById('form-autorizacao');
    const tbody = document.getElementById('corpo-tabela-produtos');
    const btnAdicionar = document.getElementById('btn-adicionar-item');
    const btnEnviar = document.getElementById('btn-enviar-solicitacao');

    btnAdicionar.addEventListener('click', adicionarLinhaProduto);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textoOriginal = btnEnviar.innerHTML;
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = 'Enviando...';
        const resetBotao = () => { btnEnviar.disabled = false; btnEnviar.innerHTML = textoOriginal; };

        try {
            const labSipacInput = document.getElementById('lab-sipac');
            const labNomeInput = document.getElementById('lab-nome');
            const siapeInput = document.getElementById('responsavel-siape');
            const nomeRespInput = document.getElementById('responsavel-nome');

            const sipacDigitado = labSipacInput.value.trim();
            const nomeLabDigitado = labNomeInput.value.trim();
            const siapeDigitado = siapeInput.value.trim();
            const nomeRespDigitado = nomeRespInput.value.trim();

            const cpfDigitado = document.getElementById('responsavel-cpf').value;
            const telefoneDigitado = document.getElementById('responsavel-telefone').value;
            const tituloProjeto = document.getElementById('projeto-titulo').value.trim();

            // 0. Validações de formato
            if (!tituloProjeto) { showToast('Informe o título do projeto.', 'error'); resetBotao(); return; }
            if (!validarCPF(cpfDigitado)) { showToast('CPF inválido. Confira o número digitado.', 'error'); resetBotao(); return; }
            if (!validarTelefone(telefoneDigitado)) { showToast('Telefone inválido. Use DDD + número.', 'error'); resetBotao(); return; }

            // 1. Validação do Laboratório pelo SIPAC
            if (sipacDigitado) {
                const { data: nomeOficial } = await buscarNomePorSipac(sipacDigitado);
                if (!nomeOficial) {
                    showToast('Código SIPAC não encontrado no sistema.', 'error');
                    resetBotao();
                    return;
                }
            }

            // 2. Montagem e validação da lista de produtos
            const listaProdutos = Array.from(tbody.rows)
                .map(row => ({
                    nome: row.querySelector('.product-name').value.trim(),
                    quantidade: parseFloat(row.querySelector('.product-qty').value),
                    unidade: row.querySelector('.product-unit').value
                }))
                .filter(p => p.nome !== '');

            if (listaProdutos.length === 0) {
                showToast('Adicione ao menos um reagente/material.', 'error');
                resetBotao();
                return;
            }
            if (listaProdutos.some(p => !(p.quantidade > 0))) {
                showToast('A quantidade de cada item deve ser maior que zero.', 'error');
                resetBotao();
                return;
            }

            // 3. Envio do payload
            const payload = {
                responsavel_nome: nomeRespDigitado,
                responsavel_siape: siapeDigitado,
                responsavel_cpf: cpfDigitado,
                responsavel_email: document.getElementById('responsavel-email').value,
                responsavel_telefone: telefoneDigitado,
                titulo_projeto: tituloProjeto,
                orgao_financiador: document.getElementById('projeto-orgao').value,
                registro_numero: document.getElementById('projeto-registro').value,
                periodo_execucao: document.getElementById('projeto-periodo').value,
                lab_nome: nomeLabDigitado,
                lab_sipac: sipacDigitado,
                produtos: listaProdutos,
                status: 'pendente'
            };

            const { error } = await criarProjeto(payload);
            if (error) throw error;

            showToast('Solicitação enviada para análise com sucesso!', 'success');
            form.reset();
            tbody.innerHTML = '';
            adicionarLinhaProduto();
            await preencherDadosUsuario();
            await carregarMeusProjetos();
        } catch (err) {
            console.error('Erro ao enviar solicitação:', err);
            showToast('Erro ao enviar solicitação: ' + (err.message || 'tente novamente.'), 'error');
        } finally {
            resetBotao();
        }
    });
}

function adicionarLinhaProduto() {
    const tbody = document.getElementById('corpo-tabela-produtos');
    const index = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="text-muted-light">${index}</td>
        <td><input type="text" class="form-control form-control-dark form-control-sm product-name" placeholder="Nome do reagente/material"></td>
        <td><input type="number" min="0" step="any" class="form-control form-control-dark form-control-sm product-qty" placeholder="0"></td>
        <td>
            <select class="form-select form-select-sm product-unit">
                <option value="un">un</option>
                <option value="mL">mL</option>
                <option value="L">L</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="mg">mg</option>
            </select>
        </td>
        <td>
            <button type="button" class="btn btn-outline-danger btn-sm btn-remover-item">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    tr.querySelector('.btn-remover-item').addEventListener('click', () => {
        tr.remove();
        renumerarLinhas();
    });
    tbody.appendChild(tr);
}

function renumerarLinhas() {
    const tbody = document.getElementById('corpo-tabela-produtos');
    Array.from(tbody.rows).forEach((row, i) => {
        row.cells[0].textContent = i + 1;
    });
}
