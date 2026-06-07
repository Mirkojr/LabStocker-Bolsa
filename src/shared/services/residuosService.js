import { supabaseClient } from '../supabaseClient.js';

// Acesso a dados da tabela 'residuo'.

export async function listarResiduosPorLaboratorio(labId) {
    return supabaseClient
        .from('residuo')
        .select('*')
        .eq('id_laboratorio', labId)
        .order('data_criacao', { ascending: false });
}

export async function salvarResiduo(id, dados) {
    if (id) {
        return supabaseClient.from('residuo').update(dados).eq('id', id);
    }
    return supabaseClient.from('residuo').insert([dados]);
}

export async function atualizarStatusResiduo(id, status) {
    return supabaseClient
        .from('residuo')
        .update({ status })
        .eq('id', id);
}

export async function listarResiduosDescartadosPorLaboratorio(labId) {
    return supabaseClient
        .from('residuo')
        .select('*')
        .eq('id_laboratorio', labId)
        .eq('status', 'Descartado')
        .order('data_criacao', { ascending: false });
}

export async function listarResiduosDescartadosPorPeriodo(inicioISO, fimISO, labId = null) {
    let query = supabaseClient
        .from('residuo')
        .select('*')
        .eq('status', 'Descartado')
        .gte('data_criacao', inicioISO)
        .lte('data_criacao', fimISO);

    if (labId) {
        query = query.eq('id_laboratorio', labId);
    }

    return query;
}
