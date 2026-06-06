import { supabaseClient } from '../supabaseClient.js';

export async function listarEstoquePorLaboratorio(labId) {
    return supabaseClient
        .from('EstoqueLab')
        .select(`
            id, quantidade, unidade_medida, data_validade, observacoes_operacionais, id_reagente,
            Reagente ( nome )
        `)
        .eq('id_laboratorio', labId)
        .order('data_validade');
}

export async function listarReagentesParaEstoque() {
    return supabaseClient
        .from('Reagente')
        .select('id, nome')
        .order('nome');
}

export async function salvarItemEstoque(id, dadosForm) {
    if (id) {
        return supabaseClient.from('EstoqueLab').update(dadosForm).eq('id', id);
    }

    return supabaseClient.from('EstoqueLab').insert(dadosForm);
}

export async function registrarMovimentacaoEntradaEstoque(dados) {
    return supabaseClient.from('Movimentacao').insert(dados);
}

export async function excluirItemEstoque(id) {
    return supabaseClient.from('EstoqueLab').delete().eq('id', id);
}
