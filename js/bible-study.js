(function () {
  'use strict';
  const PAGE_SIZE = 10;
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const languages = {he:'Hebraico',arc:'Aramaico',grc:'Grego koiné'};
  const state = {enabled:false,context:null,verse:1,tab:'context',generation:0,wordRequest:0,original:null,tokens:[],sources:new Map(),lexicon:new Map(),morphology:new Map(),catalogs:new Map(),word:null,page:0,total:0};
  const client = () => window.supabaseClient;
  const reference = (book,chapter,verse) => `${book} ${chapter}:${verse}`;
  const plainStrong = s => {const m=String(s||'').match(/^([GH])(\d+)/);return m?m[1]+Number(m[2]):null;};
  const safeUrl = value => {try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch(_){return null;}};
  function morphologyParts(code,language) {
    if(!code)return [];
    if(language==='grc')return [code];
    const prefix=code[0];
    return code.split('/').map((part,index)=> index===0||/^[HA]/.test(part)?part:prefix+part);
  }
  function showError(element,message,retry='reload') {
    element.innerHTML=`<p class="study-status" role="alert">${escapeHtml(message)}</p><button type="button" data-study-action="${retry}">Tentar novamente</button>`;
  }
  function sourceFooter(source) {
    if(!source)return '';
    const url=safeUrl(source.source_url);
    const credit=source.code==='stepbible'?'<a href="https://www.stepbible.org" target="_blank" rel="noopener noreferrer">STEP Bible</a>':escapeHtml(source.attribution||source.name);
    return `<footer class="study-attribution">${credit} · ${escapeHtml(source.license_type)}${url?` · <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Fonte e licença</a>`:''}</footer>`;
  }
  function mount() {
    if($('bible-study-panel') || !$('bible-verses-content'))return;
    const actions=$('bible-experience-actions');
    if(!actions)return;
    actions.insertAdjacentHTML('afterbegin',`<div class="study-mode-switch" aria-label="Modo da Bíblia"><button type="button" data-study-mode="read" aria-pressed="true">Leitura</button><button type="button" data-study-mode="study" aria-pressed="false">Estudo</button></div><button type="button" class="study-options-toggle" data-study-action="options" aria-expanded="false" aria-controls="bible-experience-actions">Opções de leitura</button>`);
    const bookControls=$('bible-book-select')?.parentElement;
    if(bookControls){bookControls.classList.add('study-book-controls');$('bible-book-select').insertAdjacentHTML('afterend','<select id="study-chapter-select" class="study-chapter-select" aria-label="Capítulo para estudo"></select>');}
    $('bible-current-book')?.parentElement?.classList.add('study-chapter-heading');
    if($('bible-search-input')&&!bookControls?.contains($('bible-search-input')))$('bible-search-input').parentElement.parentElement.classList.add('study-search-controls');
    $('study-chapter-select')?.addEventListener('change',e=>window.ADPELBible.openReference(state.context.book.id,Number(e.target.value)));
    $('bible-verses-content').insertAdjacentHTML('beforebegin',`<section id="bible-study-panel" class="bible-study-panel hidden" aria-label="Estudo bíblico">
      <div class="study-heading"><div><span class="study-eyebrow">Estudo da Palavra</span><h3 id="study-reference">Sua passagem</h3></div><button type="button" class="study-note-button" data-study-action="note">Minha nota</button></div>
      <div class="study-verse-navigation"><button type="button" data-study-action="previous-verse" aria-label="Versículo anterior">←</button><label>Versículo <select id="study-verse-select" aria-label="Versículo para estudo"></select></label><button type="button" data-study-action="next-verse" aria-label="Próximo versículo">→</button></div>
      <p id="study-portuguese" class="study-portuguese"></p>
      <nav class="study-tabs" aria-label="Ferramentas de estudo"><button type="button" data-study-tab="context" aria-pressed="true">Passagem</button><button type="button" data-study-tab="original" aria-pressed="false">Palavras</button><button type="button" data-study-tab="comments" aria-pressed="false">Comentários</button><button type="button" data-study-tab="references" aria-pressed="false">Referências</button></nav>
      <div id="study-content" aria-live="polite"></div>
    </section>`);
    document.body.insertAdjacentHTML('beforeend',`<dialog id="study-word-dialog" class="study-word-dialog" aria-labelledby="study-word-title"><header class="study-dialog-heading"><div><span class="study-eyebrow">Palavra na passagem</span><h3 id="study-word-title">Estudo da palavra</h3></div><button type="button" data-study-action="close-word" aria-label="Fechar estudo da palavra">×</button></header><div id="study-word-content" aria-live="polite"></div></dialog>`);
    $('study-verse-select').addEventListener('change',e=>openVerse(Number(e.target.value),false));
    $('study-word-dialog').addEventListener('close',()=>state.wordRequest++);
    $('study-word-dialog').addEventListener('click',e=>{if(e.target===$('study-word-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.target.close();}});
    document.addEventListener('click',async e=>{
      const mode=e.target.closest('[data-study-mode]');
      if(mode){await setEnabled(mode.dataset.studyMode==='study');return;}
      const tab=e.target.closest('[data-study-tab]');
      if(tab){state.tab=tab.dataset.studyTab;await loadView();return;}
      const token=e.target.closest('[data-study-token]');
      if(token){await openWord(state.tokens.find(t=>String(t.id)===token.dataset.studyToken));return;}
      const jump=e.target.closest('[data-study-jump]');
      if(jump){$('study-word-dialog').close();await window.ADPELBible.openReference(jump.dataset.studyJump,Number(jump.dataset.studyChapter),Number(jump.dataset.studyVerse));await openVerse(Number(jump.dataset.studyVerse));return;}
      const action=e.target.closest('[data-study-action]')?.dataset.studyAction;
      if(action==='close-word')$('study-word-dialog').close();
      if(action==='options'){
        const reader=$('bible-reader'),expanded=reader.classList.toggle('study-options-expanded');
        document.querySelector('.study-options-toggle').setAttribute('aria-expanded',String(expanded));
      }
      if(action==='previous-verse'||action==='next-verse'){
        const verses=availableVerses(),index=verses.indexOf(state.verse)+(action==='next-verse'?1:-1);
        if(verses[index]!==undefined)await openVerse(verses[index],false);
      }
      if(action==='context-verse')await openVerse(Number(e.target.closest('[data-context-verse]').dataset.contextVerse),false);
      if(action==='previous-word'||action==='next-word'){
        const index=state.tokens.indexOf(state.word)+(action==='next-word'?1:-1);
        if(state.tokens[index])await openWord(state.tokens[index]);
      }
      if(action==='reload')await loadView();
      if(action==='word-retry')await openWord(state.word);
      if(action==='occurrences')await loadOccurrences(0);
      if(action==='previous-occurrences')await loadOccurrences(state.page-1);
      if(action==='next-occurrences')await loadOccurrences(state.page+1);
      if(action==='retry-occurrences')await loadOccurrences(state.page);
      if(action==='note' && state.verse>0)await window.ADPELBible.noteForVerse(state.verse);
    });
  }
  async function setEnabled(enabled) {
    state.enabled=enabled;state.generation++;
    document.querySelectorAll('[data-study-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.studyMode==='study')===enabled)));
    $('bible-study-panel')?.classList.toggle('hidden',!enabled);
    $('bible-reader')?.classList.toggle('bible-study-enabled',enabled);
    $('bible-page')?.classList.toggle('bible-study-active',enabled);
    if(enabled){state.context=window.ADPELBible?.getContext();state.tab='context';updateVerseOptions();await loadView();}
    else $('study-word-dialog')?.close();
  }
  function availableVerses() {
    const c=state.context;
    return c?.book?[...new Set([...c.verses.map(v=>v.verse),...(state.catalogs.get(c.book.id+':'+c.chapter)||[])])].sort((a,b)=>a-b):[];
  }
  function updateVerseOptions() {
    const c=state.context;
    if(!c?.book)return;
    const available=availableVerses();
    $('study-verse-select').innerHTML=available.map(v=>`<option value="${v}">${v===0?'Título (fonte original)':v+(c.verses.some(x=>x.verse===v)?'':' (fonte original)')}</option>`).join('');
    $('study-verse-select').value=String(state.verse);
    $('study-reference').textContent=reference(c.book.name_pt,c.chapter,state.verse);
    $('study-portuguese').textContent=c.verses.find(v=>v.verse===state.verse)?.text||'Esta referência pertence à numeração da fonte original; compare a numeração da tradução portuguesa.';
    document.querySelector('[data-study-action="note"]').disabled=!c.verses.some(v=>v.verse===state.verse);
    const index=available.indexOf(state.verse);
    document.querySelector('[data-study-action="previous-verse"]').disabled=index<=0;
    document.querySelector('[data-study-action="next-verse"]').disabled=index<0||index>=available.length-1;
    if($('study-chapter-select')){
      $('study-chapter-select').innerHTML=Array.from({length:c.book.chapter_count},(_,i)=>`<option value="${i+1}">Capítulo ${i+1}</option>`).join('');
      $('study-chapter-select').value=String(c.chapter);
    }
  }
  async function openVerse(verse,scroll=true) {
    state.verse=verse;state.tab='context';$('study-word-dialog')?.close();
    if(!state.enabled)await setEnabled(true);else {updateVerseOptions();await loadView();}
    if(scroll)$('bible-study-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function getSource(code) {
    if(state.sources.has(code))return state.sources.get(code);
    const {data,error}=await client().from('bible_study_sources').select('code,name,source_url,license_type,attribution').eq('code',code).maybeSingle();
    if(error)throw error;
    if(data)state.sources.set(code,data);
    return data;
  }
  async function loadView() {
    if(!state.enabled || !state.context?.book)return;
    const request=++state.generation,c=state.context,verse=state.verse,tab=state.tab;
    document.querySelectorAll('[data-study-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studyTab===tab)));
    $('study-portuguese').hidden=tab==='context'&&c.verses.some(v=>v.verse===verse);
    state.original=null;state.tokens=[];
    if(tab==='context'){renderPassage();return;}
    $('study-content').innerHTML='<p class="study-status" role="status">Carregando estudo…</p>';
    try {
      if(tab==='original'){
        const key=c.book.id+':'+c.chapter;
        if(!state.catalogs.has(key)){
          const res=await client().from('bible_original_verses').select('verse').eq('source_code','stepbible').eq('book_id',c.book.id).eq('chapter',c.chapter).order('verse').limit(250);
          if(res.error)throw res.error;if(request!==state.generation)return;
          state.catalogs.set(key,res.data.map(v=>v.verse));updateVerseOptions();
        }
        const {data,error}=await client().from('bible_original_verses').select('id,source_code,book_id,chapter,verse,language,text_original,metadata').eq('source_code','stepbible').eq('book_id',c.book.id).eq('chapter',c.chapter).eq('verse',verse).maybeSingle();
        if(error)throw error;
        if(request!==state.generation)return;
        if(!data){$('study-content').innerHTML='<p class="study-status">Esta referência não tem texto nesta edição dos originais. Edições e numeração podem diferir da tradução portuguesa. Continue pelos versículos próximos ou consulte os comentários.</p>';return;}
        const tokens=[];
        for(let offset=0;;offset+=1000){
          const res=await client().from('bible_original_tokens').select('id,token_position,surface,lemma,transliteration,strong_number,lexicon_entry_id,morphology_code,morphology_text_pt,gloss_pt,metadata').eq('original_verse_id',data.id).order('token_position').range(offset,offset+999);
          if(res.error)throw res.error;if(request!==state.generation)return;
          tokens.push(...(res.data||[]));if(res.data.length<1000)break;
        }
        const source=await getSource(data.source_code);
        if(request!==state.generation)return;
        state.original=data;state.tokens=tokens;
        renderOriginal(data,tokens,source);
      }else if(tab==='comments'){
        const {data,error}=await client().from('bible_commentaries').select('id,title,content,category,author_name,source_code,metadata').eq('book_id',c.book.id).eq('chapter',c.chapter).lte('verse_start',verse).gte('verse_end',verse).eq('is_active',true).order('created_at').limit(100);
        if(error)throw error;
        const sources=await Promise.all((data||[]).map(x=>getSource(x.source_code)));
        if(request!==state.generation)return;
        $('study-content').innerHTML=data?.length?data.map((x,i)=>`<article class="study-comment"><span class="study-eyebrow">${escapeHtml(x.category)}</span><h4>${escapeHtml(x.title)}</h4><small>${escapeHtml(x.author_name||'Autor não informado')}${x.metadata?.ai_assisted?' · Conteúdo assistido por IA':''}</small><p>${escapeHtml(x.content)}</p>${sourceFooter(sources[i])}</article>`).join(''):'<p class="study-status">Ainda não há comentário publicado para este versículo. Os comentários da igreja aparecem aqui após revisão e publicação no painel administrativo.</p>';
      }else{
        const {data,error}=await client().from('bible_cross_references').select('to_book_id,to_chapter,to_verse,relation_type,source_code').eq('from_book_id',c.book.id).eq('from_chapter',c.chapter).eq('from_verse',verse).order('weight',{ascending:false}).limit(100);
        if(error)throw error;
        if(request!==state.generation)return;
        const books=await client().from('bible_books').select('id,name_pt');
        if(books.error)throw books.error;if(request!==state.generation)return;
        const names=new Map(books.data.map(b=>[b.id,b.name_pt]));
        const sources=await Promise.all([...new Set((data||[]).map(x=>x.source_code))].map(getSource));
        if(request!==state.generation)return;
        $('study-content').innerHTML=data?.length?`<p class="study-status">Leia as passagens no contexto; a relação temática não torna seus sentidos idênticos.</p><div class="study-reference-list">${data.map(x=>`<button type="button" data-study-jump="${escapeHtml(x.to_book_id)}" data-study-chapter="${x.to_chapter}" data-study-verse="${x.to_verse}">${escapeHtml(reference(names.get(x.to_book_id)||x.to_book_id,x.to_chapter,x.to_verse))}<small>${escapeHtml(x.relation_type)}</small></button>`).join('')}</div>${sources.map(sourceFooter).join('')}`:'<p class="study-status">Nenhuma referência cruzada cadastrada para este versículo.</p>';
      }
    }catch(error){if(request===state.generation)showError($('study-content'),'Não foi possível carregar o estudo. Confira sua conexão e tente novamente.');console.error('Estudo bíblico:',error.message);}
  }
  function renderPassage() {
    const c=state.context,selected=c.verses.find(v=>v.verse===state.verse);
    const surrounding=c.verses.filter(v=>Math.abs(v.verse-state.verse)<=2);
    $('study-content').innerHTML=`<div class="study-section-heading"><h4>Leia no contexto</h4><span>${escapeHtml(c.translation?.short_name||'')}</span></div>
      <p class="study-help">O versículo em destaque é o seu foco. Leia também o que vem antes e depois.</p>
      <div class="study-passage">${surrounding.map(v=>v.verse===state.verse?`<p class="study-context-verse is-current"><sup>${v.verse}</sup>${escapeHtml(v.text)}</p>`:`<button type="button" class="study-context-verse" data-study-action="context-verse" data-context-verse="${v.verse}" aria-label="Estudar versículo ${v.verse}"><sup>${v.verse}</sup>${escapeHtml(v.text)}</button>`).join('')||'<p class="study-status">Use a leitura do capítulo para comparar a numeração desta referência.</p>'}</div>
      <button type="button" class="study-primary study-explore" data-study-tab="original">Explorar palavras ${selected?'deste versículo':'do original'} <span aria-hidden="true">→</span></button>
      <p class="study-help">Primeiro a passagem. Depois, o significado das palavras, comentários e outras referências.</p>`;
  }
  function originalSentence(tokens,language,selectedId=null) {
    return `<div class="study-original-sentence" dir="${language==='grc'?'ltr':'rtl'}" lang="${language}">${tokens.map(t=>selectedId!==null?`<span class="${t.id===selectedId?'is-selected-word':''}">${escapeHtml(t.surface)}</span>`:`<button type="button" class="study-token" data-study-token="${t.id}" aria-label="Estudar ${escapeHtml(t.surface)}">${escapeHtml(t.surface)}</button>`).join(' ')}</div>`;
  }
  function renderOriginal(original,tokens,source) {
    const rtl=original.language!=='grc';
    const tokenLanguage=t=>original.language==='grc'?'grc':t.morphology_code?.startsWith('A')?'arc':'he';
    const label=[...new Set(tokens.map(t=>languages[tokenLanguage(t)]))].join(' / ');
    $('study-content').innerHTML=`<div class="study-section-heading"><h4>A frase no original</h4><span>${escapeHtml(label||languages[original.language])}</span></div>
      <p class="study-help">Toque em uma palavra da frase para conhecer seus sentidos. ${rtl?'Leia da direita para a esquerda.':'Leia da esquerda para a direita.'}</p>
      ${originalSentence(tokens,original.language)}
      <details class="study-method"><summary>Como pronunciar a frase</summary><p class="study-transliteration" dir="ltr">${escapeHtml(tokens.map(t=>t.transliteration||t.surface).join(' '))}</p><p>A transliteração aproxima as letras do original. Ela não é uma tradução.</p></details>
      <details class="study-method"><summary>Como interpretar este interlinear</summary><p>As glossas são pistas de sentido, não uma tradução palavra por palavra. A numeração e algumas leituras da fonte STEP podem diferir da ${escapeHtml(state.context.translation?.short_name||'tradução portuguesa')}. ${rtl?'Uma palavra hebraica ou aramaica pode reunir raiz, prefixos e sufixos; o Strong exibido aponta para a raiz selecionada.':'O grego exibido é a seleção principal N do TAGNT, com grafia e pontuação da fonte STEP; não é uma transcrição do Textus Receptus da ACF.'} A etimologia e os possíveis sentidos de um lema não substituem o contexto da passagem.</p></details>${sourceFooter(source)}`;
  }
  async function openWord(token) {
    if(!token||!state.original)return;
    const request=++state.wordRequest,original=state.original;
    const language=original.language==='grc'?'grc':token.morphology_code?.startsWith('A')?'arc':'he';
    state.word=token;state.page=0;
    $('study-word-title').textContent=token.surface;
    $('study-word-title').setAttribute('dir',language==='grc'?'ltr':'rtl');
    $('study-word-title').setAttribute('lang',language);
    $('study-word-content').innerHTML='<p class="study-status">Carregando léxico…</p>';
    if(!$('study-word-dialog').open)$('study-word-dialog').showModal();
    try{
      let entry=state.lexicon.get(token.lexicon_entry_id);
      if(!entry&&token.lexicon_entry_id){const res=await client().from('bible_lexicon_entries').select('*').eq('id',token.lexicon_entry_id).maybeSingle();if(res.error)throw res.error;entry=res.data;if(entry)state.lexicon.set(entry.id,entry);}
      const codes=morphologyParts(token.morphology_code,language);
      const missing=codes.filter(code=>!state.morphology.has(code));
      if(missing.length){const res=await client().from('bible_morphology_codes').select('code,description_pt').eq('source_code',original.source_code).in('code',missing);if(res.error)throw res.error;for(const item of res.data)state.morphology.set(item.code,item.description_pt);}
      if(request!==state.wordRequest)return;
      const grammar=token.morphology_text_pt||codes.map(code=>state.morphology.get(code)||`${code} (descrição não disponível)`).join('\n');
      const source=await getSource(original.source_code);if(request!==state.wordRequest)return;
      const index=state.tokens.indexOf(token),c=state.context;
      const excerpt=state.tokens.slice(Math.max(0,index-3),index+4);
      $('study-word-content').innerHTML=`<div class="study-word-navigation"><button type="button" data-study-action="previous-word" ${index===0?'disabled':''}>← Anterior</button><span>Palavra ${index+1} de ${state.tokens.length}</span><button type="button" data-study-action="next-word" ${index===state.tokens.length-1?'disabled':''}>Próxima →</button></div>
        <blockquote class="study-word-context"><cite>${escapeHtml(reference(c.book.name_pt,c.chapter,state.verse))} · ${escapeHtml(c.translation?.short_name||'')}</cite><p>${escapeHtml(c.verses.find(v=>v.verse===state.verse)?.text||'Referência com numeração diferente na fonte original.')}</p></blockquote>
        <div class="study-meaning"><span class="study-eyebrow">Significados possíveis</span><p>${escapeHtml(entry?.definition_short_pt||entry?.gloss_pt||token.gloss_pt||'Ainda sem definição em português.')}</p><small>Compare com a passagem acima: nem todos esses sentidos se aplicam a cada uso.</small></div>
        <div class="study-section-heading"><h4>Trecho no original</h4><span>${escapeHtml(languages[language])}</span></div>${originalSentence(excerpt,original.language,token.id)}
        <p class="study-pronunciation">Pronúncia aproximada: <strong>${escapeHtml(token.transliteration||entry?.transliteration||'não disponível')}</strong></p>
        ${!entry?'<p class="study-help">Há dados desta palavra no original, mas a definição completa ainda não está disponível.</p>':''}
        <details class="study-method"><summary>Gramática e identificação</summary><p class="study-help">A gramática descreve a forma usada na passagem; o número Strong identifica a palavra no dicionário.</p><p class="study-preserve">${escapeHtml(grammar||'Análise não informada pela fonte.')}</p><dl class="study-technical"><dt>Strong</dt><dd>${escapeHtml(token.strong_number||'Não informado')}</dd><dt>Forma no dicionário</dt><dd lang="${language}" dir="auto">${escapeHtml(entry?.lemma||token.lemma||token.surface)}</dd><dt>Código gramatical</dt><dd>${escapeHtml(token.morphology_code||'Não informado')}</dd>${entry?.strong_number!==token.strong_number?`<dt>Identificador da fonte</dt><dd>${escapeHtml(entry?.strong_number||'—')}</dd>`:''}</dl>${original.language!=='grc'&&token.metadata?.components?`<p class="study-help">Raiz, prefixos e sufixos: ${escapeHtml(token.metadata.components)}</p>`:''}</details>
        ${entry?.definition_long_pt?`<details class="study-method"><summary>Definição completa</summary><p>${escapeHtml(entry.definition_long_pt)}</p></details>`:''}
        ${entry?.metadata?.definition_en||entry?.metadata?.gloss_en||token.metadata?.gloss_en?`<details class="study-method"><summary>Consultar a fonte em inglês</summary><p>${escapeHtml(entry?.metadata?.gloss_en||token.metadata?.gloss_en||'')}</p><p>${escapeHtml(entry?.metadata?.definition_en||'')}</p></details>`:''}
        <button type="button" class="study-primary" data-study-action="occurrences" ${!plainStrong(token.strong_number)?'disabled':''}>Ver em outras passagens</button><div id="study-occurrences"></div>${sourceFooter(source)}`;
      $('study-word-dialog').scrollTop=0;
    }catch(error){if(request===state.wordRequest)showError($('study-word-content'),'Não foi possível carregar o léxico.','word-retry');console.error('Léxico:',error.message);}
  }
  async function loadOccurrences(page) {
    if(!state.word || page<0 || !$('study-occurrences'))return;
    const request=++state.wordRequest,strong=plainStrong(state.word.strong_number),host=$('study-occurrences');
    state.page=page;host.innerHTML='<p class="study-status">Buscando ocorrências…</p>';
    try{
      const {data,error,count}=await client().from('bible_original_tokens').select('id,surface,token_position,bible_original_verses!inner(book_id,chapter,verse,source_code)',{count:'exact'}).eq('strong_number',strong).eq('bible_original_verses.source_code','stepbible').order('original_verse_id').order('token_position').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
      if(error)throw error;
      const books=await client().from('bible_books').select('id,name_pt');if(books.error)throw books.error;
      if(request!==state.wordRequest)return;
      const names=new Map(books.data.map(b=>[b.id,b.name_pt]));state.total=count||0;
      const excerpts=new Map(),translation=state.context.translation;
      const refs=[...new Set((data||[]).map(t=>t.bible_original_verses).filter(v=>/^[A-Z0-9]+$/.test(v.book_id)&&Number.isInteger(v.chapter)&&Number.isInteger(v.verse)&&v.verse>0).map(v=>`and(book_id.eq.${v.book_id},chapter.eq.${v.chapter},verse.eq.${v.verse})`))];
      if(translation?.source_type==='local'&&translation.id&&refs.length){
        const res=await client().from('bible_verses').select('book_id,chapter,verse,text').eq('translation_id',translation.id).eq('is_canonical',true).or(refs.join(','));
        if(!res.error)for(const v of res.data||[])excerpts.set(`${v.book_id}:${v.chapter}:${v.verse}`,v.text);
      }
      if(request!==state.wordRequest)return;
      host.innerHTML=`<h4>${state.total} usos encontrados</h4><p class="study-help">Toque para ler a passagem. Os trechos em português seguem a mesma referência, sem alinhamento automático com a palavra original.</p><div class="study-reference-list study-occurrence-list">${(data||[]).map(t=>{const v=t.bible_original_verses,text=excerpts.get(`${v.book_id}:${v.chapter}:${v.verse}`);return `<button type="button" data-study-jump="${escapeHtml(v.book_id)}" data-study-chapter="${v.chapter}" data-study-verse="${v.verse}"><strong>${escapeHtml(reference(names.get(v.book_id)||v.book_id,v.chapter,v.verse))}</strong>${text?`<span class="study-occurrence-text">${escapeHtml(text)}</span>`:''}<small>${escapeHtml(t.surface)}${text?' · '+escapeHtml(translation.short_name):''}</small></button>`;}).join('')||'<p>Nenhuma ocorrência disponível.</p>'}</div><p class="study-help">A contagem reúne os sentidos do número Strong. Um versículo pode ter mais de um uso.</p><div class="study-pagination"><button type="button" data-study-action="previous-occurrences" ${page===0?'disabled':''}>Anterior</button><span>${page+1} de ${Math.max(1,Math.ceil(state.total/PAGE_SIZE))}</span><button type="button" data-study-action="next-occurrences" ${(page+1)*PAGE_SIZE>=state.total?'disabled':''}>Próxima</button></div>`;
    }catch(error){if(request===state.wordRequest)showError(host,'Não foi possível carregar as ocorrências.','retry-occurrences');console.error('Concordância:',error.message);}
  }
  document.addEventListener('adpel:bible-chapter',e=>{state.context=e.detail;state.verse=e.detail.verses[0]?.verse||1;state.tab='context';state.generation++;$('study-word-dialog')?.close();if(state.enabled){mount();updateVerseOptions();loadView();}});
  document.addEventListener('DOMContentLoaded',()=>{mount();state.context=window.ADPELBible?.getContext();});
  window.ADPELBibleStudy={openVerse};
  if(typeof module!=='undefined'&&module.exports)module.exports={plainStrong,morphologyParts,safeUrl};
})();
