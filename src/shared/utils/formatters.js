// Função para formatar CPF brasileiro
// Recebe uma string de CPF (com ou sem formatação) e retorna no formato XXX.XXX.XXX-XX
export function formatarCPF(cpf) {
    if (!cpf) return "-";
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Função para formatar números de telefone brasileiros
// Retorna o número formatado como (XX) XXXXX-XXXX ou (XX) XXXX-XXXX dependendo do comprimento
export function formatarTelefone(telefone) {
    if (!telefone) return "-";
    const limpo = telefone.replace(/\D/g, '');
    if (limpo.length === 11) return limpo.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, "($1) $2 $3-$4");
    if (limpo.length === 10) return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return telefone;
}
