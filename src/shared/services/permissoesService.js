import { supabaseClient } from "../supabaseClient.js";

// Acesso ao modelo de permissões (vínculos usuário–laboratório e admins).
// As regras ficam no banco (tem_permissao e RPCs de delegação); aqui só
// chamamos as funções e lemos as tabelas permitidas pela RLS.

/** Vínculos ativos do usuário logado, com as ações permitidas em cada laboratório. */
export async function minhasPermissoes() {
  return supabaseClient.rpc("minhas_permissoes");
}

export async function souAdmin() {
  return supabaseClient.rpc("eh_admin");
}

/** Permissões fora de um laboratório (ex.: 'reagente.editar'). */
export async function temPermissaoGlobal(acao) {
  return supabaseClient.rpc("tem_permissao_global", { p_acao: acao });
}

/**
 * Todos os vínculos (ativos e histórico) de um laboratório, com os nomes
 * de quem tem o vínculo, de quem concedeu e de quem revogou. Usa a RPC
 * vinculos_do_laboratorio (a RLS de perfis não mostra ex-integrantes).
 */
export async function listarVinculosDoLaboratorio(labId) {
  const { data, error } = await supabaseClient.rpc("vinculos_do_laboratorio", {
    p_laboratorio: labId,
  });
  if (error) return { data: null, error };

  const pessoa = (nomeCompleto) => (nomeCompleto ? { nome: nomeCompleto, sobrenome: "" } : null);
  return {
    data: data.map((v) => ({
      ...v,
      usuario: { nome: v.nome, sobrenome: v.sobrenome, email: v.email, cargo: v.cargo },
      concedente: pessoa(v.concedido_por_nome),
      revogador: pessoa(v.revogado_por_nome),
    })),
    error: null,
  };
}

/** Chefes atuais de todos os laboratórios (visão do admin). */
export async function listarChefesAtuais() {
  return supabaseClient
    .from("vinculo_laboratorio")
    .select("id, id_laboratorio, usuario:perfis!vinculo_id_usuario_fkey ( nome, sobrenome, email )")
    .eq("papel", "chefe")
    .is("revogado_em", null);
}

export async function concederVinculo(labId, email, papel, expiraEm = null) {
  return supabaseClient.rpc("conceder_vinculo", {
    p_laboratorio: labId,
    p_email: email,
    p_papel: papel,
    p_expira_em: expiraEm,
  });
}

export async function revogarVinculo(vinculoId, motivo = null) {
  return supabaseClient.rpc("revogar_vinculo", { p_vinculo: vinculoId, p_motivo: motivo });
}

export async function transferirChefia(labId, novoChefeId) {
  return supabaseClient.rpc("transferir_chefia", {
    p_laboratorio: labId,
    p_novo_chefe: novoChefeId,
  });
}

export async function definirChefe(labId, email, motivo = null) {
  return supabaseClient.rpc("definir_chefe", {
    p_laboratorio: labId,
    p_email: email,
    p_motivo: motivo,
  });
}

export async function listarAdmins() {
  return supabaseClient
    .from("administrador")
    .select(
      `id, id_usuario, concedido_em, observacao, revogado_em, motivo_revogacao,
       usuario:perfis!administrador_id_usuario_fkey ( nome, sobrenome, email ),
       concedente:perfis!administrador_concedido_por_fkey ( nome, sobrenome ),
       revogador:perfis!administrador_revogado_por_fkey ( nome, sobrenome )`
    )
    .order("concedido_em", { ascending: false });
}

export async function concederAdmin(email) {
  return supabaseClient.rpc("conceder_admin", { p_email: email });
}

export async function revogarAdmin(usuarioId, motivo = null) {
  return supabaseClient.rpc("revogar_admin", { p_usuario: usuarioId, p_motivo: motivo });
}

export async function definirCargo(usuarioId, cargo) {
  return supabaseClient.rpc("definir_cargo", { p_usuario: usuarioId, p_cargo: cargo });
}
