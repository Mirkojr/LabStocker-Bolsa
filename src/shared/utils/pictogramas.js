// Pictogramas de perigo no estilo do GHS: losango de borda vermelha com o
// símbolo em preto, o mesmo formato dos rótulos dos frascos. Desenhos
// simplificados, para identificar o tipo de resíduo de relance.
import { escapeHtml } from "./dom.js";
import { formatarTipoPerigo } from "./formatters.js";

const SIMBOLOS = {
  // Chama
  Inflamavel: `
    <path d="M50 24c7 12 17 17 16 33-1 12-8 19-16 19s-16-6-16-17c0-9 6-13 8-21 3 6 4 9 7 11 2-7-1-16 1-25z" fill="#1b2a36"/>
    <path d="M33 79h34" stroke="#1b2a36" stroke-width="4" stroke-linecap="round"/>`,
  // Caveira com ossos cruzados
  Toxico: `
    <path d="M33 62l34 16M67 62L33 78" stroke="#1b2a36" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="42" r="14" fill="#1b2a36"/>
    <rect x="42" y="49" width="16" height="10" rx="2" fill="#1b2a36"/>
    <circle cx="45" cy="42" r="3.5" fill="#fff"/>
    <circle cx="55" cy="42" r="3.5" fill="#fff"/>`,
  // Corrosão: frasco derramando gotas sobre uma superfície
  Corrosivo: `
    <rect x="45" y="20" width="10" height="24" rx="3" transform="rotate(-35 50 32)" fill="none" stroke="#1b2a36" stroke-width="3.5"/>
    <path d="M44 50c3 4 4 6 0 8-4-2-3-4 0-8zM54 55c3 4 4 6 0 8-4-2-3-4 0-8z" fill="#1b2a36"/>
    <path d="M30 70h40v7H56l-3-4-3 4-3-4-3 4H30z" fill="#1b2a36"/>`,
  // Risco biológico
  Biologico: `
    <circle cx="50" cy="42" r="10" fill="none" stroke="#1b2a36" stroke-width="4.5"/>
    <circle cx="41" cy="58" r="10" fill="none" stroke="#1b2a36" stroke-width="4.5"/>
    <circle cx="59" cy="58" r="10" fill="none" stroke="#1b2a36" stroke-width="4.5"/>
    <circle cx="50" cy="53" r="4" fill="#1b2a36"/>`,
  // Exclamação (outro perigo ou mistura)
  Outro: `
    <rect x="45.5" y="28" width="9" height="30" rx="3" fill="#1b2a36"/>
    <circle cx="50" cy="68" r="5.5" fill="#1b2a36"/>`,
};

export function pictogramaPerigo(tipo, tamanho = 44) {
  const simbolo = SIMBOLOS[tipo] || SIMBOLOS.Outro;
  const rotulo = escapeHtml(`Perigo: ${formatarTipoPerigo(tipo)}`);
  return `<svg class="pictograma-perigo" width="${tamanho}" height="${tamanho}" viewBox="0 0 100 100" role="img" aria-label="${rotulo}">
      <title>${rotulo}</title>
      <path d="M50 4L96 50 50 96 4 50z" fill="#fff" stroke="#d7261e" stroke-width="7" stroke-linejoin="round"/>
      ${simbolo}
    </svg>`;
}
