// Cria o PRIMEIRO admin do LabStocker.
//
// Uso:
//   npm run criar-admin -- pessoa@ufc.br
//
// Variáveis de ambiente (nunca vão para o front nem para o repositório):
//   SUPABASE_URL               URL do projeto (ou VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  chave service_role do projeto
//   PRIMEIRO_ADMIN_EMAIL       alternativa ao argumento de e-mail
//
// A pessoa precisa já ter conta (cadastro normal pela tela do sistema).
// O banco só aceita se ainda não existir nenhum admin ativo; depois
// disso, admins são gerenciados pela interface.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.argv[2] || process.env.PRIMEIRO_ADMIN_EMAIL || "").trim();

function sair(mensagem) {
  console.error(`Erro: ${mensagem}`);
  process.exit(1);
}

if (!url) sair("defina SUPABASE_URL com a URL do projeto Supabase.");
if (!chave) sair("defina SUPABASE_SERVICE_ROLE_KEY com a chave service_role do projeto.");
if (!email) sair("informe o e-mail: npm run criar-admin -- pessoa@ufc.br");

const supabase = createClient(url, chave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc("criar_primeiro_admin", { p_email: email });

if (error) sair(error.message);

console.log(`Primeiro admin criado: ${email} (registro ${data.id}).`);
