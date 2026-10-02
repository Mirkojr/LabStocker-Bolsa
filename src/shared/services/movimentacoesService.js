import { supabaseClient } from "../supabaseClient.js";

// Acesso a dados da tabela 'movimentacao' (entradas/compras de estoque).

export async function listarEntradasPorLaboratorio(labId) {
  return supabaseClient
    .from("movimentacao")
    .select("*")
    .eq("id_laboratorio", labId)
    .eq("tipo", "ENTRADA")
    .order("data_movimentacao", { ascending: false });
}

export async function listarMovimentacoesPorPeriodo(inicioISO, fimISO, labId = null) {
  let query = supabaseClient
    .from("movimentacao")
    .select("*")
    .gte("data_movimentacao", inicioISO)
    .lte("data_movimentacao", fimISO);

  if (labId) {
    query = query.eq("id_laboratorio", labId);
  }

  return query;
}
