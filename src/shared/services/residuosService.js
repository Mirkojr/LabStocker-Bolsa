import { supabaseClient } from '../supabaseClient.js';
import { calcularRange, TAMANHO_PAGINA_PADRAO } from '../utils/paginacao.js';

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

export async function criarResiduo(dados) {
    return supabaseClient.from('residuo').insert(dados);
}

export async function excluirResiduo(id) {
    return supabaseClient.from('residuo').delete().eq('id', id);
}
