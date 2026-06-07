-- Migração: gravar o email do auth.users em public.perfis
-- Rode este script no SQL Editor do Supabase (uma vez).

-- 1. Adiciona a coluna email (idempotente)
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS email text;

-- (Opcional) garantir e-mail único por perfil:
-- ALTER TABLE public.perfis ADD CONSTRAINT perfis_email_key UNIQUE (email);

-- 2. Backfill: preenche o email dos perfis já existentes a partir do auth.users
UPDATE public.perfis p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR p.email = '');

-- 3. Recria a função do trigger já gravando o email nos novos cadastros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, sobrenome, tipo_identificador, identificador, id_laboratorio, is_admin, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo'),
    COALESCE(NEW.raw_user_meta_data->>'sobrenome', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'tipo_identificador', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'identificador', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_laboratorio', '')::uuid,
    false,
    NEW.email
  );
  RETURN NEW;
END;
$$;
