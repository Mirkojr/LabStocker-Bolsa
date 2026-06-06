import { checkIsAdmin } from './sessionManager.js';
import { supabaseClient } from './supabaseClient.js';
import { showToast } from './utils/toast.js';
import { formatarCPF, formatarTelefone } from './utils/formatters.js';
import { buscarPerfilPorId, buscarPerfilPorIdentificador } from './services/perfisService.js';

// ==========================================
// FUNÇÕES UTILITÁRIAS DE FORMATAÇÃO E UI
// ==========================================
function formatarUnidade(unidade) {
    if (!unidade) return "";
    const u = unidade.toLowerCase().trim();
    if (u === 'ml') return 'mL';
    if (u === 'l') return 'L';
    return unidade;
}

// ==========================================
// LÓGICA DE CARREGAMENTO INICIAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const loadingDiv = document.getElementById('auth-loading');
    const contentDiv = document.getElementById('main-content');

    try {
        const isAdmin = await checkIsAdmin();

        if (isAdmin) {
            window.location.replace('admin-autorizacoes.html');
            return;
        }

        // Remove tela de loading e mostra o conteúdo
        if (loadingDiv) loadingDiv.classList.add('d-none');
        if (contentDiv) contentDiv.style.display = 'block';

        await preencherDadosUsuario(); 
        carregarMeusProjetos();
        iniciarLogicaFormulario();

    } catch (error) {
        console.error("Erro ao verificar permissões:", error);
        showToast("Erro na verificação de acesso.", "error");
    }
});

/**
 * Busca dados do perfil logado e pré-preenche o formulário
 */
async function preencherDadosUsuario() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const campoEmail = document.getElementById('responsavel-email');
    campoEmail.value = user.email;
    bloquearCampo(campoEmail);

    const { data: perfil, error } = await buscarPerfilPorId(user.id);

    if (error) { console.error(error); return; }

    if (perfil) {
        const nomeCompleto = `${perfil.nome} ${perfil.sobrenome}`.trim();
        const campoNome = document.getElementById('responsavel-nome');
        const campoSiape = document.getElementById('responsavel-siape');

        campoNome.value = nomeCompleto;
        campoSiape.value = perfil.identificador || '';
        
        bloquearCampo(campoNome);
        bloquearCampo(campoSiape);

        if (perfil.id_laboratorio) {
            const { data: lab, error: erroLab } = await supabaseClient
                .from('laboratorio') 
                .select('nome_laboratorio, codigo_sipac')
                .eq('id', perfil.id_laboratorio)
                .maybeSingle();

            if (!erroLab && lab) {
                const campoLabNome = document.getElementById('lab-nome');
                const campoLabSipac = document.getElementById('lab-sipac');
                campoLabNome.value = lab.nome_laboratorio;
                campoLabSipac.value = lab.codigo_sipac;
                bloquearCampo(campoLabNome);
                bloquearCampo(campoLabSipac);
            }
        }
    }
}

function bloquearCampo(elemento) {
    if (!elemento) return;
    elemento.setAttribute('readonly', true);
    elemento.style.backgroundColor = "rgba(255, 255, 255, 0.05)"; 
    elemento.style.cursor = "not-allowed";
    elemento.classList.add('opacity-75');
}

// ==========================================
// GESTÃO DO HISTÓRICO DE PROJETOS
// ==========================================
async function carregarMeusProjetos() {
    const listaDiv = document.getElementById('lista-meus-projetos');
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        listaDiv.innerHTML = '<div class="p-3 text-warning">Usuário não identificado.</div>';
        return;
    }

    const { data, error } = await supabaseClient
        .from('projetos')
        .select('*')
        .eq('responsavel_email', user.email) 
        .order('created_at', { ascending: false });

    listaDiv.innerHTML = '';

    if (error) {
        console.error(error);
        listaDiv.innerHTML = '<div class="p-3 text-danger small">Erro ao carregar histórico.</div>';
        return;
    }

    if (!data || data.length === 0) {
        listaDiv.innerHTML = '<div class="text-center py-3 text-muted-light small">Você ainda não possui solicitações.</div>';
        return;
    }

    data.forEach(proj => {
        const item = document.createElement('button');
        item.className = 'list-group-item bg-transparent border-white border-opacity-10 d-flex justify-content-between align-items-center text-decoration-none py-3';
        item.type = 'button'; 
        
        let badgeClass = proj.status === 'aprovado' ? 'bg-success' : 'bg-warning text-dark';
        let statusTexto = proj.status === 'aprovado' ? 'Aprovado' : 'Pendente';
        let dataCriacao = new Date(proj.created_at).toLocaleDateString('pt-BR');

        item.innerHTML = `
            <div class="text-start">
                <div class="fw-bold text-white">${proj.titulo_projeto}</div>
                <small class="text-muted-light">Enviado em: ${dataCriacao}</small>
            </div>
            <span class="badge ${badgeClass} rounded-pill">${statusTexto}</span>
        `;

        item.addEventListener('click', () => abrirModalDetalhes(proj));
        listaDiv.appendChild(item);
    });
}

// ==========================================
// MODAL DE DETALHES
// ==========================================
function abrirModalDetalhes(proj) {
    document.getElementById('modal-proj-titulo').textContent = proj.titulo_projeto;
    document.getElementById('modal-resp-nome').textContent = proj.responsavel_nome;
    document.getElementById('modal-resp-email').textContent = proj.responsavel_email;
    document.getElementById('modal-resp-telefone').textContent = formatarTelefone(proj.responsavel_telefone);
    document.getElementById('modal-lab-nome').textContent = proj.lab_nome;

    const listaProd = document.getElementById('modal-lista-produtos');
    listaProd.innerHTML = '';
    
    if (proj.produtos) {
        proj.produtos.forEach((prod, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent border-0 py-1';
            li.innerHTML = `
                <span class="text-dark"><strong>${index + 1}.</strong> ${prod.nome}</span>
                <span class="badge bg-secondary rounded-pill">${prod.quantidade} ${formatarUnidade(prod.unidade)}</span>
            `;
            listaProd.appendChild(li);
        });
    }

    // Lógica do PDF Assinado
    const footer = document.querySelector('#modalDetalhes .modal-footer');
    const existingDownloadBtn = document.getElementById('modal-btn-download');
    if (existingDownloadBtn) existingDownloadBtn.remove();

    if (proj.status === 'aprovado' && proj.pdf_assinado_url) {
        const btnDownload = document.createElement('a');
        btnDownload.id = 'modal-btn-download';
        btnDownload.className = 'btn btn-success rounded-pill px-4 me-auto';
        
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('documentos-projetos')
            .getPublicUrl(proj.pdf_assinado_url);
            
        btnDownload.href = publicUrlData.publicUrl;
        btnDownload.target = "_blank";
        btnDownload.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Baixar Ofício Assinado';
        footer.insertBefore(btnDownload, footer.firstChild);
    }

    const modalEl = document.getElementById('modalDetalhes');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// ==========================================
// LÓGICA DO FORMULÁRIO E BUSCAS DINÂMICAS
// ==========================================
function iniciarLogicaFormulario() {
    const btnAdd = document.getElementById('btn-adicionar-item');
    const tbody = document.getElementById('corpo-tabela-produtos');
    const form = document.getElementById('form-autorizacao');
    
    const labSipacInput = document.getElementById('lab-sipac');
    const labNomeInput = document.getElementById('lab-nome');
    const siapeInput = document.getElementById('responsavel-siape');
    const nomeRespInput = document.getElementById('responsavel-nome');

    function atualizarNumeracao() {
        const linhas = tbody.querySelectorAll('tr');
        linhas.forEach((linha, index) => {
            linha.cells[0].textContent = index + 1;
            const btnRemove = linha.querySelector('.btn-remover-item');
            if (btnRemove) {
                if (linhas.length > 1) btnRemove.classList.remove('d-none');
                else btnRemove.classList.add('d-none');
            }
        });
    }

    // --- ADICIONAR ITEM ---
    btnAdd.addEventListener('click', function() {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-muted-light small fw-bold"></td>
            <td><input type="text" class="form-control form-control-dark product-name" placeholder="Nome do reagente" required></td>
            <td><input type="number" step="0.01" class="form-control form-control-dark product-qty" placeholder="0.00" required></td>
            <td>
                <select class="form-select form-control-dark product-unit">
                    <option value="L">L</option><option value="mL">mL</option>
                    <option value="kg">kg</option><option value="g">g</option>
                    <option value="un">un</option><option value="frasco">frasco</option>
                </select>
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-link text-danger p-0 btn-remover-item">
                    <i class="bi bi-trash-fill fs-5"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        atualizarNumeracao();
    });

    // --- REMOVER ITEM ---
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remover-item');
        if (btn && tbody.rows.length > 1) {
            btn.closest('tr').remove();
            atualizarNumeracao();
        }
    });

    // --- BUSCA DINÂMICA: SIPAC -> Nome do Laboratório ---
    labSipacInput.addEventListener('input', async (e) => {
        if (labSipacInput.hasAttribute('readonly')) return;
        const sipac = e.target.value.trim();
        labNomeInput.value = ''; 
        if (sipac.length < 4) return;
        
        const { data: lab, error } = await supabaseClient
            .from('laboratorio')
            .select('nome_laboratorio')
            .eq('codigo_sipac', sipac)
            .maybeSingle();
        
        if (!error && lab) labNomeInput.value = lab.nome_laboratorio;
    });

    // --- BUSCA DINÂMICA: SIAPE -> Nome do Responsável ---
    siapeInput.addEventListener('input', async (e) => {
        if (siapeInput.hasAttribute('readonly')) return;
        const siape = e.target.value.trim();
        if (siape.length < 3) return;

        const { data: perfil, error } = await buscarPerfilPorIdentificador(siape);

        if (!error && perfil) {
            nomeRespInput.value = `${perfil.nome} ${perfil.sobrenome}`;
        }
    });

    // --- SUBMIT DO FORMULÁRIO COM VALIDAÇÕES ORIGINAIS ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-enviar-solicitacao');
        const originalText = btnSubmit.innerHTML;
        
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> VALIDANDO DADOS...';

        const resetBotao = () => { btnSubmit.disabled = false; btnSubmit.innerHTML = originalText; };

        try {
            const sipacDigitado = labSipacInput.value.trim();
            const nomeLabDigitado = labNomeInput.value.trim();
            const siapeDigitado = siapeInput.value.trim();
            const nomeRespDigitado = nomeRespInput.value.trim();

            // 1. Validação Laboratório
            const { data: labEncontrado, error: erroLab } = await supabaseClient.from('laboratorio').select('nome_laboratorio').eq('codigo_sipac', sipacDigitado).maybeSingle();
            if (erroLab) throw erroLab;
            if (!labEncontrado) { showToast("Código SIPAC não encontrado.", "error"); resetBotao(); return; }
            if (labEncontrado.nome_laboratorio.trim().toLowerCase() !== nomeLabDigitado.toLowerCase()) { showToast("Nome do laboratório não confere com o SIPAC.", "error"); resetBotao(); return; }

            // 2. Validação SIAPE
            const { data: perfilEncontrado, error: erroPerfil } = await buscarPerfilPorIdentificador(siapeDigitado);
            if (erroPerfil) throw erroPerfil;
            if (!perfilEncontrado) { showToast("SIAPE não encontrado na base de usuários.", "error"); resetBotao(); return; }
            
            const nomeBanco = `${perfilEncontrado.nome} ${perfilEncontrado.sobrenome}`.trim().toLowerCase();
            if (nomeBanco !== nomeRespDigitado.trim().toLowerCase()) { showToast("Nome do responsável não confere com o SIAPE.", "error"); resetBotao(); return; }

            // 3. Montagem da Lista de Produtos
            const listaProdutos = Array.from(tbody.rows).map(row => ({
                nome: row.querySelector('.product-name').value,
                quantidade: row.querySelector('.product-qty').value,
                unidade: row.querySelector('.product-unit').value
            }));

            // 4. Envio do Payload Completo
            const payload = {
                responsavel_nome: nomeRespDigitado,
                responsavel_siape: siapeDigitado,
                responsavel_cpf: document.getElementById('responsavel-cpf').value,
                responsavel_email: document.getElementById('responsavel-email').value,
                responsavel_telefone: document.getElementById('responsavel-telefone').value,
                titulo_projeto: document.getElementById('projeto-titulo').value,
                orgao_financiador: document.getElementById('projeto-orgao').value,
                registro_numero: document.getElementById('projeto-registro').value,
                periodo_execucao: document.getElementById('projeto-periodo').value,
                lab_nome: nomeLabDigitado,
                lab_sipac: sipacDigitado,
                produtos: listaProdutos,
                status: 'pendente'
            };

            const { error } = await supabaseClient.from('projetos').insert([payload]);
            if (error) throw error;

            showToast("Solicitação enviada com sucesso!", "success");
            form.reset();
            tbody.innerHTML = '';
            // Reinicia a página para estado inicial limpo mas com dados do usuário
            location.reload(); 

        } catch (err) {
            console.error(err);
            showToast("Erro ao processar: " + err.message, "error");
            resetBotao();
        }
    });

    // Inicia com 1 linha
    if (tbody.rows.length === 0) btnAdd.click();
}