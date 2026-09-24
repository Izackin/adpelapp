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
| `onbv` | Validada como candidata, não importada. O pacote oficial conferido contém 66 arquivos, 1.189 capítulos e 31.105 marcadores de versículo. | Open.Bible/Biblica, CC BY-SA 4.0; exige o aviso integral de copyright, atribuição, fonte e ShareAlike. |
| Almeida 1911 | Candidata, não importada. | Project Gutenberg #62383 / edição de 1911 em domínio público; ainda requer transformação e validação estrutural completa antes da carga. |
| Bíblia Livre/JFAAL | Pendentes. | Não foram importadas porque a fonte primária, edição exata e obrigações de atribuição não foram fechadas nesta etapa. |

Downloads ou textos encontrados na internet nunca devem ser ativados só pelo nome. Antes da importação, confira a fonte primária, a licença da edição exata, os 66 livros (quando aplicável), 1.189 capítulos, referências duplicadas/vazias e amostras do texto.

## Adicionar tradução local

1. Obtenha autorização/licença e guarde a URL oficial e o aviso exigido.
2. Converta a fonte sem reescrever o texto para JSON UTF-8:
   `{"metadata": {...}, "verses": [{"book_id":"GEN","chapter":1,"verse":1,"text":"..."}]}`.
3. Defina `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente seguro do operador. A chave nunca pertence ao frontend.
4. Execute primeiro `node scripts/import-bible-translation.mjs arquivo.json --validate-only`.
5. Execute sem `--validate-only`. A tradução nasce inativa; confira contagens, capítulos, duplicatas, encoding, amostras e direitos antes de ativar.

O importador valida metadados legais, livros, limites de capítulos, referências, texto vazio e duplicatas; a carga é reexecutável por referência canônica. O dataset não deve ser versionado se a licença não permitir redistribuição.

## Dados pessoais e progresso

`bible_highlights`, `bible_notes`, `bible_bookmarks`, `bible_reading_progress`, `bible_completed_books` e `user_bible_preferences` usam RLS por `auth.uid() = user_id`. Não existe bypass para master. Visitantes só leem conteúdo bíblico ativo e guardam tamanho de fonte/última posição localmente.

Abrir um capítulo não o marca como lido. A primeira marca cria uma linha; desmarcar muda `is_read` sem apagá-la, preservando `first_read_at` contra XP repetido. A conclusão de livro deriva de todos os capítulos lidos e `bible_completed_books` impede prêmio repetido.

## Futuro

Comparação de versões pode consultar várias traduções pela mesma referência canônica. Providers externos devem ficar atrás do adapter e nunca expor segredo no navegador. Offline completo foi adiado: Auth, dados pessoais e chamadas Supabase continuam fora do cache do service worker.
