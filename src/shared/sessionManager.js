import { supabaseClient } from "./supabaseClient.js";

/**
 * Função central para pegar o ID do laboratório atual.
 * Primeiro tenta pegar do sessionStorage (cache), depois faz uma RPC no banco.
 */
export async function getCurrentLabId() {
  const adminSelectedLab = sessionStorage.getItem("ADMIN_SELECTED_LAB_ID");
  if (adminSelectedLab) return adminSelectedLab;

  const cache = sessionStorage.getItem("MY_LAB_ID");
  if (cache) return cache; // evita RPC repetido

  const { data: labId, error } = await supabaseClient.rpc("get_my_lab_id");
  if (error) {
    console.error("Erro ao buscar Lab ID:", error);
    return null;
  }

  if (labId) sessionStorage.setItem("MY_LAB_ID", labId); // cacheia
  return labId;
}

/**
 * Verifica se o usuário atual é Admin
 */
export async function checkIsAdmin() {
  const { data, error } = await supabaseClient.rpc("am_i_admin");
  if (error) return false;
  return data;
}

/**
 * (Para uso do Admin) Define qual laboratório vamos gerenciar agora
 */
export function setAdminLabContext(labId, labName) {
  sessionStorage.setItem("ADMIN_SELECTED_LAB_ID", labId);
  sessionStorage.setItem("ADMIN_SELECTED_LAB_NAME", labName);
}

/**
 * Limpa a seleção do Admin (volta ao estado normal)
 */
export function clearAdminContext() {
  sessionStorage.removeItem("ADMIN_SELECTED_LAB_ID");
  sessionStorage.removeItem("ADMIN_SELECTED_LAB_NAME");
}
