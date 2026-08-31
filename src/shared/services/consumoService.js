import { supabaseClient } from "../supabaseClient.js";

// Acesso a dados da tabela 'consumo' + RPC 'registrar_consumo'.
// Segue o mesmo padrao de transferenciasService.js (RPC para operacoes
// atomicas de estoque) e residuosService.js (CRUD simples).

/**
 * Registra o consumo de um item de estoque de forma atomica:
 * debita o estoque e cria o registro de consumo (usuario = quem esta logado).
 * @param {string} idItemEstoque Id da linha em 'estoquelab'.
 * @param {number} quantidade Quantidade consumida (deve ser > 0 e <= saldo).
 * @param {string|null} [finalidade] Motivo/uso do consumo (opcional).
 * @returns Resposta do Supabase com { data: consumo, error }.
 */
export async function registrarConsumo(idItemEstoque, quantidade, finalidade = null) {
  return supabaseClient.rpc("registrar_consumo", {
    p_id_item_estoque: idItemEstoque,
    p_quantidade: quantidade,
    p_finalidade: finalidade,
  });
}

/**
 * Lista os consumos de um laboratorio, com o nome do reagente e do
 * usuario que consumiu (join com reagente e perfis).
 * @param {string} labId Id do laboratorio.
 */
export async function listarConsumosPorLaboratorio(labId) {
  return supabaseClient
    .from("consumo")
    .select(
      `
            id, quantidade, unidade_medida, finalidade, data_consumo, id_item_estoque,
            reagente ( nome ),
            perfis ( nome, sobrenome )
        `
    )
    .eq("id_laboratorio", labId)
    .order("data_consumo", { ascending: false });
}

/**
 * Busca um unico consumo por id (usado para pre-preencher o formulario
 * de residuo apos o usuario confirmar que deseja registra-lo).
 */
export async function buscarConsumoPorId(id) {
  return supabaseClient
    .from("consumo")
    .select("id, quantidade, unidade_medida, finalidade, data_consumo, reagente ( nome )")
    .eq("id", id)
    .single();
}
