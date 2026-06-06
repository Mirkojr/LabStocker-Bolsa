import { supabaseClient } from '../supabaseClient.js';

export async function listarReagentes(filtroNome = '') {
    let query = supabaseClient.from('Reagente').select('*').order('nome');

    if (filtroNome) {
        query = query.ilike('nome', `%${filtroNome}%`);
    }

    return query;
}

export async function listarReagentesParaEstoque() {
    return supabaseClient
        .from('Reagente')
        .select('id, nome')
        .order('nome');
}

export async function salvarReagente(id, dadosForm) {
    if (id) {
        return supabaseClient.from('Reagente').update(dadosForm).eq('id', id);
    }

    return supabaseClient.from('Reagente').insert(dadosForm);
}

export async function excluirReagente(id) {
    return supabaseClient.from('Reagente').delete().eq('id', id);
}
