import { supabaseClient } from '../supabaseClient.js';

// Acesso a dados da tabela 'transferencia' (solicitacoes entre laboratorios).
//
// Convenção de direção (modelo físico do material):
//   id_lab_origem  = laboratório DONO do reagente (de onde o material sai). É quem APROVA.
//   id_lab_destino = laboratório que SOLICITA / vai RECEBER o material.

export async function criarSolicitacao(dados) {
    return supabaseClient.from('transferencia').insert(dados);
}

// Pedidos pendentes que o laboratório DONO (origem) precisa aprovar.
// O nome retornado em 'laboratorio' é o do laboratório SOLICITANTE (destino).
export async function listarSolicitacoesPendentes(labOrigemId) {
    return supabaseClient
        .from('transferencia')
        .select(`
            id,
            quantidade_transferida,
            data_solicitacao,
            laboratorio:id_lab_destino ( nome_laboratorio ),
            estoquelab:id_item_estoque (
                unidade_medida,
                reagente ( nome )
            )
        `)
        .eq('id_lab_origem', labOrigemId)
        .eq('status', 'pendente')
        .order('data_solicitacao', { ascending: false });
}

export async function aprovarTransferencia(transferId) {
    // Funcao RPC do banco que cuida de toda a transacao (debito/credito de estoque).
    return supabaseClient.rpc('aprovar_transferencia', { p_transfer_id: transferId });
}

// Recusa a solicitacao e registra o motivo (exibido no historico do solicitante).
export async function recusarTransferencia(transferId, motivo = null) {
    return supabaseClient
        .from('transferencia')
        .update({ status: 'recusado', motivo_recusa: motivo })
        .eq('id', transferId);
}

export async function listarTransferenciasPorLaboratorio(labId) {
    return supabaseClient
        .from('transferencia')
        .select(`
            id, quantidade_transferida, status, motivo_recusa, data_solicitacao, id_lab_origem, id_lab_destino,
            LabOrigem:id_lab_origem ( nome_laboratorio ),
            LabDestino:id_lab_destino ( nome_laboratorio ),
            estoquelab:id_item_estoque ( unidade_medida, reagente ( nome ) )
        `)
        .or(`id_lab_origem.eq.${labId},id_lab_destino.eq.${labId}`)
        .order('data_solicitacao', { ascending: false });
}

export async function listarTransferenciasPorPeriodo(inicioISO, fimISO, labId = null) {
    let query = supabaseClient
        .from('transferencia')
        .select(`*, LabOrigem:id_lab_origem(nome_laboratorio), LabDestino:id_lab_destino(nome_laboratorio), estoquelab:id_item_estoque(reagente(nome), unidade_medida)`)
        .gte('data_solicitacao', inicioISO)
        .lte('data_solicitacao', fimISO);

    if (labId) {
        query = query.or(`id_lab_origem.eq.${labId},id_lab_destino.eq.${labId}`);
    }

    return query;
}