import {
  formatarCPF,
  formatarQuantidade,
  formatarTelefone,
} from "../../shared/utils/formatters.js";
import { escapeHtml } from "../../shared/utils/dom.js";
import {
  buscarProjetoPorId,
  salvarMinuta,
  aprovarProjeto,
  recusarProjeto,
  enviarDocumento,
  gerarSignedUrl,
} from "../../shared/services/projetosService.js";

const params = new URLSearchParams(window.location.search);
const projetoId = params.get("id");

let dadosProjetoAtual = null;

const NAO_INFORMADO = "Não informado";

// A etapa 2 (aprovação final) aparece como prévia desde o início e vira o
// formulário de upload depois que a minuta é gerada.
function mostrarEtapaAprovacao() {
  document.getElementById("area-upload-pdf").classList.remove("d-none");
  document.getElementById("previa-aprovacao")?.classList.add("d-none");
}

function formatarUnidade(unidade) {
  if (!unidade) return "";
  const u = unidade.toLowerCase().trim();
  if (u === "ml") return "mL";
  if (u === "l") return "L";
  return unidade;
}

function loadFile(url, callback) {
  PizZipUtils.getBinaryContent(url, callback);
}

// ==========================================
// 1. CARREGAR DADOS DO PROJETO
// ==========================================
async function carregarDetalhes() {
  if (!projetoId) {
    alert("ID do projeto não fornecido.");
    return;
  }

  const { data, error } = await buscarProjetoPorId(projetoId);

  if (error) {
    console.error(error);
    alert("Erro ao buscar projeto.");
    return;
  }

  dadosProjetoAtual = data;

  // --- Preencher Dados do Requerente ---
  document.getElementById("view-nome").textContent = data.responsavel_nome || NAO_INFORMADO;
  document.getElementById("view-cpf").textContent = data.responsavel_cpf
    ? formatarCPF(data.responsavel_cpf)
    : NAO_INFORMADO;
  document.getElementById("view-siape").textContent = data.responsavel_siape || NAO_INFORMADO;
  document.getElementById("view-email").textContent = data.responsavel_email || NAO_INFORMADO;
  document.getElementById("view-telefone").textContent = data.responsavel_telefone
    ? formatarTelefone(data.responsavel_telefone)
    : NAO_INFORMADO;
  document.getElementById("view-titulo").textContent = data.titulo_projeto || NAO_INFORMADO;
  document.getElementById("view-financiador").textContent = data.orgao_financiador || NAO_INFORMADO;
  document.getElementById("view-registro").textContent = data.registro_numero || NAO_INFORMADO;
  document.getElementById("view-periodo").textContent = data.periodo_execucao || NAO_INFORMADO;
  document.getElementById("view-lab-nome").textContent = data.lab_nome || NAO_INFORMADO;
  document.getElementById("view-lab-sipac").textContent = data.lab_sipac || NAO_INFORMADO;

  const listaProd = document.getElementById("view-produtos");
  listaProd.innerHTML = "";
  if (data.produtos) {
    data.produtos.forEach((prod, index) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.innerHTML = `<span><strong>${index + 1}.</strong> ${escapeHtml(prod.nome)}</span><span class="badge bg-secondary rounded-pill">${escapeHtml(formatarQuantidade(prod.quantidade, formatarUnidade(prod.unidade)))}</span>`;
      listaProd.appendChild(li);
    });
  }

  // --- Lógica da Área Administrativa ---

  // Preenche o formulário se já houver dados salvos
  if (data.cargo_responsavel) document.getElementById("admin-cargo").value = data.cargo_responsavel;
  if (data.departamento_responsavel)
    document.getElementById("admin-depto").value = data.departamento_responsavel;
  if (data.unidade_academica)
    document.getElementById("admin-unidade").value = data.unidade_academica;
  if (data.local_atividades)
    document.getElementById("admin-local-ativ").value = data.local_atividades;
  if (data.depto_atividades)
    document.getElementById("admin-depto-ativ").value = data.depto_atividades;
  if (data.orgao_controlador) document.getElementById("admin-orgao").value = data.orgao_controlador;

  if (data.status === "aprovado") {
    // MODO LEITURA (aprovado)
    document.getElementById("admin-area-pendente").classList.add("d-none");
    document.getElementById("admin-area-aprovado").classList.remove("d-none");

    document.getElementById("read-cargo").textContent = data.cargo_responsavel;
    document.getElementById("read-depto").textContent = data.departamento_responsavel;
    document.getElementById("read-unidade").textContent = data.unidade_academica;

    if (data.pdf_assinado_url) {
      const { data: signedPdf } = await gerarSignedUrl(data.pdf_assinado_url);
      document.getElementById("btn-ver-pdf").href = signedPdf?.signedUrl || "#";
    }
    if (data.documento_url) {
      const { data: signedDocx } = await gerarSignedUrl(data.documento_url);
      document.getElementById("btn-ver-docx").href = signedDocx?.signedUrl || "#";
    }
  } else if (data.status === "recusado") {
    // MODO LEITURA (recusado)
    document.getElementById("admin-area-pendente").classList.add("d-none");
    document.getElementById("admin-area-recusado").classList.remove("d-none");
    document.getElementById("read-motivo").textContent = data.motivo_recusa || "-";
  } else {
    // MODO EDIÇÃO (pendente)
    document.getElementById("admin-area-pendente").classList.remove("d-none");

    // Se já existe um DOCX gerado (minuta), mostra o upload do PDF
    if (data.documento_url) {
      mostrarEtapaAprovacao();
    }
  }
}

// ==========================================
// 2. PASSO 1: GERAR MINUTA DOCX
// ==========================================
document.getElementById("form-gerar-minuta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-gerar-doc");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';

  try {
    const adminData = {
      cargo: document.getElementById("admin-cargo").value,
      departamento: document.getElementById("admin-depto").value,
      unidade: document.getElementById("admin-unidade").value,
      local_ativ: document.getElementById("admin-local-ativ").value,
      depto_ativ: document.getElementById("admin-depto-ativ").value,
      orgao: document.getElementById("admin-orgao").value,
    };

    let produtosFormatados = [];
    if (dadosProjetoAtual.produtos) {
      produtosFormatados = dadosProjetoAtual.produtos.map((item, index) => ({
        nomenclatura: item.nome,
        quantidade: item.quantidade,
        unidade: formatarUnidade(item.unidade),
        i: index + 1,
      }));
    }

    loadFile("../../modelos/modelo_oficio.docx", async function (error, content) {
      try {
        if (error) throw error;

        const zip = new PizZip(content);
        const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        const hoje = new Date();
        const meses = [
          "Janeiro",
          "Fevereiro",
          "Março",
          "Abril",
          "Maio",
          "Junho",
          "Julho",
          "Agosto",
          "Setembro",
          "Outubro",
          "Novembro",
          "Dezembro",
        ];

        doc.render({
          cargo: adminData.cargo,
          departamento: adminData.departamento,
          unidade_academica: adminData.unidade,
          local_atividades: adminData.local_ativ,
          departamento_atividades: adminData.depto_ativ,
          orgao_controlador: adminData.orgao,
          responsavel: dadosProjetoAtual.responsavel_nome,
          cpf_responsavel: formatarCPF(dadosProjetoAtual.responsavel_cpf),
          nome_projeto: dadosProjetoAtual.titulo_projeto,
          financiador: dadosProjetoAtual.orgao_financiador,
          numero_projeto: dadosProjetoAtual.registro_numero,
          local: "Fortaleza",
          dia: hoje.getDate(),
          mes: meses[hoje.getMonth()],
          ano: hoje.getFullYear(),
          itens: produtosFormatados,
        });

        const out = doc.getZip().generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        saveAs(out, `Minuta_${projetoId}.docx`);

        const nomeArquivo = `minuta_${projetoId}_${Date.now()}.docx`;
        const { data: uploadData, error: uploadError } = await enviarDocumento(nomeArquivo, out);
        if (uploadError) throw uploadError;

        // Salva apenas os dados e o docx, SEM aprovar
        const { error: updateError } = await salvarMinuta(projetoId, {
          documento_url: uploadData.path,
          dadosAdmin: adminData,
        });
        if (updateError) throw updateError;

        alert("Minuta gerada e baixada! Assine o documento e faça o upload do PDF abaixo.");
        mostrarEtapaAprovacao();
      } catch (innerErr) {
        console.error(innerErr);
        alert("Erro: " + innerErr.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  } catch (err) {
    console.error(err);
    alert("Erro: " + err.message);
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// ==========================================
// 3. PASSO 2: UPLOAD PDF E APROVAR
// ==========================================
document.getElementById("form-upload-pdf").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-finalizar");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';

  const fileInput = document.getElementById("input-pdf");
  const file = fileInput.files[0];

  if (!file) {
    alert("Selecione um arquivo PDF.");
    btn.disabled = false;
    btn.innerHTML = originalText;
    return;
  }

  try {
    const nomeArquivo = `aprovado_${projetoId}_${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await enviarDocumento(nomeArquivo, file);
    if (uploadError) throw uploadError;

    const { error: updateError } = await aprovarProjeto(projetoId, uploadData.path);
    if (updateError) throw updateError;

    alert("Sucesso! Projeto aprovado e PDF disponibilizado.");
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert("Erro ao enviar PDF: " + err.message);
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// ==========================================
// 4. RECUSAR SOLICITAÇÃO
// ==========================================
const btnRecusar = document.getElementById("btn-recusar");
if (btnRecusar) {
  btnRecusar.addEventListener("click", async () => {
    const motivo = prompt("Informe o motivo da recusa (será mostrado ao requerente):");
    if (motivo === null) return; // cancelou
    if (!motivo.trim()) {
      alert("O motivo é obrigatório para recusar a solicitação.");
      return;
    }

    const originalText = btnRecusar.innerHTML;
    btnRecusar.disabled = true;
    btnRecusar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Recusando...';

    try {
      const { error } = await recusarProjeto(projetoId, motivo.trim());
      if (error) throw error;
      alert("Solicitação recusada.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Erro ao recusar: " + err.message);
      btnRecusar.disabled = false;
      btnRecusar.innerHTML = originalText;
    }
  });
}

document.addEventListener("DOMContentLoaded", carregarDetalhes);
