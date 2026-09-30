import { minhasPermissoes, souAdmin, temPermissaoGlobal } from "./services/permissoesService.js";

// Permissões do usuário logado, do jeito que o front precisa:
//   - qual laboratório está ativo (o usuário pode ter vínculo com vários)
//   - quais ações ele pode fazer nesse laboratório
//
// A fonte é a RPC minhas_permissoes(), que usa a MESMA função do banco
// (tem_permissao) que protege as tabelas. Aqui só decidimos o que mostrar;
// quem garante a regra é o banco.

const CHAVE_LAB_ATIVO = "LAB_ATIVO_ID";
const CHAVE_ADMIN_LAB_ID = "ADMIN_SELECTED_LAB_ID";
const CHAVE_ADMIN_LAB_NOME = "ADMIN_SELECTED_LAB_NAME";

export const NOMES_PAPEL = { chefe: "Chefe", gestor: "Gestor", membro: "Membro" };

let cachePermissoes = null;

function lerSessao(chave) {
  try {
    return sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarSessao(chave, valor) {
  try {
    if (valor === null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, valor);
  } catch {
    // sessionStorage indisponível: o laboratório ativo volta ao padrão
  }
}

/** Carrega (uma vez por página) os vínculos ativos e se o usuário é admin. */
export function carregarPermissoes() {
  // Guarda a promessa (e não o resultado) para chamadas simultâneas
  // compartilharem a mesma requisição.
  if (!cachePermissoes) {
    cachePermissoes = Promise.all([minhasPermissoes(), souAdmin()])
      .then(([respVinculos, respAdmin]) => {
        if (respVinculos.error) throw respVinculos.error;
        if (respAdmin.error) throw respAdmin.error;
        return { vinculos: respVinculos.data || [], admin: Boolean(respAdmin.data) };
      })
      .catch((error) => {
        cachePermissoes = null;
        throw error;
      });
  }
  return cachePermissoes;
}

/**
 * Laboratório em que o usuário está trabalhando agora.
 * @returns {Promise<{id, nome, papel, acoes: string[], modoAdmin: boolean} | null>}
 *   modoAdmin = admin olhando um laboratório em que não tem vínculo (só leitura).
 */
export async function obterLaboratorioAtivo() {
  const { vinculos, admin } = await carregarPermissoes();

  const labAdmin = lerSessao(CHAVE_ADMIN_LAB_ID);
  if (admin && labAdmin) {
    const vinculo = vinculos.find((v) => v.id_laboratorio === labAdmin);
    return {
      id: labAdmin,
      nome: vinculo?.nome_laboratorio || lerSessao(CHAVE_ADMIN_LAB_NOME) || "",
      papel: vinculo?.papel || null,
      acoes: vinculo?.acoes || ["laboratorio.ver"],
      modoAdmin: !vinculo,
    };
  }

  const salvo = lerSessao(CHAVE_LAB_ATIVO);
  const vinculo = vinculos.find((v) => v.id_laboratorio === salvo) || vinculos[0];
  if (!vinculo) return null;

  return {
    id: vinculo.id_laboratorio,
    nome: vinculo.nome_laboratorio,
    papel: vinculo.papel,
    acoes: vinculo.acoes || [],
    modoAdmin: false,
  };
}

export function definirLaboratorioAtivo(labId) {
  gravarSessao(CHAVE_LAB_ATIVO, labId);
}

/** O usuário pode fazer a ação no laboratório ativo? */
export async function pode(acao) {
  const lab = await obterLaboratorioAtivo();
  return Boolean(lab && lab.acoes.includes(acao));
}

/** Permissão fora de laboratório (catálogo de reagentes). */
export async function podeGlobal(acao) {
  const { data, error } = await temPermissaoGlobal(acao);
  if (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
  return Boolean(data);
}

/**
 * Remove de `raiz` os elementos marcados com data-permissao="<acao>" cuja
 * ação não está em `acoes`. Use nos botões de cada tela, por exemplo:
 *   <button data-permissao="estoque.editar">Novo item</button>
 */
export function aplicarPermissoes(raiz, acoes) {
  if (!raiz) return;
  raiz.querySelectorAll("[data-permissao]").forEach((el) => {
    if (!acoes.includes(el.dataset.permissao)) el.remove();
  });
}

// --- Modo admin: ver um laboratório sem ter vínculo (somente leitura) ---

export function entrarModoAdmin(labId, labNome) {
  gravarSessao(CHAVE_ADMIN_LAB_ID, labId);
  gravarSessao(CHAVE_ADMIN_LAB_NOME, labNome);
}

export function sairModoAdmin() {
  gravarSessao(CHAVE_ADMIN_LAB_ID, null);
  gravarSessao(CHAVE_ADMIN_LAB_NOME, null);
}

export function limparSessaoPermissoes() {
  sairModoAdmin();
  gravarSessao(CHAVE_LAB_ATIVO, null);
  cachePermissoes = null;
}
