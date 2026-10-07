# Modo Estudo — Bíblia ADPEL

Nas duas telas (`index.html` e `bible.html`), abra Bíblia → Estudo. Escolha o versículo e toque numa palavra original. O painel apresenta lema quando disponível, transliteração, Strong tradicional e identificador STEP, glossa, morfologia e ocorrências paginadas. A nota pessoal reutiliza a autenticação e o RLS de `bible_notes`. Leitura continua como modo inicial.

## Acervo carregado em 7 de outubro de 2026

| Recurso | Quantidade |
|---|---:|
| Livros | 66 |
| Capítulos | 1.189 |
| Referências de texto original | 31.177 |
| Palavras analisadas | 443.097 |
| Entradas lexicais STEP | 22.716 |
| Códigos morfológicos | 2.565 |
| Referências temáticas editoriais | 16 |
| Comentários introdutórios em rascunho | 4 |

O relatório por livro está em `bible-study-import-report.json`. As 31.177 referências seguem a fonte, incluindo títulos de salmos numerados como 0 e numeração que difere das traduções. Essa contagem não equivale à contagem canônica de versículos da ACF. As ocorrências contam usos individuais, podendo repetir um versículo; agrupam sentidos do Strong tradicional, com paginação de 25 resultados.

## Fontes e tratamento do texto

- Fonte principal: [STEP Bible](https://www.stepbible.org), dados de [STEPBible-Data](https://github.com/STEPBible/STEPBible-Data), CC BY 4.0. Revisão, arquivos exatos e SHA-256 estão em `scripts/bible-study-sources.json`.
- Grego: TAGNT, seleção das palavras principais N/n. Variantes entre parênteses não são misturadas. É o texto marcado pela STEP com sua grafia, pontuação e ordem; não é uma reconstrução exata do TR, NA28 ou de outro aparato crítico. Algumas passagens da ACF diferem, pois sua base textual é distinta.
- Hebraico/aramaico: TAHOT, leitura principal L/Q. Acréscimos X são excluídos. Prefixos, sufixos, pontuação e números estendidos ficam registrados. Um Qere explicitamente vazio é registrado na referência, sem inventar uma palavra. O idioma de cada palavra é identificado pelo código; Daniel 2:4 conserva a transição entre idiomas.
- Léxicos: TBESG/TBESH. A coluna **Meaning do TBESH está excluída**, porque o próprio arquivo exige autorização específica da Online Bible para essas definições. A entrada G2199H, relação pessoal sem lema escrito na fonte, não é tratada como palavra lexical.
- Morfologia: TEGMC/TEHMC, descrições adaptadas a português. Termos técnicos ou não mapeados permanecem como na fonte. O código bruto sempre aparece.
- As glossas portuguesas de `scripts/bible-study-glosses.json` são adaptações editoriais breves, não definições completas nem traduções contextuais. Grande parte do léxico e das glossas ainda fica em inglês, explicitamente identificado. A definição inglesa do TBESG é opcional e exibida como texto, sem executar HTML.
- Alguns identificadores do texto marcado não têm entrada correspondente no léxico desta revisão. Nesses casos, usa-se o lema do próprio texto quando fornecido; a interface informa a ausência de entrada vinculada, conserva Strong/morfologia e não inventa uma definição.

Não existe alinhamento automático com palavras portuguesas. O clique confiável é na palavra original. A glossa não substitui a tradução, e etimologia não determina o sentido de uma passagem.

## Arquitetura e segurança

`js/bible.js` publica o contexto do capítulo; `js/bible-study.js` consulta somente a referência selecionada quando Estudo está ativo. Catálogo das referências, fontes e léxico são reutilizados em memória. Solicitações antigas são descartadas ao mudar livro, versículo ou aba. A lista do estudo reúne referências da tradução e da fonte, incluindo títulos e referências que existem somente na numeração original.

Os dados linguísticos permanecem globais e somente leitura para `anon`/`authenticated`, com grants mínimos e RLS. Todas as sete tabelas da camada possuem RLS. Usuário comum não pode escrever comentários nem acessar rascunhos. `is_admin_master()` é a autorização existente por perfil de servidor; as policies limitam a escrita a `source_code = 'adpel-editorial'` e verificam `USING` e `WITH CHECK`. Notas/destaques/favoritos conservam o isolamento privado existente.

**Admin → Comentários bíblicos** permite criar, editar, excluir, filtrar, paginar e publicar por referência ou intervalo. Os quatro rascunhos assistidos por IA são identificados e não foram publicados como posição da igreja. A identificação é preservada ao editar. Comentários são renderizados como texto escapado; o editor verifica o intervalo contra referências existentes.

O projeto ainda é de uma igreja. Comentários não têm isolamento por congregação; adicionar `tenant_id`/policies e permissões por igreja antes de habilitar gestão editorial num SaaS multi-igrejas. Isso não altera a natureza global dos dados linguísticos.

## Reproduzir a importação

1. Aplique as migrations versionadas de fundação, índices e `bible_study_runtime`, na ordem, em um ambiente que já contenha o catálogo bíblico. Em `adpel-app`, elas já estão aplicadas.
2. Obtenha o repositório STEP fora deste Git e faça checkout da revisão registrada no manifesto.
3. Gere e valide lotes fora deste repositório:

```sh
node scripts/import-bible-study.mjs --source /caminho/STEPBible-Data --sql-dir /caminho/fora-do-git/lotes --scope all
node scripts/import-bible-study.mjs --editorial-sql /caminho/fora-do-git/editorial.sql
```

Também existem os escopos `pilot` (Gênesis 1, João 1, Daniel 2) e `nt`. O programa verifica os hashes antes de analisar, preserva referências alternativas, rejeita duplicações inesperadas e gera SQL com upserts e vínculos retornados por CTE. Execute os lotes em ordem pelo canal administrativo seguro; nunca forneça chave de serviço ao navegador. Confira contagens e amostras antes de registrar a revisão e o relatório em `bible_study_sources.metadata`.

Reexecuções da mesma revisão são idempotentes. Uma atualização para outra revisão precisa de comparação explícita de referências, posições e sobras; o importador não apaga tokens antigos automaticamente. Não considere uma troca de manifesto uma atualização editorial já validada. Rascunhos e referências de seed são reexecutáveis sem substituir conteúdo editado.

## Verificação da entrega

- Testes do importador: seleção sem variantes misturadas, Strong normalizado, raiz/prefixos, idioma aramaico, títulos de salmos, referências concatenadas, exclusão da definição restrita, preservação de glossas com sinais editoriais e morfologia.
- Fluxo DOM com SDK real e chave pública: leitura, interlinear hebraico/grego, transição hebraico/aramaico, título de salmo, referência exclusiva da fonte, léxico, morfologia, concordância com próxima página, privacidade de rascunhos, referências e retorno à leitura.
- Editor em DOM com gravação simulada: edição de rascunho, publicação explícita, preservação de assistência por IA e escape de conteúdo.
- Consultas reais sob papéis `anon` e `authenticated`: leitura pública, nenhuma escrita linguística e recusa de comentário por usuário sem master.
- A suíte geral passou em 18 de 19 arquivos. O teste de cursos pagos falha em `status: 'active'` também no checkout anterior, sem relação com esta entrega.
- A instalação do navegador de teste foi impedida pelo ambiente. O teste DOM verifica o fluxo, mas não substitui a inspeção visual no navegador/dispositivo. O CSS inclui layout flexível, alvos de toque, diálogo rolável e regras para telas pequenas; a inspeção visual permanece pendente.
