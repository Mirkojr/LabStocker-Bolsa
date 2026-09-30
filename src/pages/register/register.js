import { criarPerfilUsuario } from "../../shared/services/perfisService.js";

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
      // Cria o usuario no Auth; o perfil e criado pelo trigger do banco.
      // O acesso a um laboratorio e concedido depois pelo chefe ou gestor.
      const { error: profileError } = await criarPerfilUsuario(email, senha, {
        nome: nome,
        sobrenome: sobrenome,
        identificador: identificador,
        tipo_identificador: tipoIdentificador,
      });

      if (profileError) throw profileError;

      // SUCESSO!
      alert(
        "Cadastro realizado! Para acessar um laboratorio, peca ao chefe (ou a um gestor) " +
          "para adicionar voce pelo e-mail informado. Voce sera redirecionado para o login."
      );
      window.location.href = "../../index.html";
    } catch (error) {
      console.error("Erro no cadastro:", error.message);
      alert("Erro no cadastro: " + error.message);
    }
  });
});
