-- Storage policies para o bucket PRIVADO "documentos-projetos".
-- Pre-requisito: crie o bucket em Storage com a opcao "Public" DESMARCADA.
-- Rode este script no SQL Editor do Supabase.
--
-- Regras:
--  * Somente admin (am_i_admin()) faz upload/atualiza os documentos.
--  * Leitura (necessaria para gerar signed URLs): admin OU o dono da
--    solicitacao cujo arquivo corresponde ao documento/pdf salvo.
--
-- Obs.: o nome do objeto (coluna "name") e exatamente o valor salvo em
-- projetos.documento_url / projetos.pdf_assinado_url (uploadData.path).

-- Upload (admin)
DROP POLICY IF EXISTS "Admin envia documentos projetos" ON storage.objects;
CREATE POLICY "Admin envia documentos projetos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-projetos' AND am_i_admin());

-- Atualizacao/sobrescrita (admin)
DROP POLICY IF EXISTS "Admin atualiza documentos projetos" ON storage.objects;
CREATE POLICY "Admin atualiza documentos projetos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-projetos' AND am_i_admin())
  WITH CHECK (bucket_id = 'documentos-projetos' AND am_i_admin());

-- Remocao (admin)
DROP POLICY IF EXISTS "Admin remove documentos projetos" ON storage.objects;
CREATE POLICY "Admin remove documentos projetos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-projetos' AND am_i_admin());

-- Leitura (admin ou dono da solicitacao correspondente)
DROP POLICY IF EXISTS "Ler documentos do proprio projeto ou admin" ON storage.objects;
CREATE POLICY "Ler documentos do proprio projeto ou admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-projetos' AND (
      am_i_admin() OR
      EXISTS (
        SELECT 1 FROM public.projetos p
        WHERE (p.pdf_assinado_url = name OR p.documento_url = name)
          AND (p.user_id = auth.uid() OR p.responsavel_email = auth.email())
      )
    )
  );
