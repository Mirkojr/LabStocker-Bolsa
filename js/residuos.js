import { supabaseClient } from './supabaseClient.js';
// MUDANÇA: Importando o gerenciador de sessão (para suportar Admin)
import { getCurrentLabId } from './sessionManager.js';

const listaResiduos = document.getElementById('lista-residuos');
const formResiduo = document.getElementById('form-residuo');
const spinner = document.getElementById('spinner-res');
const modalEl = document.getElementById('modal-residuo');
const modalResiduo = new bootstrap.Modal(modalEl);

const editIdInput = document.getElementById('edit-residuo-id');
const descInput = document.getElementById('res-descricao');
const tipoInput = document.getElementById('res-tipo');
const qtdInput = document.getElementById('res-qtd');
const unidadeInput = document.getElementById('res-unidade');
const modalTitle = modalEl.querySelector('.modal-title');
const modalSubmitBtn = formResiduo.querySelector('button[type="submit"]');
const btnNovoResiduo = document.querySelector('[data-bs-target="#modal-residuo"]');

let MEU_LAB_ID = null;

async function init() {
    try {
        // MUDANÇA: Usamos a nova função que suporta o "Modo Admin"
        MEU_LAB_ID = await getCurrentLabId();
        
        if (MEU_LAB_ID) {
            fetchResiduos();
        } else {
            listaResiduos.innerHTML = '<div class="col-12 text-center text-danger">Erro: Laboratório não identificado.</div>';
        }
    } catch (error) {
        console.error(error);
        listaResiduos.innerHTML = '<div class="col-12 text-center text-danger">Erro ao carregar dados.</div>';
    }
}

async function fetchResiduos() {
    spinner.classList.remove('d-none');
    listaResiduos.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('Residuo')
            .select('*')
            .eq('id_laboratorio', MEU_LAB_ID)
            .order('data_criacao', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            listaResiduos.innerHTML = '<div class="col-12 text-center text-muted">Nenhum resíduo registrado.</div>';
        } else {
            renderResiduos(data);
        }

    } catch (error) {
        console.error(error);
        listaResiduos.innerHTML = '<div class="col-12 text-center text-danger">Erro ao buscar resíduos.</div>';
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderResiduos(itens) {
    listaResiduos.innerHTML = '';

    itens.forEach(item => {
        // Configuração visual
        let icone = 'bi-question-circle';
        let corBorda = 'border-secondary';
        let corTexto = 'text-secondary';

        if (item.tipo_perigo === 'Inflamavel') {
            icone = 'bi-fire';
            corBorda = 'border-warning';
            corTexto = 'text-warning';
        } else if (item.tipo_perigo === 'Toxico') {
            icone = 'bi-radioactive';
            corBorda = 'border-success';
            corTexto = 'text-success';
        } else if (item.tipo_perigo === 'Corrosivo') {
            icone = 'bi-droplet-half';
            corBorda = 'border-secondary';
            corTexto = 'text-dark';
        } else if (item.tipo_perigo === 'Biologico') {
            icone = 'bi-virus';
            corBorda = 'border-danger';
            corTexto = 'text-danger';
        }

        // --- LÓGICA DOS BOTÕES ---
        let statusBadge = 'bg-primary';
        let btnAcao = ''; 
        let btnEditar = '';

        if (item.status === 'Em Aberto') {
            // Estado 1: Aberto
            statusBadge = 'bg-primary';
            
            btnEditar = `
                <button class="btn btn-sm btn-outline-secondary btn-editar me-1" 
                    data-id="${item.id}"
                    data-descricao="${item.descricao}"
                    data-tipo="${item.tipo_perigo}"
                    data-qtd="${item.quantidade}"
                    data-unidade="${item.unidade_medida}">
                    <i class="bi bi-pencil"></i>
                </button>
            `;
            
            btnAcao = `<button class="btn btn-sm btn-outline-dark btn-fechar w-100" data-id="${item.id}">Marcar como Cheio</button>`;

        } else if (item.status === 'Cheio') {
            // Estado 2: Cheio
            statusBadge = 'bg-warning text-dark';
            
            btnEditar = `
                <button class="btn btn-sm btn-outline-secondary btn-editar me-1" 
                    data-id="${item.id}"
                    data-descricao="${item.descricao}"
                    data-tipo="${item.tipo_perigo}"
                    data-qtd="${item.quantidade}"
                    data-unidade="${item.unidade_medida}">
                    <i class="bi bi-pencil"></i>
                </button>
            `;

            btnAcao = `
                <div class="d-flex gap-1 w-100">
                    <button class="btn btn-sm btn-outline-secondary btn-reabrir w-50" data-id="${item.id}" title="Voltar para Aberto">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-descartar w-100" data-id="${item.id}">
                        Descartar
                    </button>
                </div>
            `;

        } else if (item.status === 'Descartado') {
            // Estado 3: Finalizado
            statusBadge = 'bg-secondary';
            btnAcao = `<span class="text-muted small d-block text-center w-100">Finalizado</span>`;
        }

        const data = new Date(item.data_criacao).toLocaleDateString('pt-BR');

        const cardHtml = `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 ${corBorda} shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge ${statusBadge}">${item.status}</span>
                            <i class="bi ${icone} ${corTexto}" style="font-size: 1.5rem;"></i>
                        </div>
                        <h5 class="card-title">${item.descricao}</h5>
                        <p class="card-text text-muted small">
                            Tipo: <strong>${item.tipo_perigo}</strong><br>
                            Volume: ${item.quantidade} ${item.unidade_medida}<br>
                            Criado em: ${data}
                        </p>
                        <div class="mt-3 d-flex align-items-center">
                            ${btnEditar}
                            ${btnAcao}
                        </div>
                    </div>
                </div>
            </div>
        `;
        listaResiduos.innerHTML += cardHtml;
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = editIdInput.value;
    const dados = {
        id_laboratorio: MEU_LAB_ID,
        descricao: descInput.value,
        tipo_perigo: tipoInput.value,
        quantidade: qtdInput.value,
        unidade_medida: unidadeInput.value
    };

    if (!id) delete dados.status; // Se novo, deixa o banco usar o default 'Em Aberto'

    try {
        let query;
        if (id) {
            query = supabaseClient.from('Residuo').update(dados).eq('id', id);
        } else {
            query = supabaseClient.from('Residuo').insert(dados);
        }

        const { error } = await query;
        if (error) throw error;

        alert(id ? "Resíduo atualizado!" : "Resíduo registrado!");
        modalResiduo.hide();
        fetchResiduos();

    } catch (error) {
        console.error(error);
        alert("Erro: " + error.message);
    }
}

function handleEditClick(btn) {
    const { id, descricao, tipo, qtd, unidade } = btn.dataset;

    editIdInput.value = id;
    descInput.value = descricao;
    tipoInput.value = tipo;
    qtdInput.value = qtd;
    unidadeInput.value = unidade;

    modalTitle.textContent = 'Editar Resíduo';
    modalSubmitBtn.textContent = 'Salvar Alterações';
    modalResiduo.show();
}

function resetModal() {
    formResiduo.reset();
    editIdInput.value = '';
    modalTitle.textContent = 'Novo Resíduo Químico';
    modalSubmitBtn.textContent = 'Registrar';
}

async function atualizarStatus(id, novoStatus) {
    let msg = `Deseja alterar o status para: ${novoStatus}?`;
    if (novoStatus === 'Em Aberto') msg = "Deseja reabrir este frasco? Ele voltará a ficar disponível para uso.";
    if (novoStatus === 'Descartado') msg = "Confirmar envio para incineração? Isso finalizará o ciclo do resíduo.";

    if (!confirm(msg)) return;

    try {
        const { error } = await supabaseClient
            .from('Residuo')
            .update({ status: novoStatus })
            .eq('id', id);

        if (error) throw error;
        fetchResiduos();

    } catch (error) {
        alert("Erro: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', init);
formResiduo.addEventListener('submit', handleFormSubmit);

// Delegação de Eventos
listaResiduos.addEventListener('click', (e) => {
    // Botão Editar (Lápis)
    const btnEdit = e.target.closest('.btn-editar');
    if (btnEdit) handleEditClick(btnEdit);

    // Botão Desfazer (Seta Circular)
    const btnReabrir = e.target.closest('.btn-reabrir');
    if (btnReabrir) {
        atualizarStatus(btnReabrir.dataset.id, 'Em Aberto');
    }

    // Botões de Ação Direta
    if (e.target.classList.contains('btn-fechar')) {
        atualizarStatus(e.target.dataset.id, 'Cheio');
    }
    if (e.target.classList.contains('btn-descartar')) {
        atualizarStatus(e.target.dataset.id, 'Descartado');
    }
});

if (btnNovoResiduo) {
    btnNovoResiduo.addEventListener('click', resetModal);
}