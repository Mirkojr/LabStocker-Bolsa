// Validações reutilizáveis de campos de formulário.

// Valida CPF brasileiro (com dígitos verificadores).
export function validarCPF(cpf) {
  if (!cpf) return false;
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i], 10) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c[i], 10) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

// Valida número CAS (NNNNNNN-NN-N) com o dígito verificador: os dígitos
// antes dele, da direita para a esquerda, multiplicados por 1, 2, 3...;
// a soma módulo 10 é o último dígito. Mesma regra de cas_valido() no banco.
export function validarCAS(cas) {
  if (!cas || !/^[1-9]\d{1,6}-\d{2}-\d$/.test(cas)) return false;
  const digitos = cas.replace(/-/g, "");
  let soma = 0;
  for (let i = 1; i < digitos.length; i++) {
    soma += Number(digitos[digitos.length - 1 - i]) * i;
  }
  return soma % 10 === Number(digitos[digitos.length - 1]);
}

// Valida telefone brasileiro (10 ou 11 dígitos).
export function validarTelefone(telefone) {
  if (!telefone) return false;
  const t = telefone.replace(/\D/g, "");
  return t.length === 10 || t.length === 11;
}

// Valida formato básico de e-mail.
export function validarEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
