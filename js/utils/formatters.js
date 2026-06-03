export function formatarCPF(cpf) {
    if (!cpf) return "-";
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatarTelefone(telefone) {
    if (!telefone) return "-";
    const limpo = telefone.replace(/\D/g, '');
    if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
    if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return telefone;
}
