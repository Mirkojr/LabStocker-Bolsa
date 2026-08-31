// Liga os botões +/- de um "stepper" de quantidade a um <input type="number">.
// Resolve o problema das setinhas nativas do input number, que são minúsculas
// e pouco clicáveis (principalmente no celular).
//
// Espera a seguinte estrutura HTML dentro de `container`:
//   <div class="qty-stepper">
//     <button type="button" class="qty-btn qty-btn-minus">...</button>
//     <input type="number" class="qty-input">
//     <button type="button" class="qty-btn qty-btn-plus">...</button>
//   </div>
//
// O input continua editável por digitação direta; os botões só somam/subtraem
// o "passo" configurado e respeitam min/max.

export function criarStepperQuantidade(container, { passo = 1, min = 0.01, max = null } = {}) {
  if (!container) return null;

  const input = container.querySelector(".qty-input");
  const btnMenos = container.querySelector(".qty-btn-minus");
  const btnMais = container.querySelector(".qty-btn-plus");
  if (!input || !btnMenos || !btnMais) return null;

  // Evita erros de ponto flutuante tipo 0.1 + 0.2 = 0.30000000000000004
  function arredondar(valor) {
    return Math.round(valor * 100) / 100;
  }

  function limitar(valor) {
    let v = valor;
    if (min !== null && v < min) v = min;
    if (max !== null && v > max) v = max;
    return arredondar(v);
  }

  function atualizarEstadoBotoes() {
    const atual = parseFloat(input.value) || 0;
    btnMenos.disabled = min !== null && atual <= min;
    btnMais.disabled = max !== null && atual >= max;
  }

  function alterar(delta) {
    const atual = parseFloat(input.value) || 0;
    const novo = limitar(atual + delta);
    input.value = novo;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    atualizarEstadoBotoes();
  }

  btnMenos.addEventListener("click", () => alterar(-passo));
  btnMais.addEventListener("click", () => alterar(passo));
  input.addEventListener("input", atualizarEstadoBotoes);
  input.addEventListener("blur", () => {
    if (input.value === "") return;
    input.value = limitar(parseFloat(input.value) || 0);
    atualizarEstadoBotoes();
  });

  atualizarEstadoBotoes();

  return {
    // Permite reconfigurar min/max dinamicamente (ex: ao trocar de item
    // selecionado no modal de consumo, onde o máximo é o saldo em estoque).
    setLimites(novoMin, novoMax) {
      min = novoMin;
      max = novoMax;
      atualizarEstadoBotoes();
    },
    atualizarEstadoBotoes,
  };
}
