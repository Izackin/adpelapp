DO $test$
DECLARE n integer; bad integer; good integer;
BEGIN
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('adpel_images_extension_insert_guard','adpel_images_extension_update_guard') AND permissive='RESTRICTIVE' AND 'authenticated'=ANY(roles);
 IF n<>2 THEN RAISE EXCEPTION 'missing restrictive guards'; END IF;
 SELECT count(*) FILTER (WHERE accepted AND NOT expected),count(*) FILTER (WHERE NOT accepted AND expected) INTO bad,good FROM (
 SELECT expected, (bucket NOT IN ('avatars','community-media') OR lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) IN ('jpg','jpeg','png','webp')) accepted FROM (VALUES
 ('avatars','u/image.webp',true),('avatars','u/image.JPG',true),('avatars','u/image.svg',false),('avatars','u/file.html',false),('community-media','u/image.png',true),('community-media','u/script.js',false),('community-media','u/file',false),('library-files','book.pdf',true)) v(bucket,name,expected)
 ) checked;
 IF bad<>0 OR good<>0 THEN RAISE EXCEPTION 'extension guard mismatch'; END IF;
END $test$;
SELECT 'storage policy definitions: PASS' AS result;
