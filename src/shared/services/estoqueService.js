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

export async function listarEstoqueDisponivelPorLaboratorio(labId) {
  return supabaseClient
    .from("estoquelab")
    .select("*, reagente(nome)")
    .eq("id_laboratorio", labId)
    .gt("quantidade", 0);
}

export async function listarreagentesParaestoque() {
  return supabaseClient.from("reagente").select("id, nome").order("nome");
}

export async function salvarItemestoque(id, dadosForm) {
  if (id) {
    return supabaseClient.from("estoquelab").update(dadosForm).eq("id", id);
  }

  return supabaseClient.from("estoquelab").insert(dadosForm);
}

export async function registrarMovimentacaoEntradaestoque(dados) {
  return supabaseClient.from("Movimentacao").insert(dados);
}

export async function excluirItemestoque(id) {
  return supabaseClient.from("estoquelab").delete().eq("id", id);
}
