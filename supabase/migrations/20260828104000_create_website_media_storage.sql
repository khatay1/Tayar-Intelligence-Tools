/*
# Website Builder media library

Creates a public image bucket for published website assets while keeping
upload/update/delete access scoped to each authenticated user's own folder.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-media',
  'website-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "website_media_select_own" ON storage.objects;
CREATE POLICY "website_media_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'website-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "website_media_insert_own" ON storage.objects;
CREATE POLICY "website_media_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'website-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "website_media_update_own" ON storage.objects;
CREATE POLICY "website_media_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'website-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'website-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "website_media_delete_own" ON storage.objects;
CREATE POLICY "website_media_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'website-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
