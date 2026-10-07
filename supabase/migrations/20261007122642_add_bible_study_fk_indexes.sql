create index if not exists idx_bible_original_tokens_lexicon_entry on public.bible_original_tokens (lexicon_entry_id) where lexicon_entry_id is not null;
create index if not exists idx_bible_commentaries_source on public.bible_commentaries (source_code);
