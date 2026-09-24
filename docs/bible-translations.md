# Catálogo de traduções bíblicas em português

Pesquisa e validação concluídas em 2026-09-24. A classificação mede licença, proveniência, integridade, maturidade editorial e prontidão técnica; não é avaliação teológica.

| Código | Nome | Classe/status | Fonte e licença | Dataset verificado | SHA-256 | Ativa? | Observações |
|---|---|---|---|---|---|---|---|
| `acf` | Almeida Corrigida Fiel | A / preservada | Acervo previamente autorizado pela ADPEL | 66 livros; 1.189 capítulos; 31.105 linhas físicas; 31.102 referências canônicas | carga preexistente | Sim, default | Texto e contagens não foram alterados. |
| `onbv` | Biblica® Open Nova Bíblia Viva™ 2007 | A / produção | Open.Bible/Biblica; CC BY-SA 4.0 | USFM oficial; 66 livros; 1.189 capítulos; 31.105 referências | `511ae9e7b8ea0316821a6add72d14dfb2c6e8d382e975bdc992b3751dc83621a` | Sim | Aviso integral, fonte original e obrigação ShareAlike preservados. Somente transformação estrutural, sem revisão do texto. |
| `blivre` | Bíblia Livre | B / revisão editorial | eBible `porbr2018`; CC BY 4.0 | USFM; 66 livros; 1.189 capítulos; 31.102 referências | `f8b806c312e07c283baadb2394fe9fdc2d9a2fbe48410fd5298358511af8ae57` | Não | Legalmente reutilizável, mas a fonte a identifica como trabalho em andamento. Registrada inativa. |
| — | Bíblia Portuguesa Mundial | B / não importada | eBible `porbrbsl`; domínio público | Completa, mas pacote muda durante 2026 | não fixado | Não | A fonte a declara explicitamente rascunho ainda em revisão; não é candidata a produção nesta etapa. |
| — | Tradução para Tradutores (TfTP) | D / incompleta | eBible `portft`; CC BY-SA 4.0 | 27 livros; 260 capítulos; 7.899 referências | `21e846c62f53ce501f7adaa4571023a8d2bb8828915081dcc7451e323be2bf2a` | Não | Pacote contém somente o Novo Testamento; não atende ao catálogo completo solicitado. |
| — | Bíblia Livre Para Todos | D / incompleta | eBible `porblt`; CC BY-SA 4.0 | Novo Testamento | não baixado | Não | Fonte legal, porém incompleta para o catálogo protestante de 66 livros. |
| — | Almeida 1911 | C / pendente | Project Gutenberg #62383; declarado domínio público nos EUA | HTML/texto de edição histórica | não fixado | Não | O Gutenberg limita sua declaração jurídica aos EUA; faltam fechamento de jurisdição aplicável e conversor determinístico auditado que preserve ortografia, notas e numeração. |
| — | Tradução Brasileira | C / pendente | Não localizada fonte primária redistribuível com licença inequívoca | não validado | — | Não | Sem proveniência e licença primárias suficientes para importação. |
| — | JFAAL | C / pendente | Repositório do autor | JSON; revisão apoiada por GPT-4 | não fixado | Não | README atribui CC BY 3.0 BR ao texto, enquanto `LICENSE` aplica MIT ao repositório; escopo jurídico e revisão editorial precisam ser esclarecidos. |
| — | NAA, NVI, ARA/ARC modernas, NTLH, NVT, NBV comercial, KJA e similares | D / protegidas | Editoras e licenciantes respectivos | não obtido | — | Não | Nenhuma autorização específica de redistribuição foi apresentada. |

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
