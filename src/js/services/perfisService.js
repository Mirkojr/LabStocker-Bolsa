import { supabaseClient } from '../supabaseClient.js';

export async function buscarPerfilPorEmail(email) {
    return supabaseClient
        .from('Perfis')
        .select('nome, sobrenome, identificador, id_laboratorio')
        .eq('email', email)
        .maybeSingle();
}

export async function buscarPerfilPorIdentificador(identificador) {
    return supabaseClient
        .from('Perfis')
        .select('nome, sobrenome')
        .eq('identificador', identificador)
        .maybeSingle();
}

export async function buscarPerfisPorLaboratorio(laboratorioId) {
    return supabaseClient
        .from('Perfis')
        .select('*')
        .eq('id_laboratorio', laboratorioId)
        .order('nome');
}

export async function buscarNomePorId(usuarioId) {
    return supabaseClient
        .from('Perfis')
        .select('nome')
        .eq('id', usuarioId)
        .single();
}

export async function criarPerfilUsuario(dadosPerfil) {
    return supabaseClient.from('Perfis').insert(dadosPerfil);
}
