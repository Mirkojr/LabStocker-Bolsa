import { supabaseClient } from "../supabaseClient.js";

// Acesso a dados da tabela 'auditoria' (só leitura: quem grava é o trigger
// do banco, a cada inclusão, alteração ou exclusão).

/**
 * Edições e exclusões feitas à mão nos itens de estoque de um laboratório,
 * com o nome de quem fez. Consumo e transferência já têm registro próprio
 * no Histórico, por isso ficam de fora.
 * @param {string} labId Id do laboratório.
 */
export async function listarAjustesEstoquePorLaboratorio(labId) {
  return supabaseClient
    .from("auditoria")
    .select(
      `
            id, acao, motivo, item_nome, dados_antes, dados_depois, data_registro,
            perfis ( nome, sobrenome )
        `
    )
    .eq("id_laboratorio", labId)
    .eq("tabela", "estoquelab")
    .eq("origem", "manual")
    .in("acao", ["alteracao", "exclusao"])
    .order("data_registro", { ascending: false });
}
