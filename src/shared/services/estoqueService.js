import { supabaseClient } from "../supabaseClient.js";

export async function listarestoquePorlaboratorio(labId) {
  return supabaseClient
    .from("estoquelab")
    .select(
      `
            id, quantidade, unidade_medida, data_validade, observacoes_operacionais, id_reagente,
            reagente ( nome )
        `
    )
    .eq("id_laboratorio", labId)
    .order("data_validade");
}

// Estoque de outro laboratório: só o que está disponível (com saldo e na
// validade), sem local nem observações. Produto controlado vem sem a
// quantidade (null). A tabela estoquelab só é lida pelo próprio laboratório.
export async function listarEstoqueDisponivelPorLaboratorio(labId) {
  return supabaseClient.rpc("estoque_disponivel", { p_laboratorio: labId });
}

export async function listarreagentesParaestoque() {
  return supabaseClient.from("reagente").select("id, nome").order("nome");
}

// Item novo entra direto na tabela. A edição passa pela RPC editar_item_estoque,
// que exige motivo quando muda quantidade, unidade ou reagente e deixa a
// alteração registrada na auditoria.
export async function salvarItemestoque(id, dadosForm, motivo = null) {
  if (id) {
    return supabaseClient.rpc("editar_item_estoque", {
      p_id: id,
      p_id_reagente: dadosForm.id_reagente,
      p_quantidade: dadosForm.quantidade,
      p_unidade_medida: dadosForm.unidade_medida,
      p_data_validade: dadosForm.data_validade,
      p_observacoes: dadosForm.observacoes_operacionais,
      p_motivo: motivo,
    });
  }

  return supabaseClient.from("estoquelab").insert(dadosForm);
}

export async function registrarMovimentacaoEntradaestoque(dados) {
  return supabaseClient.from("movimentacao").insert(dados);
}

export async function excluirItemestoque(id) {
  return supabaseClient.from("estoquelab").delete().eq("id", id);
}
