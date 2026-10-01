import { escapeHtml } from "./dom.js";

// Função para formatar CPF brasileiro
// Recebe uma string de CPF (com ou sem formatação) e retorna no formato XXX.XXX.XXX-XX
export function formatarCPF(cpf) {
  if (!cpf) return "-";
  const limpo = cpf.replace(/\D/g, "");
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Função para formatar números de telefone brasileiros
// Retorna o número formatado como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX dependendo do comprimento
export function formatarTelefone(telefone) {
  if (!telefone) return "-";
  const limpo = telefone.replace(/\D/g, "");
  if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
  if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return telefone;
}

// Escapa a fórmula e põe os números em subscrito (H2SO4 -> H<sub>2</sub>SO<sub>4</sub>).
// As entidades criadas pelo escape (ex.: &#039;) ficam intactas.
export function formatarFormulaQuimica(formula) {
  if (!formula) return "";
  // O número logo depois do "·" é coeficiente e fica na linha (CuSO4·5H2O).
  return escapeHtml(formula).replace(
    /(&#?\w+;)|(·\d+)|(\d+)/g,
    (_m, entidade, coeficiente, numero) => entidade || coeficiente || `<sub>${numero}</sub>`
  );
}

// Número no padrão brasileiro (vírgula decimal, ponto de milhar), com até 3 casas.
export function formatarNumero(valor, casas = 3) {
  if (valor === null || valor === undefined || valor === "") return "-";
  const num = Number(valor);
  if (Number.isNaN(num)) return String(valor);
  return num.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

// Quantidade com unidade, ex.: "2,5 L", "800 mL". A unidade vai exatamente como
// está (mL, g, kg): em unidade de medida, maiúscula muda o sentido (ML = megalitro).
export function formatarQuantidade(valor, unidade) {
  const numero = formatarNumero(valor);
  return unidade ? `${numero} ${unidade}` : numero;
}

// Data e hora no formato "30/09/2026 às 17:40".
export function formatarDataHora(data) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "-";
  const dia = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

// O banco grava o tipo de perigo sem acento; na tela ele aparece com acento.
const ROTULOS_TIPO_PERIGO = {
  Inflamavel: "Inflamável",
  Toxico: "Tóxico",
  Corrosivo: "Corrosivo",
  Biologico: "Biológico",
  Outro: "Outro / mistura",
};

export function formatarTipoPerigo(tipo) {
  if (!tipo) return "Não informado";
  return ROTULOS_TIPO_PERIGO[tipo] || tipo;
}

// Status do resíduo ("Em Aberto" no banco) em caixa de frase.
export function formatarStatusResiduo(status) {
  if (status === "Em Aberto") return "Em aberto";
  return status || "-";
}
