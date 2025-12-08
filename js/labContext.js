import { supabaseClient } from './supabaseClient.js';

/**
 * Verifica se o usuário atual é Admin
 * (Chama a função RPC 'am_i_admin' do banco de dados)
 */
export async function checkIsAdmin() {
    try {
        const { data, error } = await supabaseClient.rpc('am_i_admin');
        if (error) {
            console.error("Erro ao verificar admin:", error);
            return false;
        }
        return data; // Retorna true ou false
    } catch (e) {
        console.error("Exceção na verificação:", e);
        return false;
    }
}

/**
 * Função para pegar o ID do laboratório atual.
 * (Útil se você usar em outras partes do sistema)
 */
export async function getCurrentLabId() {
    // 1. Verifica se o Admin escolheu um lab (sessão)
    const adminSelectedLab = sessionStorage.getItem('ADMIN_SELECTED_LAB_ID');
    if (adminSelectedLab) {
        return adminSelectedLab;
    }

    // 2. Se não, usa o ID real do usuário
    const { data: labId, error } = await supabaseClient.rpc('get_my_lab_id');
    
    if (error) {
        console.error("Erro ao buscar Lab ID:", error);
        return null;
    }
    return labId;
}