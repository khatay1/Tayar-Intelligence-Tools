-- Stage 2: deploy the authenticated renderer and migrate published media
-- references first. Keep publication-only copies public, close originals and
-- raw site archives/previews so anonymous clients cannot bypass Tayar routes.
update storage.buckets set public=false where id in ('website-media','published-sites');
update storage.buckets set file_size_limit=5242880,
  allowed_mime_types=array['image/png','image/jpeg','image/webp','image/gif','image/avif','image/svg+xml']
where id='website-media';
