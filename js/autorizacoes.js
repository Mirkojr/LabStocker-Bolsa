import { checkIsAdmin } from './labContext.js';
import { supabaseClient } from './supabaseClient.js';

// ==========================================
// FUNÇÕES UTILITÁRIAS DE FORMATAÇÃO
// ==========================================
function formatarCPF(cpf) {
    if (!cpf) return "-";
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarTelefone(telefone) {
    if (!telefone) return "-";
    const limpo = telefone.replace(/\D/g, '');
    if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
    if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return telefone;
}

function formatarUnidade(unidade) {
    if (!unidade) return "";
    const u = unidade.toLowerCase().trim();
    if (u === 'ml') return 'mL';
    if (u === 'l') return 'L';
    return unidade;
}

// ==========================================
// LÓGICA PRINCIPAL
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

        if (loadingDiv) loadingDiv.classList.add('d-none');
        if (contentDiv) contentDiv.style.display = 'block';

        await preencherDadosUsuario(); 
        carregarMeusProjetos();
        iniciarLogicaFormulario();

    } catch (error) {
        console.error("Erro ao verificar permissões:", error);
    }
});

/**
 * Busca dados do perfil logado e pré-preenche.
 */
async function preencherDadosUsuario() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const campoEmail = document.getElementById('responsavel-email');
    campoEmail.value = user.email;
    bloquearCampo(campoEmail);

    const { data: perfil, error } = await supabaseClient
        .from('Perfis') 
        .select('nome, sobrenome, identificador, id_laboratorio')
        .eq('email', user.email)
        .maybeSingle();

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
                .from('Laboratorio') 
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
    elemento.style.backgroundColor = "#e9ecef"; 
    elemento.style.cursor = "not-allowed";
}

// ==========================================
// CARREGAR HISTÓRICO
// ==========================================
async function carregarMeusProjetos() {
    const listaDiv = document.getElementById('lista-meus-projetos');
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        listaDiv.innerHTML = '<div class="alert alert-warning">Usuário não identificado.</div>';
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
        listaDiv.innerHTML = '<div class="alert alert-danger small">Erro ao carregar histórico.</div>';
        return;
    }

    if (!data || data.length === 0) {
        listaDiv.innerHTML = '<div class="text-center py-3 text-muted border rounded bg-white">Você ainda não possui solicitações.</div>';
        return;
    }

    data.forEach(proj => {
        const item = document.createElement('button');
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        item.type = 'button'; 
        
        let badgeClass = proj.status === 'aprovado' ? 'bg-success' : 'bg-warning text-dark';
        let statusTexto = proj.status === 'aprovado' ? 'Aprovado' : 'Pendente';
        let dataCriacao = new Date(proj.created_at).toLocaleDateString('pt-BR');

        item.innerHTML = `
            <div class="text-start">
                <div class="fw-bold text-primary">${proj.titulo_projeto}</div>
                <small class="text-muted">Enviado em: ${dataCriacao}</small>
            </div>
            <span class="badge ${badgeClass} rounded-pill">${statusTexto}</span>
        `;

        item.addEventListener('click', () => abrirModalDetalhes(proj));
        listaDiv.appendChild(item);
    });
}

// ==========================================
// ABRIR MODAL
// ==========================================
function abrirModalDetalhes(proj) {
    document.getElementById('modal-projeto-titulo').textContent = proj.titulo_projeto;
    document.getElementById('modal-resp-nome').textContent = proj.responsavel_nome;
    document.getElementById('modal-resp-cpf').textContent = formatarCPF(proj.responsavel_cpf);
    document.getElementById('modal-resp-email').textContent = proj.responsavel_email;
    document.getElementById('modal-resp-telefone').textContent = formatarTelefone(proj.responsavel_telefone);
    document.getElementById('modal-lab-nome').textContent = proj.lab_nome;

    const statusText = document.getElementById('modal-status-text');
    const statusArea = document.getElementById('modal-status-area');
    const btnDownload = document.getElementById('modal-btn-download');

    if (proj.status === 'aprovado') {
        statusArea.className = 'alert alert-success d-flex justify-content-between align-items-center mb-3';
        statusText.innerHTML = '<i class="bi bi-check-circle-fill"></i> Aprovado';
        
        if (proj.pdf_assinado_url) {
            btnDownload.classList.remove('d-none');
            const { data: publicUrlData } = supabaseClient
                .storage
                .from('documentos-projetos')
                .getPublicUrl(proj.pdf_assinado_url);
            btnDownload.href = publicUrlData.publicUrl;
            btnDownload.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Baixar Ofício Assinado';
        } else {
            btnDownload.classList.add('d-none');
        }
    } else {
        statusArea.className = 'alert alert-warning d-flex justify-content-between align-items-center mb-3';
        statusText.innerHTML = '<i class="bi bi-hourglass-split"></i> Aguardando Aprovação';
        btnDownload.classList.add('d-none');
    }

    const listaProd = document.getElementById('modal-lista-produtos');
    listaProd.innerHTML = '';
    if (proj.produtos) {
        proj.produtos.forEach((prod, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent';
            li.innerHTML = `<span><strong>${index+1}.</strong> ${prod.nome}</span><span class="badge bg-secondary rounded-pill">${prod.quantidade} ${formatarUnidade(prod.unidade)}</span>`;
            listaProd.appendChild(li);
        });
    }

    const modalEl = document.getElementById('modalDetalhes');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// ==========================================
// LÓGICA DO FORMULÁRIO E BUSCAS DINÂMICAS
// ==========================================
function iniciarLogicaFormulario() {
    const btnAdd = document.getElementById('btn-add-produto');
    const tbody = document.getElementById('lista-produtos-body');
    const form = document.getElementById('form-projeto');
    
    // Campos para lógica dinâmica
    const labSipacInput = document.getElementById('lab-sipac');
    const labNomeInput = document.getElementById('lab-nome');
    const siapeInput = document.getElementById('responsavel-siape');
    const nomeRespInput = document.getElementById('responsavel-nome');

    function atualizarNumeracao() {
        const linhas = tbody.querySelectorAll('tr');
        linhas.forEach((linha, index) => {
            linha.querySelector('.index-item').textContent = index + 1;
            const btnRemove = linha.querySelector('.btn-remove-item');
            if (btnRemove) {
                if (linhas.length > 1) btnRemove.removeAttribute('disabled');
                else btnRemove.setAttribute('disabled', 'true');
            }
        });
    }

    if (btnAdd) {
        btnAdd.addEventListener('click', function() {
            const novaLinha = document.createElement('tr');
            novaLinha.innerHTML = `
                <td class="text-center index-item"></td>
                <td><input type="text" class="form-control" name="produto_nome[]" required></td>
                <td><input type="number" class="form-control" name="produto_qtd[]" required></td>
                <td>
                    <select class="form-select" name="produto_unidade[]">
                        <option value="un">Unidade (un)</option>
                        <option value="mL">Mililitros (mL)</option>
                        <option value="L">Litros (L)</option>
                        <option value="g">Gramas (g)</option>
                        <option value="kg">Quilogramas (kg)</option>
                        <option value="caixa">Caixa</option>
                    </select>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-outline-danger btn-sm btn-remove-item">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(novaLinha);
            atualizarNumeracao();
        });
    }

    if (tbody) {
        tbody.addEventListener('click', function(e) {
            const btn = e.target.closest('.btn-remove-item');
            if (btn && !btn.hasAttribute('disabled')) {
                btn.closest('tr').remove();
                atualizarNumeracao();
            }
        });
    }

    atualizarNumeracao();

    // --- BUSCA DINÂMICA 1: SIPAC -> Nome do Laboratório ---
    if (labSipacInput) {
        labSipacInput.addEventListener('input', async (e) => {
            if (labSipacInput.hasAttribute('readonly')) return;
            const sipac = e.target.value.trim();
            labNomeInput.value = ''; // Limpa enquanto digita
            if (sipac.length < 4) return;
            
            const { data: lab, error } = await supabaseClient
                .from('Laboratorio') // Verifique se é 'laboratorios' ou 'Laboratorio'
                .select('nome_laboratorio')
                .eq('codigo_sipac', sipac)
                .maybeSingle();
            
            if (!error && lab) labNomeInput.value = lab.nome_laboratorio;
        });
    }

    // --- BUSCA DINÂMICA 2: SIAPE -> Nome do Responsável (NOVO) ---
    if (siapeInput) {
        siapeInput.addEventListener('input', async (e) => {
            // Se o campo estiver bloqueado (veio do perfil do usuario logado), não altera
            if (siapeInput.hasAttribute('readonly')) return;

            const siape = e.target.value.trim();
            // nomeRespInput.value = ''; // Opcional: limpar enquanto digita. Pode ser chato se o usuário estiver digitando o nome primeiro.
            
            // Só busca se tiver pelo menos 3 digitos para evitar queries desnecessárias
            if (siape.length < 3) return;

            const { data: perfil, error } = await supabaseClient
                .from('Perfis') // Verifique se é 'perfis' ou 'Perfis'
                .select('nome, sobrenome')
                .eq('identificador', siape)
                .maybeSingle();

            if (!error && perfil) {
                // Se encontrou, preenche o nome automaticamente
                nomeRespInput.value = `${perfil.nome} ${perfil.sobrenome}`;
            }
        });
    }

    // --- SUBMIT DO FORMULÁRIO ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = form.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerHTML;
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Validando...';

            const resetBotao = () => { if (btnSubmit.disabled) { btnSubmit.disabled = false; btnSubmit.innerHTML = originalText; } };

            try {
                const sipacDigitado = labSipacInput.value.trim();
                const nomeLabDigitado = labNomeInput.value.trim();
                const siapeDigitado = siapeInput.value.trim();
                const nomeRespDigitado = nomeRespInput.value.trim();

                // Validações Básicas
                if (!nomeLabDigitado || !sipacDigitado || !siapeDigitado || !nomeRespDigitado) { 
                    alert("Preencha todos os campos obrigatórios."); resetBotao(); return; 
                }

                // 2. Validação LABORATÓRIO
                const { data: labEncontrado, error: erroLab } = await supabaseClient.from('Laboratorio').select('id, nome_laboratorio').eq('codigo_sipac', sipacDigitado).maybeSingle();
                if (erroLab) throw new Error(erroLab.message);
                if (!labEncontrado) { alert("Código SIPAC não encontrado."); resetBotao(); return; }
                if (labEncontrado.nome_laboratorio.trim().toLowerCase() !== nomeLabDigitado.toLowerCase()) { alert("Nome do laboratório não bate com o SIPAC."); resetBotao(); return; }

                // 3. Validação REQUERENTE (SIAPE/Matrícula)
                // Nota: Usamos 'Perfis' com P maiúsculo aqui para seguir o padrão que você mostrou antes,
                // mas certifique-se se é 'perfis' ou 'Perfis'. O JS é case-sensitive para strings, mas o Supabase costuma aceitar lowercase.
                const { data: perfilEncontrado, error: erroPerfil } = await supabaseClient.from('Perfis').select('nome, sobrenome').eq('identificador', siapeDigitado).maybeSingle();
                
                if (erroPerfil) throw new Error(erroPerfil.message);
                if (!perfilEncontrado) { alert("SIAPE/Matrícula não encontrado na base de usuários."); resetBotao(); return; }
                
                const nomeBanco = `${perfilEncontrado.nome} ${perfilEncontrado.sobrenome}`.trim().toLowerCase().replace(/\s+/g, ' ');
                const nomeDigitado = nomeRespDigitado.trim().toLowerCase().replace(/\s+/g, ' ');
                if (nomeBanco !== nomeDigitado) { alert("Nome do responsável não confere com o SIAPE informado."); resetBotao(); return; }

                // Envio
                btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';
                const formData = new FormData(form);
                const nomes = formData.getAll('produto_nome[]');
                const qtds = formData.getAll('produto_qtd[]');
                const unidades = formData.getAll('produto_unidade[]');
                const listaProdutos = nomes.map((nome, i) => ({ nome: nome, quantidade: qtds[i], unidade: unidades[i] }));

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

                alert("Solicitação enviada com sucesso!");
                form.reset();
                atualizarNumeracao();
                await preencherDadosUsuario(); 
                carregarMeusProjetos();

            } catch (err) {
                console.error(err);
                alert("Erro: " + err.message);
            } finally {
                resetBotao();
            }
        });
    }
}