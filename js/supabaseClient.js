// Este é o nosso "módulo" central
// Importamos a função createClient da biblioteca global do Supabase
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2";

const SUPABASE_URL = 'https://tnhjibckjzjthgmlpimw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuaGppYmNranpqdGhnbWxwaW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTI4NjEsImV4cCI6MjA3ODA4ODg2MX0.R3pw9Xmxj-Q2F9JWTNz-Bjh-aFftvoxDefLKKhDCllQ';

// Criamos e EXPORTAMOS o cliente
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Nota: Tive que usar uma URL completa no import acima porque 
// não estamos usando um gerenciador de pacotes (npm).
// O 'supabase' global do CDN não funciona bem com módulos.