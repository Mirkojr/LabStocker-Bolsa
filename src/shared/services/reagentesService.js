import { supabaseClient } from "../supabaseClient.js";
import { calcularRange, TAMANHO_PAGINA_PADRAO } from "../utils/paginacao.js";

/**
 * Lista reagentes do catalogo com busca opcional por nome, formula ou numero
 * CAS e paginacao server-side. Quando 'pagina' e omitida (null), retorna
 * todos os registros.
 * @param {string} filtroNome Filtro parcial por nome, formula ou CAS (ilike).
 * @param {object} [opcoes]
 * @param {number|null} [opcoes.pagina] Pagina (1-based) ou null para todos.
 * @param {number} [opcoes.tamanho] Itens por pagina.
 * @returns Resposta do Supabase com { data, error, count }.
 */
export async function listarreagentes(
  filtroNome = "",
  { pagina = null, tamanho = TAMANHO_PAGINA_PADRAO } = {}
) {
  let query = supabaseClient.from("reagente").select("*", { count: "exact" }).order("nome");

  // Virgula, parenteses e aspas quebram a sintaxe do filtro .or() do
  // PostgREST; % e _ seriam curingas do ilike.
  const termo = filtroNome.replace(/[,()"\\%_*]/g, " ").trim();
  if (termo) {
    const padrao = `%${termo}%`;
    query = query.or(
      `nome.ilike.${padrao},composicao_quimica.ilike.${padrao},numero_cas.ilike.${padrao}`
    );
  }

  if (pagina) {
    const { from, to } = calcularRange(pagina, tamanho);
    query = query.range(from, to);
  }

  return query;
}

export async function listarreagentesParaestoque() {
  return supabaseClient.from("reagente").select("id, nome").order("nome");
}

export async function salvarreagente(id, dadosForm) {
  if (id) {
    return supabaseClient.from("reagente").update(dadosForm).eq("id", id);
  }

  return supabaseClient.from("reagente").insert(dadosForm);
}

export async function excluirreagente(id) {
  return supabaseClient.from("reagente").delete().eq("id", id);
}
