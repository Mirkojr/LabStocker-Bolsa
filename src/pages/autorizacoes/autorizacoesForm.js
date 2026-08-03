import { $ } from "../../shared/utils/dom.js";
import { showToast } from "../../shared/utils/toast.js";
// Topo do arquivo: adicione validarEmail ao import existente
import { validarCPF, validarTelefone, validarEmail } from "../../shared/utils/validators.js";
import { buscarPerfilPorId } from "../../shared/services/perfisService.js";
import { getUsuarioLogado } from "../../shared/services/authService.js";
import {
  buscarLaboratorioPorId,
  buscarNomePorSipac,
} from "../../shared/services/laboratoriosService.js";
import { criarProjeto } from "../../shared/services/projetosService.js";
import { adicionarLinhaProduto } from "./autorizacoesView.js";

let emailUsuarioLogado = null;
export const getEmailUsuarioLogado = () => emailUsuarioLogado;

// ---- Preenchimento dos dados do usuário ------------------------------------

function bloquearCampo(input) {
  if (!input) return;
  input.readOnly = true;
  input.classList.add("bg-dark", "bg-opacity-50");
  input.style.cursor = "not-allowed";
}

function preencherCampoBloqueado(id, valor) {
  const input = $(id);
  if (!input) return;
  input.value = valor;
  bloquearCampo(input);
}

export async function preencherDadosUsuario() {
  try {
    const {
      data: { user },
    } = await getUsuarioLogado();
    if (!user) return;

    emailUsuarioLogado = user.email;
    preencherCampoBloqueado("responsavel-email", user.email);

    const { data: perfil } = await buscarPerfilPorId(user.id);
    if (!perfil) return;

    preencherCampoBloqueado("responsavel-nome", `${perfil.nome} ${perfil.sobrenome || ""}`.trim());

    if (perfil.tipo_identificador === "siape") {
      preencherCampoBloqueado("responsavel-siape", perfil.identificador);
    }

    if (perfil.id_laboratorio) {
      const { data: lab } = await buscarLaboratorioPorId(perfil.id_laboratorio);
      if (lab) {
        preencherCampoBloqueado("lab-nome", lab.nome_laboratorio);
        preencherCampoBloqueado("lab-sipac", lab.codigo_sipac);
      }
    }
  } catch (e) {
    console.error("Erro ao preencher dados do usuário:", e);
  }
}

// ---- Coleta e validação ----------------------------------------------------

function coletarProdutos() {
  const tbody = $("corpo-tabela-produtos");
  return Array.from(tbody.rows)
    .map((row) => ({
      nome: row.querySelector(".product-name").value.trim(),
      quantidade: parseFloat(row.querySelector(".product-qty").value),
      unidade: row.querySelector(".product-unit").value,
    }))
    .filter((p) => p.nome !== "");
}

function coletarDadosFormulario(produtos) {
  return {
    responsavel_nome: $("responsavel-nome").value.trim(),
    responsavel_siape: $("responsavel-siape").value.trim(),
    responsavel_cpf: $("responsavel-cpf").value,
    responsavel_email: $("responsavel-email").value,
    responsavel_telefone: $("responsavel-telefone").value,
    titulo_projeto: $("projeto-titulo").value.trim(),
    orgao_financiador: $("projeto-orgao").value,
    registro_numero: $("projeto-registro").value,
    periodo_execucao: $("projeto-periodo").value,
    lab_nome: $("lab-nome").value.trim(),
    lab_sipac: $("lab-sipac").value.trim(),
    produtos,
    status: "pendente",
  };
}

// Retorna a mensagem de erro ou null se estiver tudo válido.
async function validarSolicitacao(dados) {
  const TITULO_MAX = 100;
  const QTD_MAX = 1000000;

  if (!dados.responsavel_nome) return "Informe o nome do responsável.";
  if (!validarEmail(dados.responsavel_email)) return "E-mail institucional inválido.";
  if (!validarCPF(dados.responsavel_cpf)) return "CPF inválido. Confira o número digitado.";
  if (!validarTelefone(dados.responsavel_telefone)) return "Telefone inválido. Use DDD + número.";

  if (!dados.titulo_projeto) return "Informe o título do projeto.";
  if (dados.titulo_projeto.length > TITULO_MAX)
    return `O título deve ter no máximo ${TITULO_MAX} caracteres.`;

  if (!dados.lab_nome) return "Informe o nome do laboratório.";
  if (!dados.lab_sipac) return "Informe o código SIPAC do laboratório.";
  if (dados.lab_sipac) {
    const { data: nomeOficial } = await buscarNomePorSipac(dados.lab_sipac);
    if (!nomeOficial) return "Código SIPAC não encontrado no sistema.";
  }

  if (dados.produtos.length === 0) return "Adicione ao menos um reagente/material.";
  if (dados.produtos.some((p) => !(p.quantidade > 0) || p.quantidade > QTD_MAX)) {
    return `A quantidade de cada item deve ser maior que zero e até ${QTD_MAX.toLocaleString("pt-BR")}.`;
  }
  return null;
}

// ---- Submit ----------------------------------------------------------------

export function iniciarLogicaFormulario(onSucesso) {
  const form = $("form-autorizacao");
  const tbody = $("corpo-tabela-produtos");
  const btnEnviar = $("btn-enviar-solicitacao");

  $("btn-adicionar-item").addEventListener("click", adicionarLinhaProduto);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = "Enviando...";

    try {
      const produtos = coletarProdutos();
      const dados = coletarDadosFormulario(produtos);

      const erro = await validarSolicitacao(dados);
      if (erro) {
        showToast(erro, "error");
        return;
      }

      const { error } = await criarProjeto(dados);
      if (error) throw error;

      showToast("Solicitação enviada para análise com sucesso!", "success");
      form.reset();
      tbody.innerHTML = "";
      adicionarLinhaProduto();
      await onSucesso?.();
    } catch (err) {
      console.error("Erro ao enviar solicitação:", err);
      showToast("Erro ao enviar solicitação: " + (err.message || "tente novamente."), "error");
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = textoOriginal;
    }
  });
}
