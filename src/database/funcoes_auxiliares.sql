CREATE OR REPLACE FUNCTION public.get_my_lab_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id_laboratorio FROM public.perfis WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.am_i_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT is_admin FROM public.perfis WHERE id = auth.uid();
$$;