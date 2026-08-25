import { defineConfig } from "vite";
import { resolve, dirname, relative } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

// O vite monta apenas uma página, logo precisamos informar todas as páginas HTML que queremos que ele monte.
// Para isso, vamos percorrer a pasta src e achar todos os arquivos .html, e então criar um objeto de entradas para o vite.
// Cada entrada terá como chave o caminho relativo do arquivo (sem a extensão .html) e como valor o caminho absoluto do arquivo.
// Exemplo: { "pages/index": "/caminho/absoluto/para/src/pages/index.html" }

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "src");

function acharHtml(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const caminho = resolve(dir, item.name);
    if (item.isDirectory()) return acharHtml(caminho);
    return item.name.endsWith(".html") ? [caminho] : [];
  });
}

const entradas = Object.fromEntries(
  acharHtml(raiz).map((arquivo) => [
    relative(raiz, arquivo)
      .replace(/\.html$/, "")
      .replace(/[\\/]/g, "-"),
    arquivo,
  ])
);

export default defineConfig({
  root: "src",
  base: env.GITHUB_ACTIONS ? "/LabStocker-Bolsa/" : "/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: { input: entradas },
  },
});
