import { getSessao } from "./services/authService.js";

// Funcao auto-executavel que roda assim que o script e carregado
(async () => {
  // Pega a sessao atual do usuario via camada de service
  const {
    data: { session },
  } = await getSessao();

  if (!session) {
    // Se NAO houver sessao (usuario nao logado)
    alert("Entre no LabStocker para acessar esta página.");
    window.location.href = "../../index.html";
  }
})();
