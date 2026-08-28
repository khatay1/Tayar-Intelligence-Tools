-- Sprint 14: public website publishing bucket.
-- Website files are public to read, while authenticated users may only manage
-- objects stored inside their own user-id folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('published-sites', 'published-sites', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can view own published site objects" ON storage.objects;
CREATE POLICY "Users can view own published site objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'published-sites'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can upload own published site objects" ON storage.objects;
CREATE POLICY "Users can upload own published site objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'published-sites'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can update own published site objects" ON storage.objects;
CREATE POLICY "Users can update own published site objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'published-sites'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'published-sites'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete own published site objects" ON storage.objects;
CREATE POLICY "Users can delete own published site objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'published-sites'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);
