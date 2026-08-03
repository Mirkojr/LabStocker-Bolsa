// Máscaras de input reutilizáveis.
// Cada função recebe o valor digitado e devolve o valor já formatado.

export function mascararCPF(valor) {
  return valor
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function mascararTelefone(valor) {
  let v = valor.replace(/\D/g, "").replace(/^(\d{2})(\d)/g, "($1) $2");
  // Até 10 dígitos => fixo (XX) XXXX-XXXX | 11 dígitos => celular (XX) XXXXX-XXXX
  if (v.length > 14) {
    v = v.replace(/(\d{5})(\d{4})$/, "$1-$2");
  } else {
    v = v.replace(/(\d{4})(\d{4})$/, "$1-$2");
  }
  return v;
}

export function mascararSiape(valor) {
  return valor.replace(/\D/g, "").substring(0, 7);
}

export function mascararPeriodo(valor) {
  let v = valor.replace(/\D/g, "");
  if (v.length > 4) v = v.replace(/^(\d{4})(\d)/, "$1-$2");
  return v.substring(0, 9);
}

// Liga uma máscara a um input: reaplica a formatação a cada digitação.
export function aplicarMascara(input, fnMascara) {
  if (!input) return;
  input.addEventListener("input", (e) => {
    e.target.value = fnMascara(e.target.value);
  });
}
