import { supabaseClient } from '../supabaseClient.js';

// Camada de acesso à tabela 'projetos' (Autorizações) e ao bucket privado de documentos.
// Todas as funções retornam o padrão { data, error } do supabase-js.

const BUCKET_DOCUMENTOS = 'documentos-projetos';

// ===================== LEITURA =====================

// Solicitações de um usuário (pela coluna responsavel_email).
export async function listarProjetosPorEmail(email) {
    return supabaseClient
        .from('projetos')
        .select('*')
        .eq('responsavel_email', email)
        .order('created_at', { ascending: false });
}

// Lista resumida para a tela do admin.
export async function listarTodosProjetos() {
    return supabaseClient
        .from('projetos')
        .select('id, titulo_projeto, responsavel_nome, created_at, status')
        .order('created_at', { ascending: false });
}

// Detalhe completo de uma solicitação.
export async function buscarProjetoPorId(id) {
    return supabaseClient
        .from('projetos')
        .select('*')
        .eq('id', id)
        .single();
}

// ===================== ESCRITA =====================

// Cria uma nova solicitação (status inicial: pendente).
export async function criarProjeto(payload) {
    return supabaseClient
        .from('projetos')
        .insert([payload])
        .select()
        .single();
}

// Atualização genérica de uma solicitação.
export async function atualizarProjeto(id, dados) {
    return supabaseClient
        .from('projetos')
        .update(dados)
        .eq('id', id)
        .select()
        .single();
}

// Passo 1 (admin): salva a minuta gerada + dados administrativos, sem aprovar.
export async function salvarMinuta(id, { documento_url, dadosAdmin }) {
    return atualizarProjeto(id, {
        documento_url,
        cargo_responsavel: dadosAdmin.cargo,
        departamento_responsavel: dadosAdmin.departamento,
        unidade_academica: dadosAdmin.unidade,
        local_atividades: dadosAdmin.local_ativ,
        depto_atividades: dadosAdmin.depto_ativ,
        orgao_controlador: dadosAdmin.orgao
    });
}

// Passo 2 (admin): anexa o PDF assinado e aprova.
export async function aprovarProjeto(id, pdf_assinado_url) {
    return atualizarProjeto(id, {
        status: 'aprovado',
        pdf_assinado_url
    });
}

// Recusa a solicitação com justificativa.
export async function recusarProjeto(id, motivo) {
    return atualizarProjeto(id, {
        status: 'recusado',
        motivo_recusa: motivo
    });
}

// ===================== STORAGE (bucket privado) =====================

// Faz upload de um arquivo para o bucket de documentos.
export async function enviarDocumento(nomeArquivo, arquivo) {
    return supabaseClient.storage.from(BUCKET_DOCUMENTOS).upload(nomeArquivo, arquivo);
}

// Gera uma URL assinada (temporária) para um arquivo do bucket privado.
// expiraEm em segundos (padrão: 1 hora).
export async function gerarSignedUrl(caminho, expiraEm = 3600) {
    return supabaseClient.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(caminho, expiraEm);
}
