import { supabaseClient } from "../supabaseClient.js";

export async function buscarPerfilPorId(usuarioId) {
  return supabaseClient
    .from("perfis")
    .select("nome, sobrenome, identificador, id_laboratorio")
    .eq("id", usuarioId)
    .maybeSingle();
}

export async function buscarPerfilPorIdentificador(identificador) {
  return supabaseClient
    .from("perfis")
    .select("nome, sobrenome")
    .eq("identificador", identificador)
    .maybeSingle();
}

export async function buscarPerfisPorlaboratorio(laboratorioId) {
  return supabaseClient
    .from("perfis")
    .select("*")
    .eq("id_laboratorio", laboratorioId)
    .order("nome");
}

export async function buscarNomePorId(usuarioId) {
  return supabaseClient.from("perfis").select("nome").eq("id", usuarioId).single();
}

export async function buscarFlagAdminPorId(usuarioId) {
  return supabaseClient.from("perfis").select("is_admin").eq("id", usuarioId).single();
}

export async function criarPerfilUsuario(email, password, data) {
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data,
    },
  });

  if (authError) {
    return { data: null, error: authError };
  }

  const usuarioId = authData?.user?.id;

  if (!usuarioId) {
    return {
      data: null,
      error: new Error("Usuário criado no Auth, mas não foi possível obter o ID gerado."),
    };
  }

  return {
    data: {
      authUser: authData.user,
    },
    error: null,
  };
}
