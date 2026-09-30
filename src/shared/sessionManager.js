import {
  carregarPermissoes,
  entrarModoAdmin,
  obterLaboratorioAtivo,
  sairModoAdmin,
} from "./permissoes.js";

// Interface usada pelas páginas desde o início do projeto. Por baixo,
// tudo vem do modelo de vínculos (shared/permissoes.js).

/**
 * ID do laboratório em que o usuário está trabalhando: o escolhido no
 * painel (quando tem vínculo com vários), ou o que o admin está
 * visualizando. Null se o usuário não tem vínculo ativo.
 */
export async function getCurrentLabId() {
  const lab = await obterLaboratorioAtivo();
  return lab ? lab.id : null;
}

/** O usuário atual é admin do sistema? */
export async function checkIsAdmin() {
  try {
    const { admin } = await carregarPermissoes();
    return admin;
  } catch (error) {
    console.error("Erro ao verificar admin:", error);
    return false;
  }
}

/** (Admin) Passa a visualizar um laboratório, em modo somente leitura. */
export function setAdminLabContext(labId, labName) {
  entrarModoAdmin(labId, labName);
}

/** (Admin) Sai da visualização do laboratório. */
export function clearAdminContext() {
  sairModoAdmin();
}
