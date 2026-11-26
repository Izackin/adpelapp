BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE POLICY adpel_images_extension_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id NOT IN ('avatars','community-media') OR lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) IN ('jpg','jpeg','png','webp'));
CREATE POLICY adpel_images_extension_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (true)
WITH CHECK (bucket_id NOT IN ('avatars','community-media') OR lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) IN ('jpg','jpeg','png','webp'));
COMMIT;
