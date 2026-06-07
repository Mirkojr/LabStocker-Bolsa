import { supabaseClient } from '../supabaseClient.js';

// Camada de acesso a autenticacao (Supabase Auth).
// Centraliza login, logout e consulta de sessao/usuario logado.

export async function login(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
}

export async function logout() {
    return supabaseClient.auth.signOut();
}

export async function getSessao() {
    return supabaseClient.auth.getSession();
}

export async function getUsuarioLogado() {
    return supabaseClient.auth.getUser();
}
