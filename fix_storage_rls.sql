-- Permitir a usuarios autenticados subir archivos al bucket 'avatars'
CREATE POLICY "Avatar upload policy" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Permitir a los usuarios actualizar sus propios archivos en 'avatars'
CREATE POLICY "Avatar update policy" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Permitir a los usuarios eliminar sus propios archivos en 'avatars' (opcional pero recomendado)
CREATE POLICY "Avatar delete policy" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars' AND auth.uid() = owner);
