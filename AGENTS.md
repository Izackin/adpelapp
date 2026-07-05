# ADPEL Digital

## Objetivo

O ADPEL Digital e um Progressive Web App (PWA) para igrejas. O projeto centraliza Biblia, Harpa Crista, cursos, biblioteca, certificados, eventos, ofertas, gamificacao, perfil de membro, notificacoes e painel administrativo em uma experiencia unica, responsiva e instalavel.

Este arquivo e a documentacao oficial para qualquer IA ou desenvolvedor que assumir o projeto. Antes de modificar qualquer arquivo, leia este documento inteiro e confira os arquivos criticos citados aqui.

## Visao do Produto

Evoluir o ADPEL Digital para uma plataforma SaaS multi-igrejas, onde uma unica instalacao e um unico codigo-base possam atender varias igrejas, congregacoes e denominacoes. A experiencia deve lembrar aplicativos modernos como Duolingo, YouVersion e Notion: rapida, elegante, simples de navegar, com progresso visivel e sensacao de aplicativo nativo.

## Missao

Ajudar igrejas a discipular, informar, engajar e servir seus membros por meio de uma plataforma digital acessivel, bonita e facil de manter.

## Publico-alvo

- Membros de igrejas que desejam estudar, acompanhar eventos, ler conteudos e registrar sua caminhada espiritual.
- Liderancas e administradores que precisam publicar cursos, eventos, avisos, certificados, cofres de ofertas e notificacoes.
- Futuras igrejas clientes em um modelo SaaS multi-tenant.

## Tecnologias utilizadas

- HTML estatico.
- CSS customizado em `style.css`.
- JavaScript vanilla, com funcoes globais.
- Tailwind CSS via CDN.
- Font Awesome via CDN.
- Lucide via CDN.
- Google Fonts: Inter e Playfair Display.
- Supabase JavaScript SDK v2 via CDN.
- Supabase Auth.
- Supabase Database/PostgREST.
- Supabase Storage.
- Supabase Edge Functions.
- Service Worker e Web App Manifest para PWA.
- Push Notifications com VAPID.
- YouTube IFrame API para aulas em video.
- QR Code externo via `api.qrserver.com`.
- LocalStorage para cache e estados locais.

## Estrutura de pastas

```text
.
|-- index.html                         # Aplicacao principal
|-- script.js                          # Inicializacao e helpers compartilhados
|-- auth.js                            # Login, cadastro, sessao e UI de autenticacao
|-- supabase.js                        # Cliente Supabase e facade global ADPEL
|-- fundraising.js                     # Cofres e contribuicoes publicas
|-- spiritual-progress.js              # Minha Caminhada, XP, ranking, desafios
|-- notifications.js                   # Inscricao push do usuario
|-- admin.html                         # Painel administrativo
|-- admin.js                           # Core do admin
|-- admin-notifications.js             # Envio de push pelo admin
|-- admin/
|   |-- crud-agenda.js
|   |-- crud-app-updates.js
|   |-- crud-avisos.js
|   |-- crud-certificates.js
|   |-- crud-cofres.js
|   |-- crud-courses.js
|   |-- crud-library.js
|   |-- crud-studies.js
|   `-- crud-verses.js
|-- js/
|   |-- agenda.js                    # Agenda/eventos publicos
|   |-- app-updates.js               # Novidades e atualizacoes do app
|   |-- bible.js                     # Biblia embutida no app principal
|   |-- bootstrap.js                 # Helpers globais iniciais
|   |-- certificates.js              # Certificados publicos
|   |-- config.js                    # Configuracao base ADPEL
|   |-- courses.js                   # Cursos, aulas e estudos publicos
|   |-- home.js                      # Home publica
|   |-- library.js                   # Biblioteca publica
|   |-- navigation.js                # Navegacao publica e modais globais
|   |-- offerings.js                 # Modal de ofertas e PIX
|   `-- profile.js                   # Perfil e relatorio de ofertas
|-- bible.html                         # Pagina separada da Biblia
|-- harpa.html                         # Pagina separada da Harpa Crista
|-- style.css                          # Tema visual global
|-- sw.js                              # Service Worker e Push
|-- manifest.json                      # Manifest PWA
|-- utils/
|   `-- date-utils.js                  # Validade de conteudos por datas
|-- images/
|   `-- adpel.logo.png
|-- supabase/
|   |-- migrations/                    # Migrations versionadas
|   `-- functions/send-notification/   # Edge Function de push
|-- schema.sql                         # Schema base manual
|-- fundraising-schema.sql             # Schema de cofres
|-- spiritual-progress-schema.sql      # Schema de gamificacao
|-- schema-push-notifications.sql      # Schema de push
|-- fix-*.sql                          # Ajustes manuais de banco/cache
|-- future-payment-api.sql             # Preparacao futura para pagamentos
|-- data-layer.js                      # Camada antiga/localStorage
|-- app.js                             # Camada publica alternativa/legada
|-- text-fix.js                        # Correcao visual de textos com encoding corrompido
`-- README.md
```

## Arquitetura do sistema

O projeto e um app estatico com backend Supabase. Nao ha framework frontend, bundler, TypeScript no frontend ou roteador formal. A arquitetura atual e baseada em:

- HTML com secoes escondidas/exibidas por JavaScript.
- Scripts globais carregados por `<script>`.
- Estado em variaveis globais (`currentSection`, `currentUser`, `coursesData`, `cofresData`, etc.).
- Comunicacao direta com Supabase pelo SDK no navegador.
- Renderizacao imperativa usando `innerHTML` e eventos inline (`onclick`).
- Modulos separados por arquivo, mas sem import/export.

O core publico foi dividido entre `script.js` e os modulos em `js/`. O core admin esta em `admin.js`, com CRUDs em arquivos separados dentro de `admin/`.

## Como o frontend funciona

`index.html` carrega, em ordem aproximada:

1. Supabase SDK.
2. `supabase.js`.
3. `utils-notifications.js`.
4. `auth.js`.
5. `utils/date-utils.js`.
6. `spiritual-progress.js`.
7. modulos publicos em `js/` (`navigation.js`, `bible.js`, `app-updates.js`, `library.js`, `agenda.js`, `courses.js`, `home.js`).
8. `fundraising.js`.
9. modulos publicos dependentes (`offerings.js`, `profile.js`, `certificates.js`).
10. `notifications.js`.
11. `text-fix.js`.
12. `script.js`.

`script.js` inicializa o app apos o carregamento do DOM e mantem helpers compartilhados. Modulos em `js/` cuidam de Navegacao, Home, Agenda, Cursos/Estudos, Biblioteca, Biblia embutida, Atualizacoes, Ofertas, Perfil e Certificados.

A navegacao principal usa `navigateTo(section)`. Ela esconde todas as secoes principais e mostra a secao solicitada. Algumas secoes exigem login: `courses`, `library`, `certificate` e `profile`.

## Como o backend funciona

O backend e Supabase:

- Auth controla usuarios e sessoes.
- Database guarda conteudos, progresso, eventos, certificados e ofertas.
- Storage guarda arquivos de estudos, livros e JSON da Harpa.
- Edge Function `send-notification` envia push notifications.

Nao existe servidor proprio neste repositorio. Toda operacao administrativa atual acontece pelo cliente Supabase no navegador, por isso as policies/RLS sao parte critica da seguranca real.

## Como o Supabase esta organizado

### Authentication

`auth.js` usa:

- `ADPEL.auth.getSession()`
- `ADPEL.auth.signIn()`
- `ADPEL.auth.signUp()`
- `ADPEL.auth.signOut()`
- `ADPEL.auth.onAuthStateChange()`

O perfil complementar fica em `profiles`, vinculado ao `auth.users` pelo mesmo `id`. O admin/master e identificado por `profiles.role = 'master'` ou pelo email hardcoded `master@adpel.com`.

### Database

Tabelas e views identificadas:

- `profiles`
- `courses`
- `studies`
- `library_books`
- `announcements`
- `events`
- `event_attendances`
- `certificates`
- `home_sections`
- `bible_verses`
- `verse_of_day`
- `user_lesson_progress`
- `fundraising_goals`
- `fundraising_contributions`
- `fundraising_stats`
- `user_offering_summary`
- `spiritual_progress`
- `daily_challenges`
- `user_daily_challenges`
- `app_updates`
- `app_update_reads`
- `push_subscriptions`

### Storage

Uso encontrado:

- Bucket `uploads` para arquivos de biblioteca e estudos.
- Bucket/URL publico `harpa/harpa.json` para a Harpa Crista.
- Imagens podem vir por URL externa ou Storage.

### Policies

Ha RLS habilitado nos schemas SQL, mas varias policies permitem insert/update/delete para qualquer usuario autenticado. Isso e uma divida tecnica importante. O gate visual do admin nao substitui RLS.

Antes de evoluir o projeto para SaaS ou producao robusta, revise policies para:

- permitir leitura publica apenas onde fizer sentido;
- restringir escrita administrativa a `role = master`;
- restringir dados pessoais ao proprio usuario;
- preparar isolamento multi-igrejas por `church_id` ou `tenant_id`.

### Fluxo de dados

O fluxo atual e:

1. Usuario acessa `index.html`.
2. Supabase inicializa em `supabase.js`.
3. `auth.js` resolve sessao e perfil.
4. `js/navigation.js` carrega dados da secao ativa.
5. Cada modulo consulta tabelas diretamente.
6. Renderizacao acontece no DOM por `innerHTML`.
7. Acoes do usuario gravam diretamente no Supabase.
8. Admin usa CRUDs diretos em tabelas.

## Funcionalidades existentes

- Login por email e senha.
- Cadastro de usuario.
- Logout.
- Reset de senha.
- Menu de usuario.
- Exibicao condicional do link administrativo.
- Home com saudacao personalizada.
- Versiculo do dia.
- Agenda unificada de eventos e avisos.
- Confirmacao/cancelamento de presenca em eventos.
- Lista de participantes em eventos.
- Cursos publicados.
- Separacao de cursos por nao iniciados, em andamento e concluidos.
- Aulas em video via YouTube.
- Marcacao de aula concluida.
- Progresso por usuario em `user_lesson_progress`.
- Emissao de certificado ao concluir curso.
- Visualizacao/impressao de certificados.
- Estudos com conteudo, arquivo e aulas.
- Biblioteca digital com arquivos.
- Leitura de livro em nova aba.
- Biblia embutida no app principal.
- Pagina separada `bible.html`.
- Busca biblica por referencia ou texto.
- Harpa Crista em `harpa.html`.
- Busca de hinos por numero, titulo ou trecho.
- Cache local da Harpa.
- Cofres de objetivos.
- Oferta destinada a cofre.
- Oferta livre.
- Geracao de payload PIX copia-e-cola.
- Geracao de QR Code PIX.
- Registro de oferta confirmada.
- Historico e resumo de ofertas no perfil.
- Minha Caminhada com XP, niveis, streak e medalhas.
- Ranking geral.
- Desafios diarios.
- Registro de atividades espirituais: leitura, capitulos, hinos, aulas, ofertas e missao diaria.
- Novidades/atualizacoes do app.
- Controle de atualizacoes lidas por usuario ou visitante.
- Push notifications.
- PWA instalavel.
- Service Worker com cache basico.
- Correcao visual de textos com encoding corrompido via `text-fix.js`.

## Painel Administrativo

O painel fica em `admin.html`. Ele possui:

- Gate de protecao client-side.
- Sidebar com navegacao interna.
- Dashboard com estatisticas.
- CRUD de cursos.
- CRUD de biblioteca.
- CRUD de certificados.
- CRUD de agenda/eventos.
- CRUD de versiculos do dia.
- CRUD de cofres.
- CRUD de atualizacoes do app.
- Tela de notificacoes push.
- View antiga/retirada de avisos.

`admin.js` carrega dados com `loadAllData()` e preenche arrays globais:

- `coursesData`
- `libraryData`
- `certificatesData`
- `agendaData`
- `versesData`
- `cofresData`
- `cofresStatsData`
- `appUpdatesData`

Cada arquivo `admin/crud-*.js` segue o padrao:

- `showXForm(item)`
- `hideXForm()`
- `handleXSubmit(e)`
- `deleteX(id)`
- `renderAdminX()`
- `editX(encodedItem)`

Importante: `admin/crud-studies.js` e `admin/crud-avisos.js` existem, mas nem todos estao carregados/ativos no `admin.html`. O admin tambem redireciona `studies` para `courses` e `avisos` para `agenda` em alguns pontos.

## Navegacao

### `index.html`

App principal. Secoes:

- `home`: saudacao, versiculo, atalhos, caminhada, agenda e ofertas.
- `courses`: cursos e aulas.
- `studies`: secao existente no HTML, mas a navegacao atual concentra estudos em cursos.
- `library`: biblioteca.
- `cofres`: objetivos e ofertas destinadas.
- `certificate`: certificados do usuario.
- `ranking`: ranking da caminhada espiritual.
- `bible`: Biblia embutida.
- `profile`: perfil, caminhada e historico de ofertas.

### `admin.html`

Painel administrativo protegido por sessao/master. Views:

- `admin-view-home`
- `admin-view-courses`
- `admin-view-library`
- `admin-view-certificates`
- `admin-view-agenda`
- `admin-view-cofres`
- `admin-view-app-updates`
- `admin-view-notifications`
- `admin-view-avisos` legado/retirado

### `bible.html`

Experiencia separada para Biblia, com leitura por livro/capitulo, busca e tela cheia.

### `harpa.html`

Experiencia separada para Harpa Crista, carregada de JSON publico no Supabase Storage, com busca, lista, detalhe e ajuste de fonte.

### `index-updated.html`

Arquivo pequeno/legado gerado anteriormente. Nao parece ser a entrada principal atual.

## Componentes reutilizados

Nao ha componentes formais, mas ha padroes reutilizados:

- Cards de conteudo.
- Carrosseis horizontais com `overflow-x-auto`.
- Estados vazios.
- Modais.
- Toasts (`showToast`).
- Formularios administrativos.
- Botoes iconados com Font Awesome.
- Badges de status: publicado, rascunho, destaque, ativo.
- Barras de progresso.
- Navegacao mobile inferior.
- Sidebar desktop.
- Helpers de escape/formatacao.

Ao criar algo novo, procure antes por um padrao visual ou funcional equivalente em `script.js`, `admin.html`, `admin.js`, `admin/crud-*.js` e `style.css`.

## Sistema de Design

### Identidade visual

A identidade mistura:

- azul institucional;
- fundo escuro premium;
- detalhes dourados/fogo;
- elementos de fe, discipulado e progresso;
- cards com sombra e bordas suaves.

A experiencia deve parecer um app moderno, nao uma pagina institucional simples.

### Cores

Principais variaveis em `style.css`:

- `--bg-primary: #050816`
- `--bg-secondary: #08111f`
- `--card-bg: #0f172a`
- `--primary: #2563eb`
- `--primary-dark: #1d4ed8`
- `--gold: #facc15`
- `--amber: #f59e0b`
- `--fire: #f97316`
- `--success: #22c55e`
- `--danger: #ef4444`

Tailwind tambem define paleta `adpel` no `index.html`.

### Tipografia

- Inter para interface.
- Playfair Display para elementos cerimoniais/certificados e alguns titulos especiais.
- Evitar escalas exageradas dentro de cards compactos.

### Icones

- Font Awesome e usado extensivamente.
- Lucide esta carregado, mas o uso predominante no projeto e Font Awesome.
- Mantenha icones consistentes com o modulo: cursos, Biblia, ofertas, eventos, ranking etc.

### Espacamentos

- Cards usam padding entre `p-4` e `p-8`.
- Gaps comuns: `gap-3`, `gap-4`, `gap-6`.
- Mobile prioriza botoes com pelo menos `44px` de altura.

### Animacoes

- `animate-fade-in` usa `fadeInUp`.
- Cards e botoes usam transicoes curtas.
- A Biblia tem animacao visual de livro.
- Evite animacoes pesadas ou que prejudiquem performance em mobile.

### Responsividade

O app e mobile-first:

- Navegacao inferior em mobile.
- Sidebar/header em desktop.
- Carrosseis horizontais para cards em telas pequenas.
- Modais com `max-height` e `overflow-y-auto`.
- Area segura inferior com `env(safe-area-inset-bottom)`.

## Fluxo do usuario

1. Entra no app pela Home.
2. Pode navegar por atalhos e menu inferior.
3. Ao tentar acessar areas restritas, abre modal de login.
4. Apos login, a UI troca para menu de usuario.
5. Pode assistir cursos, marcar aulas e emitir certificados.
6. Pode ler Biblia/Harpa e ganhar progresso.
7. Pode contribuir por PIX livre ou destinado.
8. Pode ver perfil, historico de ofertas, medalhas e ranking.
9. Pode ativar notificacoes push.
10. Recebe modais de novidades do app enquanto houver atualizacoes nao lidas.

## Fluxo do administrador

1. Acessa `admin.html`.
2. O gate verifica sessao e perfil master.
3. Se nao estiver logado ou nao for master, permanece no gate.
4. Se for master, o painel aparece.
5. `loadAllData()` busca dados das tabelas.
6. O admin navega por views internas.
7. Formularios criam/atualizam registros no Supabase.
8. Listas sao re-renderizadas apos cada operacao.
9. Admin pode enviar push pela Edge Function `send-notification`.

## Padroes de codigo

- JavaScript vanilla.
- Funcoes globais no escopo da janela.
- Modulos por arquivo, sem import/export.
- Renderizacao por strings HTML.
- Objetos codificados com `encodeURIComponent(JSON.stringify(item))` em handlers inline.
- Uso frequente de `escapeHtml()` para saida textual.
- Uso defensivo de `try/catch` em consultas Supabase.
- Fallback silencioso quando tabelas opcionais nao existem.
- Debounce manual para carregamento de secoes.
- Compatibilidade com schema antigo em alguns fluxos.

## Convencoes

- IDs HTML sao a principal conexao entre UI e JS.
- Funcoes de renderizacao geralmente seguem `renderX`.
- Funcoes de carregamento geralmente seguem `loadXData`.
- Admin CRUD usa `showXForm`, `hideXForm`, `handleXSubmit`, `deleteX`, `renderAdminX`, `editX`.
- Tabelas Supabase usam snake_case.
- Campos booleanos comuns: `is_published`, `is_featured`, `is_active`.
- Datas de validade usam campos como `start_date`, `end_date`, `expiry`.
- Toasts devem usar `showToast(message, type)`.
- Preserve `escapeHtml` ou sanitizacao equivalente ao inserir texto no DOM.

## Como adicionar uma nova pagina

1. Confirme se precisa ser pagina separada ou apenas nova secao em `index.html`.
2. Para secao interna, crie um bloco com `id` unico em `index.html`.
3. Inclua o id na lista de secoes em `navigateTo()` dentro de `js/navigation.js`.
4. Adicione o caso correspondente em `loadSectionData(section)`.
5. Adicione item no menu desktop e/ou mobile.
6. Reutilize padroes de cards, headings, estados vazios e modais.
7. Teste mobile primeiro.
8. Atualize este `AGENTS.md` se a arquitetura ou navegacao mudar.

## Como adicionar um novo modulo

1. Defina o dominio: publico, admin ou compartilhado.
2. Reaproveite `window.ADPEL` ou crie funcoes perto do modulo existente mais similar.
3. Evite aumentar ainda mais `script.js` se o modulo for grande; prefira arquivo separado carregado apos dependencias.
4. Use IDs previsiveis no HTML.
5. Centralize consultas Supabase em funcoes claras.
6. Crie renderizacao com estados: loading, vazio, erro e sucesso.
7. Garanta comportamento quando o usuario nao estiver logado.
8. Garanta comportamento quando a tabela ainda nao existir, se for modulo opcional.

## Como adicionar um novo CRUD

1. Crie a tabela e policies no Supabase.
2. Adicione a view/form no `admin.html`.
3. Crie `admin/crud-nome.js` seguindo o padrao existente.
4. Adicione array global em `admin.js` se necessario.
5. Atualize `loadAllData()` para buscar a tabela.
6. Chame `renderAdminNome()` apos carregar dados.
7. Registre listener do formulario no `DOMContentLoaded` de `admin.js`.
8. Inclua o script no final do `admin.html`.
9. Restrinja a escrita por RLS, nao apenas pelo painel.
10. Documente o novo CRUD neste arquivo.

## Como integrar novas tabelas do Supabase

1. Crie migration em `supabase/migrations/` quando possivel.
2. Se tambem criar SQL manual, mantenha consistente com as migrations.
3. Habilite RLS.
4. Escreva policies minimas e seguras.
5. Use `NOTIFY pgrst, 'reload schema';` apos DDL quando aplicavel.
6. Atualize `supabase.js` se a tabela entrar na facade `ADPEL.fetch`.
7. Atualize admin/public conforme necessario.
8. Evite depender de policies amplas como `with check (true)` para escrita administrativa.

## Como criar novos componentes

1. Procure um componente visual parecido.
2. Copie o padrao de classes e comportamento, mas extraia helper se houver duplicacao real.
3. Use `escapeHtml` para texto vindo do banco/usuario.
4. Use botoes com icones e estados claros.
5. Inclua estado vazio.
6. Inclua estado deslogado se a funcionalidade exigir login.
7. Mantenha dimensoes estaveis para evitar layout shift.

## Como manter compatibilidade mobile

- Teste em largura pequena antes de considerar pronto.
- Mantenha botoes com area tocavel minima.
- Evite texto longo sem quebra.
- Use `overflow-x-auto` para listas horizontais.
- Em modais, mantenha `max-height` e rolagem interna.
- Nao esconda a navegacao inferior por acidente.
- Preserve `pb-safe` e areas seguras.
- Evite dependencias pesadas ou renderizacoes muito grandes.

## Como manter o padrao visual

- Use o tema escuro premium do `style.css`.
- Prefira cards escuros com bordas sutis e sombras.
- Use azul institucional para acoes principais.
- Use dourado/fogo como destaque, nao como cor dominante unica.
- Preserve Inter e Playfair Display.
- Use Font Awesome para manter coerencia com o restante do app.
- Evite layouts de landing page quando a necessidade e ferramenta/app.

## Arquivos criticos

Nao altere sem necessidade e sem entender impacto:

- `index.html`
- `script.js`
- `auth.js`
- `supabase.js`
- `spiritual-progress.js`
- `fundraising.js`
- `admin.html`
- `admin.js`
- `admin/crud-*.js`
- `style.css`
- `sw.js`
- `manifest.json`
- `schema.sql`
- `supabase/migrations/*`
- `supabase/functions/send-notification/index.ts`
- `text-fix.js`

## Dependencias importantes

- Supabase project URL e anon key em `supabase.js`.
- Supabase SDK CDN.
- Tailwind CDN.
- Font Awesome CDN.
- Lucide CDN.
- Google Fonts.
- YouTube IFrame API.
- VAPID public key em `notifications.js`.
- VAPID private/public secrets na Edge Function.
- QR Code API externa.
- Storage publico da Harpa.

## Dividas tecnicas encontradas

- RLS permissivo demais para escrita administrativa.
- Admin protegido principalmente no cliente.
- Email `master@adpel.com` hardcoded.
- `script.js` ja foi reduzido, mas ainda ha dependencias globais herdadas entre modulos.
- Duplicacao de helpers (`escapeHtml`, `formatDate`, `openModal`, `closeModal`, `formatBRL`).
- Inconsistencias entre schemas antigos e codigo atual, como `file_data` vs `file_url`.
- `fundraising_stats` aparece como view em um SQL e como tabela em migration.
- Modelo de `lessons` inconsistente: admin salva objetos `{ title, url }`, mas partes do app tratam aula como string URL.
- `study.content` e inserido com `innerHTML`, exigindo cuidado contra XSS.
- Arquivos legados/alternativos (`app.js`, `data-layer.js`, `index-updated.html`) podem confundir manutencao.
- Textos com encoding corrompido mitigados por `text-fix.js`.
- Pouca separacao entre dados, estado e apresentacao.
- Falta suite de testes automatizados.
- PIX ainda depende de confirmacao manual do usuario, sem webhook real de pagamento.
- Multi-tenant ainda nao esta implementado de ponta a ponta.

## Melhorias sugeridas

- Reforcar RLS com regra de master real.
- Substituir o email hardcoded por permissao baseada em perfil.
- Padronizar migrations e remover SQLs conflitantes apos consolidacao.
- Modularizar `script.js` por dominio.
- Criar uma camada unica de acesso ao Supabase.
- Padronizar `lessons` como array de objetos.
- Sanitizar conteudos ricos antes de renderizar.
- Criar logs/auditoria para operacoes admin.
- Integrar webhook/API real de pagamentos PIX.
- Preparar `church_id`/`tenant_id` em tabelas principais.
- Criar testes manuais documentados e depois automatizados.

## Roadmap tecnico

1. Consolidar schema real do Supabase.
2. Corrigir policies RLS administrativas.
3. Definir modelo multi-tenant (`tenant_id`, `church_id`, roles por igreja).
4. Modularizar frontend gradualmente.
5. Criar camada `services/` ou equivalente para Supabase.
6. Padronizar componentes reutilizaveis.
7. Criar ambiente de desenvolvimento local mais previsivel.
8. Adicionar testes para auth, admin, cursos, ofertas e progresso.
9. Melhorar cache/PWA sem prejudicar atualizacoes.
10. Criar observabilidade basica de erros.

## Roadmap funcional

1. Multi-igrejas com configuracao de identidade visual por igreja.
2. Perfis de permissao: master, pastor, lider, professor, membro.
3. Trilhas de discipulado.
4. Certificados verificaveis por codigo/QR.
5. Pagamentos PIX com confirmacao automatica.
6. Relatorios administrativos.
7. Calendario avancado com inscricoes.
8. Conteudos segmentados por igreja, congregacao ou grupo.
9. Notificacoes segmentadas.
10. Dashboard de engajamento.

## Checklist antes de modificar qualquer codigo

- Leia este `AGENTS.md` antes de modificar qualquer arquivo.
- Entenda qual fluxo sera impactado.
- Localize os arquivos envolvidos antes de editar.
- Nunca altere funcionalidades existentes sem autorizacao.
- Nunca remova funcionalidades existentes sem autorizacao.
- Preserve compatibilidade mobile.
- Preserve a identidade visual.
- Reutilize componentes e padroes existentes.
- Evite duplicacao de codigo.
- Priorize performance.
- Faca alteracoes pequenas e localizadas.
- Explique o plano antes de implementar mudancas grandes.
- Mantenha o projeto organizado.
- Documente qualquer funcionalidade nova criada.
- Atualize este `AGENTS.md` sempre que a arquitetura mudar.
- Verifique Supabase/RLS ao tocar em dados sensiveis ou admin.
- Use `escapeHtml` ou sanitizacao equivalente para dados renderizados.
- Teste os fluxos afetados em desktop e mobile.

## Regras obrigatorias para futuras IAs

- Sempre ler este `AGENTS.md` antes de modificar qualquer arquivo.
- Nunca alterar funcionalidades existentes sem autorizacao.
- Nunca remover funcionalidades.
- Sempre preservar compatibilidade mobile.
- Sempre preservar a identidade visual.
- Sempre reutilizar componentes existentes.
- Evitar duplicacao de codigo.
- Priorizar performance.
- Fazer alteracoes pequenas e localizadas.
- Explicar o plano antes de implementar mudancas grandes.
- Manter o projeto organizado.
- Documentar qualquer funcionalidade nova criada.
- Atualizar este `AGENTS.md` sempre que a arquitetura mudar.
