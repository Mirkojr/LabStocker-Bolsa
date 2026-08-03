import { supabaseClient } from "../supabaseClient.js";

// Acesso a dados da tabela 'feedback' (suporte ao usuario).

export async function enviarFeedback(dados) {
  return supabaseClient.from("feedback").insert(dados);
}
