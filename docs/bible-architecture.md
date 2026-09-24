# Bíblia ADPEL 2.0

## Modelo

- `bible_books` é o catálogo canônico dos 66 livros. O identificador (`GEN`, `EXO`, `JHN` etc.) é estável; `name_pt` é o nome exibido; `aliases` resolve buscas sem criar livros duplicados.
- `bible_translations` registra versão, provider, licença, atribuição, fonte, status e tipo (`local` ou `external`). Somente uma versão pode ser default.
- `bible_verses` contém todas as versões locais. A referência canônica é `translation_id + book_id + chapter + verse`; `book` foi mantido para compatibilidade. Linhas históricas repetidas ficam preservadas com `is_canonical = false`.
- A leitura usa um provider local para `bible_verses`. Um provider externo futuro deve expor `window.ADPELBibleProviders[nome].getChapter({ translation, book, chapter })` e retornar `{ book_id, chapter, verse, text }[]`.
- A mesma seleção abastece estudo pessoal e a integração futura: `window.ADPELBible.getSelectionPayload()` retorna tradução, livro, capítulo, intervalo e texto. Nenhuma IA/Tutor foi implementada.

## Traduções e direitos

| Código | Situação | Fonte/licença |
|---|---|---|
| `acf` | Local, ativa e default. 31.105 linhas físicas; 31.102 referências canônicas. Nenhum texto alterado ou removido. | Acervo já autorizado pelo responsável do projeto; aviso: “Utilizada na ADPEL mediante autorização.” |
| `onbv` | Local, completa e ativa; classificação A. 66 livros, 1.189 capítulos e 31.105 referências. | Pacote oficial Open.Bible/Biblica, CC BY-SA 4.0; aviso integral, origem e ShareAlike preservados. |
| `blivre` | Local, completa e inativa; classificação B. 66 livros, 1.189 capítulos e 31.102 referências. | eBible `porbr2018`, CC BY 4.0. A própria fonte declara que o texto é trabalho em andamento; requer avaliação editorial antes de ativação. |

O inventário legal/técnico completo, hashes dos pacotes e motivos para não ativar outras candidatas estão em [bible-translations.md](bible-translations.md).

Downloads ou textos encontrados na internet nunca devem ser ativados só pelo nome. Antes da importação, confira a fonte primária, a licença da edição exata, os 66 livros (quando aplicável), 1.189 capítulos, referências duplicadas/vazias e amostras do texto.

## Adicionar tradução local

1. Obtenha autorização/licença e guarde a URL oficial e o aviso exigido.
2. Registre fonte, versão, hash, licença e avisos integrais em `scripts/bible-translation-sources.json`.
3. Extraia o pacote USFM fora do repositório; pacotes e derivados não são versionados.
4. Valide sem credenciais:
   `node scripts/import-bible-translation.mjs --source DIRETORIO --translation CODIGO --archive PACOTE.zip --validate-only`.
5. Para uma operação via Supabase autenticado, gere lotes idempotentes fora do Git com `--sql-dir DIRETORIO`; alternativamente use `--import` com os segredos somente no ambiente seguro.
6. A tradução nasce inativa. Confira banco, amostras, seletor, busca, direitos e RLS; somente uma fonte classe A pode então ser ativada.

O importador lê JSON canônico legado ou diretórios USFM. Remove notas, referências cruzadas e headings editoriais; preserva texto de parágrafos, poesia, listas e marcadores de ênfase. Ele interrompe diante de marcador desconhecido ou versificação composta não suportada, em vez de perder palavras silenciosamente. Valida metadados, UTF-8, catálogo, ordem lógica, capítulos, referências, duplicatas, vazios, encoding, HTML/USFM residual, checksum e dez capítulos-amostra. A carga é reexecutável e para em conflito textual inesperado.

## Dados pessoais e progresso

`bible_highlights`, `bible_notes`, `bible_bookmarks`, `bible_reading_progress`, `bible_completed_books` e `user_bible_preferences` usam RLS por `auth.uid() = user_id`. Não existe bypass para master. Visitantes só leem conteúdo bíblico ativo e guardam tamanho de fonte/última posição localmente.

Abrir um capítulo não o marca como lido. A primeira marca cria uma linha; desmarcar muda `is_read` sem apagá-la, preservando `first_read_at` contra XP repetido. A conclusão de livro deriva de todos os capítulos lidos e `bible_completed_books` impede prêmio repetido.

## Futuro

Comparação de versões pode consultar várias traduções pela mesma referência canônica. Providers externos devem ficar atrás do adapter e nunca expor segredo no navegador. Offline completo foi adiado: Auth, dados pessoais e chamadas Supabase continuam fora do cache do service worker.
