# Catálogo de traduções bíblicas em português

Inventário inicial de 2026-09-24; ampliação e ativação verificadas no Supabase em 2026-10-07, após o responsável da ADPEL informar autorização e solicitar todas as versões combinadas. A classificação mede licença, proveniência, integridade, maturidade editorial e prontidão técnica; não é avaliação teológica.

| Código | Nome | Classe/status | Fonte e licença | Dataset verificado | SHA-256 | Ativa? | Observações |
|---|---|---|---|---|---|---|---|
| `acf` | Almeida Corrigida Fiel | A / preservada | Acervo previamente autorizado pela ADPEL | 66 livros; 1.189 capítulos; 31.105 linhas físicas; 31.102 referências canônicas | carga preexistente | Sim, default | Texto e contagens não foram alterados. |
| `onbv` | Biblica® Open Nova Bíblia Viva™ 2007 | A / produção | Open.Bible/Biblica; CC BY-SA 4.0 | USFM oficial; 66 livros; 1.189 capítulos; 31.105 referências | `511ae9e7b8ea0316821a6add72d14dfb2c6e8d382e975bdc992b3751dc83621a` | Sim | Aviso integral, fonte original e obrigação ShareAlike preservados. Somente transformação estrutural, sem revisão do texto. |
| `blivre` | Bíblia Livre | B / ativa por solicitação do responsável | eBible `porbr2018`; CC BY 4.0 | USFM; 66 livros; 1.189 capítulos; 31.102 referências | `f8b806c312e07c283baadb2394fe9fdc2d9a2fbe48410fd5298358511af8ae57` | Sim | Ativada em 07/10/2026 por solicitação explícita. O aviso de trabalho em andamento permanece nos direitos da tradução. |
| — | Bíblia Portuguesa Mundial | B / não importada | eBible `porbrbsl`; domínio público | Completa, mas pacote muda durante 2026 | não fixado | Não | A fonte a declara explicitamente rascunho ainda em revisão; não é candidata a produção nesta etapa. |
| — | Tradução para Tradutores (TfTP) | D / incompleta | eBible `portft`; CC BY-SA 4.0 | 27 livros; 260 capítulos; 7.899 referências | `21e846c62f53ce501f7adaa4571023a8d2bb8828915081dcc7451e323be2bf2a` | Não | Pacote contém somente o Novo Testamento; não atende ao catálogo completo solicitado. |
| — | Bíblia Livre Para Todos | D / incompleta | eBible `porblt`; CC BY-SA 4.0 | Novo Testamento | não baixado | Não | Fonte legal, porém incompleta para o catálogo protestante de 66 livros. |
| `almeida1911` | Almeida 1911 | A / ativa | Project Gutenberg #62383; declarado domínio público nos EUA | HTML histórico convertido e validado em 2026-10-07: 66 livros; 1.189 capítulos; 31.104 referências | `f64749fa0f198d13a3eeeed6ee41234b890bc1db1ae141bff8a46588a5e032c8` | Sim | Importada e ativada em 07/10/2026 mediante autorização informada. Conversão, contagens e amostras verificadas no banco. |
| — | Tradução Brasileira | C / pendente | Não localizada fonte primária redistribuível com licença inequívoca | não validado | — | Não | Sem proveniência e licença primárias suficientes para importação. |
| `jfaal` | JFAAL | A / ativa | Repositório do autor; CC BY 3.0 BR do texto preservada, separada de MIT do código | JSON; 66 livros; 1.189 capítulos; 31.102 referências | manifesto | Sim | Revisão apoiada por GPT-4 informada pelo autor; ativada por solicitação do responsável em 07/10/2026. |
| `naa` | Nova Almeida Atualizada | A / ativa | SBB; uso autorizado informado pela ADPEL; fonte técnica Bolls | 66 livros; 1.189 capítulos; 31.105 referências | manifesto | Sim | Referências explícitas; chamadas de notas removidas. |
| `nvi` | Nova Versão Internacional | A / ativa | Biblica; uso autorizado informado pela ADPEL; Bolls NVIPT | 66 livros; 1.189 capítulos; 31.100 referências | manifesto | Sim | Preservada a numeração explícita da fonte. |
| `ara` | Almeida Revista e Atualizada | A / ativa | SBB; uso autorizado informado pela ADPEL; snapshot damarals/biblias | 66 livros; 1.189 capítulos; 31.104 referências | manifesto | Sim | Fonte com referências explícitas validada antes da carga. |
| `arc` | Almeida Revista e Corrigida | A / ativa | SBB; uso autorizado informado pela ADPEL; snapshot damarals/biblias | 66 livros; 1.189 capítulos; 31.105 referências | manifesto | Sim | Fonte com referências explícitas validada antes da carga. |
| `ntlh` | Nova Tradução na Linguagem de Hoje | A / ativa | SBB; uso autorizado informado pela ADPEL; fonte técnica Bolls | 66 livros; 1.189 capítulos; 30.310 registros com texto | manifesto | Sim | Versículos agregados e lacunas da fonte preservados; não renumerar por posição. Onze placeholders só com formatação foram omitidos, sem preencher com outra versão. |
| `nvt` | Nova Versão Transformadora | A / ativa | Mundo Cristão; uso autorizado informado pela ADPEL; fonte técnica Bolls | 66 livros; 1.189 capítulos; 31.102 referências | manifesto | Sim | Referências explícitas; espaços e apresentação normalizados. |
| — | Outras traduções além das onze combinadas | Não importadas nesta ampliação | Fontes e versões exatas ainda não selecionadas | — | — | Não | O pedido executado abrange ACF, ONBV, BLIVRE, Almeida 1911, JFAAL, NVI, NAA, ARA, ARC, NTLH e NVT. |

## Decisões de conversão USFM

- `\\id`, `\\c` e `\\v` definem livro, capítulo e referência.
- Texto continuado em parágrafos, poesia e listas (`\\p`, `\\q*`, `\\li*`) permanece no versículo atual.
- Marcadores de caráter como `\\add`, `\\nd`, `\\it` e `\\wj` perdem apenas a marcação; suas palavras são preservadas.
- Footnotes, cross-references, títulos e metadados editoriais não entram no texto canônico.
- Marcador desconhecido, UTF-8 inválido, HTML/USFM residual, duplicata ou referência impossível bloqueia a carga.
- Intervalos/sufixos de versículo não são achatados: o processo para porque o modelo atual armazena versículo inteiro. Nenhuma tradução aprovada nesta etapa usa esses identificadores.
- Lacunas legítimas de versificação são registradas, nunca preenchidas com texto da ACF.

## Integridade e separação de licenças

Os hashes acima identificam exatamente os pacotes obtidos. `scripts/bible-translation-sources.json` guarda data, versão, origem e avisos. Pacotes-fonte e datasets derivados ficam fora do Git. O código ADPEL e cada texto bíblico são ativos separados; a licença do texto não é substituída pela licença do código.

## Como adicionar uma tradução autorizada no futuro

1. Obtenha autorização escrita ou licença primária que cubra redistribuição no território de operação.
2. Fixe edição, URL oficial, data e SHA-256; copie integralmente copyright, atribuição e links obrigatórios.
3. Adicione a fonte ao manifesto sem adicionar o pacote ao Git.
4. Crie apenas o adapter necessário ao formato real; não use IA para reconstruir ou dividir versículos.
5. Rode validator, checksum, dez capítulos-amostra e geração de lotes.
6. Importe inativa e verifique contagens, conflitos, RLS, seletor, busca, preferência e recursos pessoais.
7. Ative somente após classe A e aprovação editorial. NAA, NVI, NVT, ARA e outras versões protegidas exigem autorização específica antes desse processo.

## Almeida 1911: preparação de 2026-10-07

O adapter `scripts/convert-almeida1911.mjs` aceita somente o HTML fixado pelo hash no manifesto. Usa IDs do Gutenberg para as referências e o catálogo existente para os nomes dos livros. Preserva palavras, pontuação e ortografia histórica; normaliza espaços e remove apresentação, chamadas de notas e números de página. As notas completas e alternativas continuam disponíveis no HTML original. Não é um conversor genérico de HTML.

Particularidades verificadas na fonte:

- O primeiro número destacado de cada capítulo é o número do capítulo, não o do versículo.
- As letras do acróstico em Lamentações são cabeçalhos editoriais antes da numeração; não entram no texto canônico.
- `Mar4-34` imprime o número 31. O conversor usa a referência do próprio HTML (Marcos 4:34), preserva todas as palavras e registra a divergência no relatório.
- Oseias 11 possui uma lacuna de numeração na fonte. Ela permanece sem preenchimento ou empréstimo de outra tradução.
- Dez capítulos de amostra possuem hashes de texto no relatório. Isso verifica integridade estrutural e reprodutibilidade; não substitui revisão editorial completa.

Com o HTML baixado da `download_url` do manifesto, fora do Git:

```bash
node scripts/convert-almeida1911.mjs /caminho/pg62383-images.html /caminho/almeida1911.json
node scripts/import-bible-translation.mjs --source /caminho/almeida1911.json --archive /caminho/pg62383-images.html --validate-only
node scripts/import-bible-translation.mjs --source /caminho/almeida1911.json --archive /caminho/pg62383-images.html --sql-dir /caminho/almeida1911-sql
node tests/almeida1911.test.mjs
```

O conversor recusa fonte de hash diferente e saída já existente. Os lotes registram traduções inicialmente inativas e mantêm ACF padrão. Em 07/10/2026, após autorização e solicitação explícita do responsável, os lotes da Almeida 1911 foram executados no Supabase, as contagens e amostras conferidas e a tradução ativada. O catálogo existente foi utilizado, sem DDL ou alteração dos textos ACF.


## Execução e verificação de 07/10/2026

Todas as onze versões acima estão ativas no projeto `adpel-app`; ACF permanece a única padrão. Cada tradução possui 66 livros e 1.189 capítulos, e não há texto canônico vazio nas cargas. RLS permanece habilitado no catálogo e nos versículos.

O adapter `scripts/convert-bible-json.mjs` aceita livros canônicos com numeração explícita, o JSON do autor da JFAAL e registros Bolls com livro/capítulo/versículo. Ele valida checksum do arquivo ou do diretório, remove apenas HTML de apresentação e chamadas de notas, mantém palavras e normaliza espaços. Placeholders sem palavras não viram texto bíblico. Os hashes e as onze referências vazias da NTLH estão no manifesto.

Fontes com versos indexados só pela posição ou com duplicatas/capítulos impossíveis foram descartadas. A NTLH não foi importada do snapshot damarals que produzia capítulos 25–38 em 2 Samuel; usamos registros Bolls com referências explícitas. Também não foi importada a NAA desse snapshot, que tinha referências duplicadas. Nenhuma lacuna foi preenchida com outra tradução ou com IA.

As cargas foram feitas por `execute_sql`, em lotes de até 2.000 versículos, com conflito textual protegido. Depois passaram as verificações de contagens e comparação dos dez capítulos-amostra de cada tradução nova; só então foram ativadas. Os datasets e SQL gerados permanecem fora do Git. A autorização informada é específica ao uso pela ADPEL e não é apresentada como licença livre para terceiros.
