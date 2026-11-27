(function () {
  'use strict';
  const PAGE_SIZE = 25;
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const languages = {he:'Hebraico',arc:'Aramaico',grc:'Grego koiné'};
  const state = {enabled:false,context:null,verse:1,tab:'original',generation:0,wordRequest:0,original:null,tokens:[],sources:new Map(),lexicon:new Map(),morphology:new Map(),catalogs:new Map(),word:null,page:0,total:0};
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
    actions.insertAdjacentHTML('afterbegin',`<div class="study-mode-switch" role="group" aria-label="Modo da Bíblia"><button type="button" data-study-mode="read" aria-pressed="true"><i class="fas fa-book-open" aria-hidden="true"></i> Leitura</button><button type="button" data-study-mode="study" aria-pressed="false"><i class="fas fa-language" aria-hidden="true"></i> Estudo</button></div>`);
    $('bible-verses-content').insertAdjacentHTML('beforebegin',`<section id="bible-study-panel" class="bible-study-panel hidden" aria-label="Estudo bíblico">
      <header class="study-header"><div><span class="study-eyebrow">Bíblia · Modo estudo</span><h3 id="study-reference">Estudo da Palavra</h3></div><button type="button" class="study-back" data-study-mode="read" aria-label="Voltar à leitura"><i class="fas fa-arrow-left" aria-hidden="true"></i> Leitura</button></header>
      <div class="study-verse-navigation"><button type="button" data-study-action="previous-verse" aria-label="Versículo anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button><label>Versículo <select id="study-verse-select" aria-label="Versículo para estudo"></select></label><button type="button" data-study-action="next-verse" aria-label="Próximo versículo"><i class="fas fa-chevron-right" aria-hidden="true"></i></button></div>
      <article class="study-passage"><span id="study-translation" class="study-eyebrow"></span><p id="study-portuguese" class="study-portuguese"></p><button type="button" data-study-action="note" class="study-note"><i class="fas fa-note-sticky" aria-hidden="true"></i> Minha nota</button></article>
      <nav class="study-tabs" aria-label="Ferramentas de estudo"><button type="button" data-study-tab="original" aria-pressed="true"><i class="fas fa-language" aria-hidden="true"></i> Palavras</button><button type="button" data-study-tab="comments" aria-pressed="false"><i class="fas fa-book" aria-hidden="true"></i> Comentários</button><button type="button" data-study-tab="references" aria-pressed="false"><i class="fas fa-link" aria-hidden="true"></i> Referências</button></nav>
      <div id="study-content" aria-live="polite"></div>
    </section>`);
    document.body.insertAdjacentHTML('beforeend',`<dialog id="study-word-dialog" class="study-word-dialog" aria-labelledby="study-word-title"><div class="study-heading"><h3 id="study-word-title">Estudo da palavra</h3><button type="button" data-study-action="close-word" aria-label="Fechar estudo da palavra">×</button></div><div id="study-word-content" aria-live="polite"></div></dialog>`);
    $('study-verse-select').addEventListener('change',e=>openVerse(Number(e.target.value),false,true));
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
      if(jump){
        if($('study-word-dialog').open)$('study-word-dialog').close();
        const book=jump.dataset.studyJump,chapter=Number(jump.dataset.studyChapter),verse=Number(jump.dataset.studyVerse);
        state.pendingJump={book,chapter,verse};
        try{await window.ADPELBible.openReference(book,chapter,verse,{linked:true});}
        finally{state.pendingJump=null;}
        return;
      }
      const action=e.target.closest('[data-study-action]')?.dataset.studyAction;
      if(action==='close-word')$('study-word-dialog').close();
      if(action==='reload')await loadView();
      if(action==='word-retry')await openWord(state.word);
      if(action==='occurrences')await loadOccurrences(0);
      if(action==='previous-occurrences')await loadOccurrences(state.page-1);
      if(action==='next-occurrences')await loadOccurrences(state.page+1);
      if(action==='retry-occurrences')await loadOccurrences(state.page);
      if(action==='note' && state.verse>0)await window.ADPELBible.noteForVerse(state.verse);
      if(action==='previous-verse'||action==='next-verse')await stepVerse(action==='previous-verse'?-1:1);
    });
  }
  function availableVerses(c=state.context) {
    if(!c?.book)return [];
    return [...new Set([...c.verses.map(v=>v.verse),...(state.catalogs.get(c.book.id+':'+c.chapter)||[])])].sort((a,b)=>a-b);
  }
  function syncStudyMode(enabled){
    document.querySelectorAll('.study-mode-switch [data-study-mode]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.studyMode==='study')===enabled)));
    $('bible-study-panel')?.classList.toggle('hidden',!enabled);
    $('bible-verses-content')?.classList.toggle('study-reading-hidden',enabled);
  }
  async function setEnabled(enabled) {
    if(state.enabled===enabled)return;
    const context=window.ADPELBible?.getContext();
    if(enabled&&(!context?.book||!context.verses.length))return;
    window.ADPELBible?.clearSelection?.();
    state.enabled=enabled;state.generation++;state.wordRequest++;
    syncStudyMode(enabled);
    if(enabled){
      state.context=context;
      const available=availableVerses();
      if(!available.includes(state.verse))state.verse=available[0]??1;
      updateVerseOptions();
      $('bible-study-panel')?.scrollIntoView({behavior:'auto',block:'start'});
      await loadView();
    }else{
      if($('study-word-dialog')?.open)$('study-word-dialog').close();
      window.ADPELBible?.focusReadingVerse?.(state.verse);
    }
  }
  function updateVerseOptions() {
    const c=state.context;
    if(!c?.book)return;
    const available=availableVerses(c);
    $('study-verse-select').innerHTML=available.map(v=>`<option value="${v}">${v===0?'Título (fonte original)':v+(c.verses.some(x=>x.verse===v)?'':' (fonte original)')}</option>`).join('');
    $('study-verse-select').value=String(state.verse);
    $('study-reference').textContent=reference(c.book.name_pt,c.chapter,state.verse);
    $('study-translation').textContent=c.translation?.short_name||'Tradução portuguesa';
    $('study-portuguese').textContent=c.verses.find(v=>v.verse===state.verse)?.text||'Esta referência pertence à numeração da fonte original; compare a numeração da tradução portuguesa.';
    document.querySelector('[data-study-action="note"]').disabled=!c.verses.some(v=>v.verse===state.verse);
    const position=available.indexOf(state.verse);
    document.querySelector('[data-study-action="previous-verse"]').disabled=position<=0;
    document.querySelector('[data-study-action="next-verse"]').disabled=position<0||position>=available.length-1;
  }
  async function stepVerse(direction){
    const available=availableVerses(),next=available[available.indexOf(state.verse)+direction];
    if(next!==undefined)await openVerse(next,false,true);
  }
  async function openVerse(verse,scroll=true,keepTab=false) {
    const number=Number(verse);
    if(!Number.isInteger(number)||number<0)return;
    state.context=window.ADPELBible?.getContext()||state.context;
    if(!availableVerses().includes(number))return;
    state.verse=number;
    if(!keepTab)state.tab='original';
    window.ADPELBible?.clearSelection?.();
    if(!state.enabled)await setEnabled(true);
    else {
      updateVerseOptions();
      if(scroll)$('bible-study-panel')?.scrollIntoView({behavior:'auto',block:'start'});
      await loadView();
    }
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
    state.original=null;state.tokens=[];
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
  function renderOriginal(original,tokens,source) {
    const rtl=original.language!=='grc';
    const tokenLanguage=t=>original.language==='grc'?'grc':t.morphology_code?.startsWith('A')?'arc':'he';
    const label=[...new Set(tokens.map(t=>languages[tokenLanguage(t)]))].join(' / ');
    $('study-content').innerHTML=`<div class="study-source-label"><strong>${escapeHtml(label||languages[original.language])}</strong><span>${escapeHtml(original.metadata?.basis||source?.name||'Texto original')}</span></div>
      <details class="study-original-text"><summary>Ver texto original completo</summary><p lang="${escapeHtml(original.language)}" dir="${rtl?'rtl':'ltr'}">${escapeHtml(original.text_original||'')}</p></details>
      <div class="study-section-heading"><h4>Palavra por palavra</h4><p>Toque para ver o significado, a gramática e as ocorrências.</p></div>
      <div class="study-interlinear" dir="${rtl?'rtl':'ltr'}">${tokens.map(t=>`<button type="button" class="study-token" data-study-token="${t.id}" aria-label="Estudar ${escapeHtml(t.surface)}"><span class="study-original-word" lang="${tokenLanguage(t)}" dir="auto">${escapeHtml(t.surface)}</span><span class="study-transliteration" dir="ltr">${escapeHtml(t.transliteration||'—')}</span><span class="study-gloss" dir="ltr">${escapeHtml(t.gloss_pt||t.metadata?.gloss_en||'—')}${!t.gloss_pt&&t.metadata?.gloss_en?'<small> inglês</small>':''}</span><small class="study-strong-badge" dir="ltr">${escapeHtml(t.strong_number||'')}</small></button>`).join('')}</div>
      <details class="study-method"><summary>Como interpretar este interlinear</summary><p>As glossas são pistas de sentido, não uma tradução palavra por palavra. A numeração e algumas leituras da fonte STEP podem diferir da ${escapeHtml(state.context.translation?.short_name||'tradução portuguesa')}. ${rtl?'Uma palavra hebraica ou aramaica pode reunir raiz, prefixos e sufixos; o Strong exibido aponta para a raiz selecionada.':'O grego exibido é a seleção principal N do TAGNT, com grafia e pontuação da fonte STEP; não é uma transcrição do Textus Receptus da ACF.'} A etimologia e os possíveis sentidos de um lema não substituem o contexto da passagem.</p></details>${sourceFooter(source)}`;
  }
  async function openWord(token) {
    if(!token||!state.original)return;
    const request=++state.wordRequest,original=state.original;
    const language=original.language==='grc'?'grc':token.morphology_code?.startsWith('A')?'arc':'he';
    state.word=token;state.page=0;
    $('study-word-title').textContent=token.surface;
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
      $('study-word-content').innerHTML=`<div class="study-word-meta"><span>${escapeHtml(languages[language])}</span><strong>${escapeHtml(token.strong_number)}</strong>${entry?.strong_number!==token.strong_number?`<small>STEP: ${escapeHtml(entry?.strong_number||'—')}</small>`:''}</div>
        <p class="study-word-lemma" lang="${original.language}" dir="auto">${escapeHtml(entry?.lemma||token.lemma||token.surface)}</p><p class="study-help">${escapeHtml(entry?.transliteration||token.transliteration||'')}</p>
        <h4>Sentido lexical</h4><p>${escapeHtml(entry?.definition_short_pt||entry?.gloss_pt||token.gloss_pt||'Glossa portuguesa ainda não disponível.')}</p>
        ${entry?.definition_long_pt?`<p class="study-preserve">${escapeHtml(entry.definition_long_pt)}</p>`:''}
        ${entry?.metadata?.gloss_en||token.metadata?.gloss_en?`<small>Glossa da fonte em inglês: ${escapeHtml(entry?.metadata?.gloss_en||token.metadata.gloss_en)}</small>`:''}
        ${!entry?'<p class="study-help">Esta palavra tem Strong e dados do texto marcado, mas não possui uma entrada vinculada no léxico importado.</p>':''}
        ${entry?.metadata?.definition_en?`<details class="study-method"><summary>Léxico da fonte (inglês)</summary><p>${escapeHtml(entry.metadata.definition_en)}</p></details>`:''}
        <h4>Morfologia nesta passagem</h4><code>${escapeHtml(token.morphology_code||'Não informada pela fonte')}</code><p class="study-preserve">${escapeHtml(grammar||'Análise não informada pela fonte.')}</p>
        ${original.language!=='grc'&&token.metadata?.components?`<p class="study-help">Raiz, prefixos e sufixos: ${escapeHtml(token.metadata.components)}</p>`:''}
        <p class="study-help">O sentido na passagem depende do contexto; nem todos os sentidos possíveis se aplicam ao mesmo uso.</p>
        <button type="button" class="study-primary" data-study-action="occurrences">Ver ocorrências de ${escapeHtml(token.strong_number)}</button><div id="study-occurrences"></div>${sourceFooter(source)}`;
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
      host.innerHTML=`<h4>${state.total} ocorrências no acervo importado</h4><p class="study-help">Cada uso conta uma ocorrência. Um versículo pode aparecer mais de uma vez. A pesquisa reúne os sentidos do Strong tradicional.</p><div class="study-reference-list">${(data||[]).map(t=>{const v=t.bible_original_verses;return `<button type="button" data-study-jump="${escapeHtml(v.book_id)}" data-study-chapter="${v.chapter}" data-study-verse="${v.verse}"><span>${escapeHtml(reference(names.get(v.book_id)||v.book_id,v.chapter,v.verse))}</span><small>${escapeHtml(t.surface)} · posição ${t.token_position}</small></button>`;}).join('')||'<p>Nenhuma ocorrência disponível.</p>'}</div><div class="study-pagination"><button type="button" data-study-action="previous-occurrences" ${page===0?'disabled':''}>Anterior</button><span>${page+1} / ${Math.max(1,Math.ceil(state.total/PAGE_SIZE))}</span><button type="button" data-study-action="next-occurrences" ${(page+1)*PAGE_SIZE>=state.total?'disabled':''}>Próxima</button></div>`;
    }catch(error){if(request===state.wordRequest)showError(host,'Não foi possível carregar as ocorrências.','retry-occurrences');console.error('Concordância:',error.message);}
  }
  document.addEventListener('adpel:bible-chapter',e=>{
    state.context=e.detail;
    const jump=state.pendingJump;
    state.verse=jump&&jump.book===e.detail.book?.id&&jump.chapter===e.detail.chapter?jump.verse:(e.detail.verses[0]?.verse??1);
    state.generation++;state.wordRequest++;
    if($('study-word-dialog')?.open)$('study-word-dialog').close();
    if(state.enabled){mount();updateVerseOptions();loadView();}
  });
  document.addEventListener('DOMContentLoaded',()=>{mount();state.context=window.ADPELBible?.getContext();});
  window.ADPELBibleStudy={openVerse};
  if(typeof module!=='undefined'&&module.exports)module.exports={plainStrong,morphologyParts,safeUrl};
})();
