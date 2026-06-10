// Este é o nosso "módulo" central
// Importamos a função createClient da biblioteca global do Supabase
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';


// Criamos e EXPORTAMOS o cliente
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Nota: Tive que usar uma URL completa no import acima porque 
// não estamos usando um gerenciador de pacotes (npm).
// O 'supabase' global do CDN não funciona bem com módulos.