import { buscarIdPorSipac } from "../../shared/services/laboratoriosService.js";
import { criarPerfilUsuario } from "../../shared/services/perfisService.js";

console.log("register.js carregado");

// --- LOGICA DE CADASTRO ---

document.addEventListener("DOMContentLoaded", () => {
  const formRegister = document.getElementById("form-register");

  formRegister.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    // Coletar todos os dados do formulario
    const email = document.getElementById("register-email").value;
    const senha = document.getElementById("register-senha").value;
    const confirmarSenha = document.getElementById("register-confirmar-senha").value;
    const nome = document.getElementById("register-nome").value;
    const sobrenome = document.getElementById("register-sobrenome").value;
    const codigoSipac = document.getElementById("register-sipac").value;
    const identificador = document.getElementById("register-identificador").value;

    // Pega o valor do botao de radio (SIAPE ou MATRICULA)
    const tipoIdentificador = document.querySelector(
      'input[name="tipo_identificador"]:checked'
    )?.value;

    // --- VALIDACOES INICIAIS ---
    if (senha !== confirmarSenha) {
      alert("As senhas nao coincidem!");
      return;
    }
    if (!tipoIdentificador) {
      alert("Por favor, selecione se e Tecnico ou Aluno.");
      return;
    }

    try {
      // --- ETAPA 1: Encontrar o ID do Laboratorio usando o Codigo SIPAC ---
      const { data: labData, error: labError } = await buscarIdPorSipac(codigoSipac);

      if (labError || !labData) {
        throw new Error("Codigo SIPAC do laboratorio nao encontrado ou invalido.");
      }

      const laboratorioId = labData.id; // UUID do laboratorio

      // --- ETAPA 2 e 3: Criar o usuario no Auth e o perfil vinculado ---
      const { error: profileError } = await criarPerfilUsuario(email, senha, {
        nome: nome,
        sobrenome: sobrenome,
        identificador: identificador,
        tipo_identificador: tipoIdentificador,
        id_laboratorio: laboratorioId,
      });

      if (profileError) throw profileError;

      // SUCESSO!
      alert("Cadastro realizado com sucesso! Voce sera redirecionado para o login.");
      window.location.href = "../../index.html";
    } catch (error) {
      console.error("Erro no cadastro:", error.message);
      alert("Erro no cadastro: " + error.message);
    }
  });
});
