DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.bible_verses'::regclass AND i.indisvalid AND i.indisready AND c.relname IN ('bible_book_idx','bible_chapter_idx','bible_verse_idx','bible_text_idx','idx_bible_text','bible_verses_reference_variant_uidx','bible_verses_chapter_lookup_idx');
 IF n<>7 THEN RAISE EXCEPTION 'required Bible indexes missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.bible_verses'::regclass AND c.relname IN ('idx_bible_book','idx_bible_chapter','idx_bible_verse','idx_bible_search')) THEN RAISE EXCEPTION 'duplicate index remains'; END IF;
END $test$;
SELECT 'Bible index cleanup: PASS' AS result;
