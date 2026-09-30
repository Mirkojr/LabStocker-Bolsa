// Utilitario de paginacao reutilizavel para o LabStocker.
//
// Centraliza a logica de paginacao usada nas telas de listagem, evitando
// codigo duplicado e padronizando a navegacao. Suporta dois modos:
//   - Server-side: use calcularRange() para montar o .range() do Supabase.
//   - Client-side: use paginarLista() para recortar um array ja carregado.
// Em ambos os casos, renderPaginador() desenha os controles de navegacao.

export const TAMANHO_PAGINA_PADRAO = 12;

/**
 * Calcula o intervalo [from, to] (0-based, inclusivo) para o .range() do Supabase.
 * @param {number} pagina Pagina atual (comeca em 1).
 * @param {number} tamanho Itens por pagina.
 * @returns {object} Intervalo com as chaves 'from' e 'to' (0-based, inclusivo).
 */
export function calcularRange(pagina = 1, tamanho = TAMANHO_PAGINA_PADRAO) {
  const paginaSegura = Math.max(1, Number(pagina) || 1);
  const from = (paginaSegura - 1) * tamanho;
  const to = from + tamanho - 1;
  return { from, to };
}

/**
 * Calcula o total de paginas a partir do total de itens.
 * @param {number} totalItens Total de itens (todas as paginas).
 * @param {number} tamanho Itens por pagina.
 */
export function totalPaginas(totalItens, tamanho = TAMANHO_PAGINA_PADRAO) {
  return Math.max(1, Math.ceil((Number(totalItens) || 0) / tamanho));
}

/**
 * Recorta um array para a pagina atual (paginacao no cliente).
 * @param {Array} lista Lista completa ja carregada.
 * @param {number} pagina Pagina atual (1-based).
 * @param {number} tamanho Itens por pagina.
 */
export function paginarLista(lista, pagina = 1, tamanho = TAMANHO_PAGINA_PADRAO) {
  const { from } = calcularRange(pagina, tamanho);
  return (lista || []).slice(from, from + tamanho);
}

/**
 * Cria (uma unica vez) e devolve um container para os controles de paginacao,
 * inserido logo apos o elemento de lista informado. Reaproveita o container
 * se ele ja existir.
 * @param {HTMLElement} elementoLista Elemento de lista que tera o paginador abaixo.
 * @param {string} id Id unico para o container do paginador.
 * @returns {HTMLElement|null}
 */
export function garantirContainerPaginador(elementoLista, id) {
  if (!elementoLista) return null;
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement("div");
    container.id = id;
    container.className = "d-flex justify-content-center mt-4";
    elementoLista.insertAdjacentElement("afterend", container);
  }
  return container;
}

/**
 * Renderiza um paginador (estilo Bootstrap) dentro do container informado.
 * Reconstroi o conteudo a cada chamada. Nao renderiza nada quando ha apenas
 * uma pagina.
 * @param {HTMLElement} container Container onde o paginador sera desenhado.
 * @param {object} opcoes
 * @param {number} opcoes.paginaAtual Pagina atual (1-based).
 * @param {number} opcoes.totalItens Total de itens (todas as paginas).
 * @param {number} [opcoes.tamanhoPagina] Itens por pagina.
 * @param {(pagina:number)=>void} opcoes.aoMudarPagina Callback ao trocar de pagina.
 */
export function renderPaginador(
  container,
  { paginaAtual = 1, totalItens = 0, tamanhoPagina = TAMANHO_PAGINA_PADRAO, aoMudarPagina } = {}
) {
  if (!container) return;

  const paginas = totalPaginas(totalItens, tamanhoPagina);
  container.innerHTML = "";
  if (paginas <= 1) return;

  const paginaSegura = Math.min(Math.max(1, paginaAtual), paginas);

  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Navegação de páginas");

  const ul = document.createElement("ul");
  ul.className = "pagination mb-0";

  const criarItem = (rotulo, destino, { desabilitado = false, ativo = false, aria } = {}) => {
    const li = document.createElement("li");
    li.className = `page-item${desabilitado ? " disabled" : ""}${ativo ? " active" : ""}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-link";
    btn.innerHTML = rotulo;
    if (aria) btn.setAttribute("aria-label", aria);
    if (ativo) li.setAttribute("aria-current", "page");

    if (desabilitado) {
      btn.tabIndex = -1;
      btn.setAttribute("aria-disabled", "true");
    } else {
      btn.addEventListener("click", () => {
        if (destino !== paginaSegura && typeof aoMudarPagina === "function") {
          aoMudarPagina(destino);
        }
      });
    }

    li.appendChild(btn);
    return li;
  };

  // Botao anterior
  ul.appendChild(
    criarItem('<i class="bi bi-chevron-left"></i>', paginaSegura - 1, {
      desabilitado: paginaSegura === 1,
      aria: "Página anterior",
    })
  );

  // Janela de no maximo 5 botoes numericos, centrada na pagina atual
  const MAX_BOTOES = 5;
  let inicio = Math.max(1, paginaSegura - Math.floor(MAX_BOTOES / 2));
  const fim = Math.min(paginas, inicio + MAX_BOTOES - 1);
  inicio = Math.max(1, fim - MAX_BOTOES + 1);

  if (inicio > 1) {
    ul.appendChild(criarItem("1", 1));
    if (inicio > 2) ul.appendChild(criarItem("\u2026", inicio - 1, { desabilitado: true }));
  }

  for (let p = inicio; p <= fim; p++) {
    ul.appendChild(criarItem(String(p), p, { ativo: p === paginaSegura }));
  }

  if (fim < paginas) {
    if (fim < paginas - 1) ul.appendChild(criarItem("\u2026", fim + 1, { desabilitado: true }));
    ul.appendChild(criarItem(String(paginas), paginas));
  }

  // Botao proximo
  ul.appendChild(
    criarItem('<i class="bi bi-chevron-right"></i>', paginaSegura + 1, {
      desabilitado: paginaSegura === paginas,
      aria: "Próxima página",
    })
  );

  nav.appendChild(ul);
  container.appendChild(nav);
}
