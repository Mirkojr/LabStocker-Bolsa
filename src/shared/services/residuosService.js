import { supabaseClient } from '../supabaseClient.js';
import { calcularRange, TAMANHO_PAGINA_PADRAO } from '../utils/paginacao.js';

// Acesso a dados da tabela 'residuo'.

/**
 * Lista os resíduos de um laboratório com paginação server-side opcional.
 * Quando 'pagina' é omitida (null), retorna todos os registros.
 * @param {string|number} labId Id do laboratório.
 * @param {object} [opcoes]
 * @param {number|null} [opcoes.pagina] Página (1-based) ou null para todos.
 * @param {number} [opcoes.tamanho] Itens por página.
 * @returns Resposta do Supabase com { data, error, count }.
 */
export async function listarResiduosPorLaboratorio(labId, { pagina = null, tamanho = TAMANHO_PAGINA_PADRAO } = {}) {
    let query = supabaseClient
        .from('residuo')
        .select('*', { count: 'exact' })
        .eq('id_laboratorio', labId)
        .order('data_criacao', { ascending: false });

    if (pagina) {
        const { from, to } = calcularRange(pagina, tamanho);
        query = query.range(from, to);
    }

    return query;
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
