import { supabaseClient } from '../supabaseClient.js';

// Acesso a dados da tabela 'projetos' e ao bucket de documentos no Storage.

const BUCKET_DOCUMENTOS = 'documentos-projetos';

export async function listarProjetosPorEmail(email) {
    return supabaseClient
        .from('projetos')
        .select('*')
        .eq('responsavel_email', email)
        .order('created_at', { ascending: false });
}

export async function buscarProjetoPorId(id) {
    return supabaseClient
        .from('projetos')
        .select('*')
        .eq('id', id)
        .single();
}

export async function criarProjeto(payload) {
    return supabaseClient.from('projetos').insert([payload]);
}

export async function atualizarProjeto(id, dados) {
    return supabaseClient.from('projetos').update(dados).eq('id', id);
}

export async function enviarDocumento(nomeArquivo, arquivo) {
    return supabaseClient.storage.from(BUCKET_DOCUMENTOS).upload(nomeArquivo, arquivo);
}

export function obterUrlPublica(caminho) {
    return supabaseClient.storage.from(BUCKET_DOCUMENTOS).getPublicUrl(caminho);
}
