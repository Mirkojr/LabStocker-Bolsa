import { supabaseClient } from '../supabaseClient.js';

export async function listarreagentes(filtroNome = '') {
    let query = supabaseClient.from('reagente').select('*').order('nome');

    if (filtroNome) {
        query = query.ilike('nome', `%${filtroNome}%`);
    }

    return query;
}

export async function listarreagentesParaestoque() {
    return supabaseClient
        .from('reagente')
        .select('id, nome')
        .order('nome');
}

export async function salvarreagente(id, dadosForm) {
    if (id) {
        return supabaseClient.from('reagente').update(dadosForm).eq('id', id);
    }

    return supabaseClient.from('reagente').insert(dadosForm);
}

export async function excluirreagente(id) {
    return supabaseClient.from('reagente').delete().eq('id', id);
}
