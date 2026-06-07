import { supabaseClient } from '../supabaseClient.js';

// Acesso a dados da tabela 'laboratorio'.

export async function listarLaboratorios() {
    return supabaseClient
        .from('laboratorio')
        .select('*')
        .order('nome_laboratorio');
}

export async function listarLaboratoriosResumo() {
    return supabaseClient
        .from('laboratorio')
        .select('id, nome_laboratorio');
}

export async function buscarLaboratorioPorId(labId) {
    return supabaseClient
        .from('laboratorio')
        .select('nome_laboratorio, codigo_sipac')
        .eq('id', labId)
        .maybeSingle();
}

export async function buscarIdPorSipac(codigoSipac) {
    return supabaseClient
        .from('laboratorio')
        .select('id')
        .eq('codigo_sipac', codigoSipac)
        .single();
}

export async function buscarNomePorSipac(codigoSipac) {
    return supabaseClient
        .from('laboratorio')
        .select('nome_laboratorio')
        .eq('codigo_sipac', codigoSipac)
        .maybeSingle();
}

export async function criarLaboratorio(dados) {
    return supabaseClient
        .from('laboratorio')
        .insert(dados);
}

export async function excluirLaboratorio(labId) {
    return supabaseClient
        .from('laboratorio')
        .delete()
        .eq('id', labId);
}
