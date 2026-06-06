-- 1. Função que cria o perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, sobrenome, tipo_identificador, identificador, id_laboratorio, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo'),
    COALESCE(NEW.raw_user_meta_data->>'sobrenome', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'tipo_identificador', 'email'),
    COALESCE(NEW.raw_user_meta_data->>'identificador', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'id_laboratorio', '')::uuid,
    false
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger que dispara a função quando um usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();