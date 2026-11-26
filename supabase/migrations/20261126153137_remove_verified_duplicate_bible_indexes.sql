BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
-- Fail closed if the expected equivalent index is missing or differs.
DO $guard$
DECLARE pair record; safe boolean;
BEGIN
 FOR pair IN SELECT * FROM (VALUES
  ('idx_bible_book','bible_book_idx'),
  ('idx_bible_chapter','bible_chapter_idx'),
  ('idx_bible_verse','bible_verse_idx'),
  ('idx_bible_search','bible_text_idx')
 ) v(old_name,keep_name)
 LOOP
  SELECT oi.indrelid='public.bible_verses'::regclass AND ki.indrelid=oi.indrelid
    AND oi.indisvalid AND ki.indisvalid AND oi.indisready AND ki.indisready
    AND oi.indislive AND ki.indislive AND NOT oi.indisunique AND NOT ki.indisunique
    AND NOT oi.indisclustered AND NOT oi.indisreplident
    AND oc.reltablespace=kc.reltablespace AND oc.reloptions IS NOT DISTINCT FROM kc.reloptions
    AND regexp_replace(pg_get_indexdef(oi.indexrelid),'^CREATE INDEX [^ ]+ ON ','CREATE INDEX ON ')
       = regexp_replace(pg_get_indexdef(ki.indexrelid),'^CREATE INDEX [^ ]+ ON ','CREATE INDEX ON ')
    AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conindid=oi.indexrelid)
  INTO safe
  FROM pg_class oc JOIN pg_index oi ON oi.indexrelid=oc.oid
  JOIN pg_class kc ON kc.oid=to_regclass('public.'||pair.keep_name)
  JOIN pg_index ki ON ki.indexrelid=kc.oid
  WHERE oc.oid=to_regclass('public.'||pair.old_name);
  IF safe IS DISTINCT FROM true THEN RAISE EXCEPTION 'Duplicate index verification failed: %',pair.old_name; END IF;
 END LOOP;
END $guard$;
DROP INDEX public.idx_bible_book RESTRICT;
DROP INDEX public.idx_bible_chapter RESTRICT;
DROP INDEX public.idx_bible_verse RESTRICT;
DROP INDEX public.idx_bible_search RESTRICT;
COMMIT;
