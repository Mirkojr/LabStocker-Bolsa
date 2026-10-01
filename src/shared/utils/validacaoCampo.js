// Erro de validação mostrado embaixo do campo, e não num toast fora do
// formulário. `alvo` é quem recebe o vermelho, o aria-invalid e o
// aria-describedby: o input ou, num grupo (como os rádios de unidade), o
// elemento do grupo. `erroEl` é o elemento da mensagem (.invalid-feedback).

function idsDescritos(alvo) {
  return new Set((alvo.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
}

export function mostrarErroCampo(alvo, erroEl, mensagem) {
  alvo.classList.add("is-invalid");
  alvo.setAttribute("aria-invalid", "true");
  erroEl.textContent = mensagem;
  erroEl.classList.add("d-block");
  const ids = idsDescritos(alvo);
  ids.add(erroEl.id);
  alvo.setAttribute("aria-describedby", [...ids].join(" "));
}

export function limparErroCampo(alvo, erroEl) {
  alvo.classList.remove("is-invalid");
  alvo.removeAttribute("aria-invalid");
  erroEl.textContent = "";
  erroEl.classList.remove("d-block");
  const ids = idsDescritos(alvo);
  ids.delete(erroEl.id);
  if (ids.size) alvo.setAttribute("aria-describedby", [...ids].join(" "));
  else alvo.removeAttribute("aria-describedby");
}
