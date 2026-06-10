// Validações reutilizáveis de campos de formulário.

// Valida CPF brasileiro (com dígitos verificadores). 
export function validarCPF(cpf) {
    if (!cpf) return false;
    const c = cpf.replace(/\D/g, '');
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

// Valida telefone brasileiro (10 ou 11 dígitos).
export function validarTelefone(telefone) {
    if (!telefone) return false;
    const t = telefone.replace(/\D/g, '');
    return t.length === 10 || t.length === 11;
}

// Valida formato básico de e-mail.
export function validarEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
