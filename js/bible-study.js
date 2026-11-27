(function () {
  'use strict';
  const PAGE_SIZE = 25;
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const languages = {he:'Hebraico',arc:'Aramaico',grc:'Grego koiné'};
  const state = {enabled:false,context:null,verse:1,tab:'overview',range:null,generation:0,wordRequest:0,original:null,tokens:[],sources:new Map(),lexicon:new Map(),morphology:new Map(),catalogs:new Map(),word:null,page:0,total:0};
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

  const aoBase='https://bible.helloao.org/api/';
  const aoSources=Object.freeze({
    'matthew-henry':{label:'Matthew Henry',license:'Domínio público',url:'https://creativecommons.org/publicdomain/mark/1.0/'},
    'john-gill':{label:'John Gill',license:'Domínio público',url:'https://creativecommons.org/publicdomain/mark/1.0/'},
    'tyndale':{label:'Tyndale Open Study Notes',license:'CC BY-SA 4.0',url:'https://creativecommons.org/licenses/by-sa/4.0/'},
    'open-cross-ref':{label:'OpenBible.info',license:'CC BY 4.0',url:'https://creativecommons.org/licenses/by/4.0/'}
  });
  const aoCache=new Map(),aoInflight=new Map();
  let aoRequest=0;
  const aoKnown=id=>Object.prototype.hasOwnProperty.call(aoSources,id);
  function aoUrl(id,book,chapter){
    if(!aoKnown(id)||!/^[A-Z0-9]{3}$/.test(book)||!Number.isInteger(chapter)||chapter<1||chapter>150)throw new Error('Referência inválida.');
    return aoBase+(id==='open-cross-ref'?'d/':'c/')+id+'/'+book+'/'+chapter+(id==='open-cross-ref'?'.json':'.simple.json');
  }
  function aoValidate(p,id,book,chapter){
    const meta=id==='open-cross-ref'?p?.dataset:p?.commentary;
    if(!aoKnown(id)||meta?.id!==id||p?.book?.id!==book||p?.chapter?.number!==chapter||!Array.isArray(p.chapter.content)||p.chapter.content.length>1500)throw new Error('Resposta incompatível.');
    if(String(meta.licenseUrl||'').replace(/\/$/,'')!==aoSources[id].url.replace(/\/$/,''))throw new Error('Licença não confirmada.');
    if(id!=='open-cross-ref'&&meta.language!=='eng')throw new Error('Idioma incompatível.');
    return p;
  }
  async function aoFetch(id,book,chapter){
    const url=aoUrl(id,book,chapter),cached=aoCache.get(url);
    if(cached&&Date.now()-cached.at<300000)return cached.value;
    if(aoInflight.has(url))return aoInflight.get(url);
    const task=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        const res=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
        if(res.status===404)return null;
        if(!res.ok)throw new Error('Fonte indisponível.');
        const body=await res.text();
        if(body.length>3500000)throw new Error('Capítulo externo muito grande.');
        const value=aoValidate(JSON.parse(body),id,book,chapter);
        aoCache.set(url,{at:Date.now(),value});
        while(aoCache.size>12)aoCache.delete(aoCache.keys().next().value);
        return value;
      }finally{clearTimeout(timer);}
    })();
    aoInflight.set(url,task);
    try{return await task;}finally{aoInflight.delete(url);}
  }
  function aoCredit(id,p,url){
    const info=aoSources[id],meta=id==='open-cross-ref'?p.dataset:p.commentary;
    return '<footer class="study-attribution">Fonte: '+escapeHtml(info.label)+' · via HelloAO · <a href="'+info.url+'" target="_blank" rel="noopener noreferrer">'+info.license+'</a> · <a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Dados da fonte</a>'+(id==='open-cross-ref'?' · <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener noreferrer">OpenBible.info</a> · referências reorganizadas e nomes em português.':' · Texto em inglês, apresentação simplificada. Não é posição doutrinária oficial da ADPEL.')+(meta.licenseNotice?'<p>'+escapeHtml(meta.licenseNotice)+'</p>':'')+(meta.licenseNotes?'<p lang="en">'+escapeHtml(meta.licenseNotes)+'</p>':'')+'</footer>';
  }

  // Native on-device translation. No cloud provider, API key or private data.
  function splitTranslationText(text,max=1800){
    if(typeof text!=='string'||!Number.isInteger(max)||max<2)throw new Error('Texto inválido.');
    const chunks=[];
    let rest=text;
    while(rest.length>max){
      let end=rest.lastIndexOf(' ',max);
      if(end<Math.floor(max/2))end=max;
      // Preserve UTF-16 surrogate pairs and all original whitespace.
      if(/[\uD800-\uDBFF]/.test(rest[end-1]))end--;
      chunks.push(rest.slice(0,end));rest=rest.slice(end);
    }
    if(rest.length)chunks.push(rest);
    return chunks;
  }
  async function translateCommentText(translator,text,current=()=>true){
    const parts=[];
    for(const chunk of splitTranslationText(text)){
      if(!current())throw new Error('Tradução cancelada.');
      if(!chunk.trim()){parts.push(chunk);continue;}
      const translated=await translator.translate(chunk);
      if(!current())throw new Error('Tradução cancelada.');
      if(typeof translated!=='string'||!translated.trim())throw new Error('Tradução vazia.');
      parts.push(translated.trim());
    }
    return parts.join(' ');
  }
  function aoTranslationEntry(text,footnotes=[]){
    const notes=footnotes.filter(n=>typeof n?.text==='string'&&n.text.trim());
    const full=[text,...notes.map((n,i)=>'Nota '+(i+1)+': '+n.text)].join('\n\n');
    return '<div class="study-translation-entry"><div class="study-guide-actions"><button type="button" data-ao-translate>Traduzir para português</button><button type="button" data-ao-copy>Copiar original</button></div>'+
      '<p class="study-translation-status" role="status"></p><div class="study-translated-text" lang="pt-BR" hidden></div>'+
      '<details class="study-original-language" open><summary>Original em inglês</summary><p class="study-external-text" lang="en">'+escapeHtml(text)+'</p>'+
      notes.map((n,i)=>'<p class="study-help" lang="en">Nota '+(i+1)+': '+escapeHtml(n.text)+'</p>').join('')+'</details>'+
      '<span class="study-translation-input" hidden>'+escapeHtml(full)+'</span></div>';
  }
  function aoTranslationFallback(status){
    status.textContent='A tradução interna não está disponível neste navegador. Copie o original e cole no tradutor gratuito de sua preferência. ';
    const link=document.createElement('a');link.href='https://translate.google.com/?sl=en&tl=pt&op=translate';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir Google Tradutor';status.appendChild(link);
  }
  async function aoTranslate(button){
    const entry=button.closest('.study-translation-entry');
    if(!entry||button.disabled)return;
    const host=$('study-ao-result'),generation=state.generation,request=aoRequest;
    const status=entry.querySelector('.study-translation-status'),out=entry.querySelector('.study-translated-text'),original=entry.querySelector('.study-original-language'),input=entry.querySelector('.study-translation-input');
    const current=()=>state.enabled&&generation===state.generation&&request===aoRequest&&$('study-ao-result')===host&&entry.isConnected;
    if(!current()||!input?.textContent.trim())return;
    if(out.textContent){out.hidden=!out.hidden;original.open=out.hidden;button.textContent=out.hidden?'Ver tradução':'Ocultar tradução';return;}
    const API=window.Translator;
    if(typeof API?.create!=='function'){aoTranslationFallback(status);return;}
    // Explicit click allows first-time language pack download.
    let translator;
    button.disabled=true;status.textContent='Preparando tradução local…';
    try{
      translator=await API.create({sourceLanguage:'en',targetLanguage:'pt',monitor(m){m.addEventListener('downloadprogress',e=>{if(current())status.textContent='Baixando idioma: '+Math.round(e.loaded*100)+'%';});}});
      if(!current())return;
      status.textContent='Traduzindo o comentário…';
      const translated=await translateCommentText(translator,input.textContent,current);
      if(!current())return;
      out.textContent=translated;out.hidden=false;original.open=false;
      button.textContent='Ocultar tradução';
      status.textContent='Tradução automática não revisada. Confira o original em caso de dúvida. Mantida a licença da fonte.';
    }catch(e){if(current())aoTranslationFallback(status);}
    finally{try{translator?.destroy?.();}catch(_){}if(current())button.disabled=false;}
  }
  async function aoCopy(button){
    const entry=button.closest('.study-translation-entry'),status=entry?.querySelector('.study-translation-status'),text=entry?.querySelector('.study-translation-input')?.textContent;
    if(!status||!text)return;
    try{await navigator.clipboard.writeText(text);if(entry.isConnected)status.textContent='Original copiado. Cole no tradutor de sua preferência.';}
    catch(e){if(entry.isConnected)status.textContent='Não foi possível copiar automaticamente. Selecione o texto original e copie manualmente.';}
  }
  function aoCommentMarkup(p,scope){
    const rows=p.chapter.content.filter(x=>x?.type==='verse'&&Number.isInteger(x.number)&&x.number>=0&&x.number<=200&&typeof x.text==='string'&&x.text.trim());
    const intro=typeof p.chapter.introduction==='string'?p.chapter.introduction:'';
    const matching=rows.filter(x=>x.number>=scope.start&&x.number<=scope.end);
    const other=rows.filter(x=>!matching.includes(x));
    const render=x=>'<details class="study-original-text"><summary>Entrada da fonte · versículo '+x.number+'</summary>'+aoTranslationEntry(x.text,Array.isArray(x.footnotes)?x.footnotes:[])+'</details>';
    return '<p class="study-help">Abra uma entrada e toque em Traduzir para português. A tradução local depende do navegador; quando indisponível, copie o original para um tradutor gratuito. A numeração e as interpretações podem diferir da edição portuguesa. Entradas numeradas podem comentar mais de um versículo.</p>'+
      (intro?'<details class="study-original-text"><summary>Introdução do capítulo</summary>'+aoTranslationEntry(intro)+'</details>':'')+
      (matching.length?'<h4>No intervalo selecionado</h4>'+matching.map(render).join(''):'<p class="study-status">Não há entrada numerada exatamente neste intervalo.</p>')+
      (other.length?'<details class="study-original-text"><summary>Outras entradas do capítulo ('+other.length+')</summary>'+other.map(render).join('')+'</details>':'')+
      (!rows.length&&!intro?'<p class="study-status">Nenhum comentário textual nesta resposta.</p>':'');
  }
  function aoReferenceRows(p,scope,catalog){
    const grouped=new Map();
    for(const entry of p.chapter.content){
      if(!Number.isInteger(entry?.verse)||entry.verse<scope.start||entry.verse>scope.end||!Array.isArray(entry.references))continue;
      for(const x of entry.references){
        const book=catalog.find(b=>b.id===x?.book),end=x?.endVerse??x?.verse;
        if(!book||!Number.isInteger(x.chapter)||x.chapter<1||x.chapter>book.chapter_count||!Number.isInteger(x.verse)||!Number.isInteger(end)||x.verse<1||end<x.verse||end>200)continue;
        const key=[book.id,x.chapter,x.verse,end].join(':'),score=Number.isFinite(x.score)?x.score:0;
        if(!grouped.has(key))grouped.set(key,{book:book.id,name:book.name_pt,chapter:x.chapter,verse:x.verse,end,score,from:new Set()});
        const row=grouped.get(key);row.score=Math.max(row.score,score);row.from.add(entry.verse);
      }
    }
    return [...grouped.values()].sort((a,b)=>b.score-a.score).map(x=>({...x,from:[...x.from].sort((a,b)=>a-b)}));
  }
  function aoReferenceMarkup(p,scope,catalog,translation){
    const rows=aoReferenceRows(p,scope,catalog),show=rows.slice(0,100);
    const render=r=>{const url='bible.html?book='+encodeURIComponent(r.book)+'&chapter='+r.chapter+'&verse='+r.verse+(r.end>r.verse?'&end='+r.end:'')+(/^[a-z0-9_-]{2,40}$/i.test(translation||'')?'&translation='+encodeURIComponent(translation):'');
      return '<a class="study-external-ref" href="'+escapeHtml(url)+'"><strong>'+escapeHtml(reference(r.name,r.chapter,r.verse))+(r.end>r.verse?'–'+r.end:'')+'</strong><small>Relacionado a '+r.from.join(', ')+'</small></a>';};
    return rows.length?'<p class="study-help">'+rows.length+' passagens relacionadas; '+(rows.length>100?'100 primeiras exibidas por pontuação da fonte. ':'')+'Toque para ler na Bíblia em português. A relação sugerida não determina o sentido do texto.</p><div class="study-reference-list">'+show.slice(0,10).map(render).join('')+'</div>'+(show.length>10?'<details class="study-original-text"><summary>Mais referências ('+(show.length-10)+')</summary><div class="study-reference-list">'+show.slice(10).map(render).join('')+'</div></details>':''):'<p class="study-status">Nenhuma referência externa encontrada para este intervalo.</p>';
  }
  function aoPanel(tab){
    if(!['overview','comments','references'].includes(tab))return;
    $('study-content').insertAdjacentHTML('afterbegin','<section class="study-comment study-external"><h4>Biblioteca de estudo externa</h4><p class="study-help">Consulta gratuita à HelloAO. Enviamos somente a referência bíblica, sem sessão, notas ou credenciais. Requer internet.</p><div class="study-guide-actions">'+(tab!=='references'?['matthew-henry','john-gill','tyndale'].map(id=>'<button type="button" data-ao-source="'+id+'">'+aoSources[id].label+'</button>').join(''):'')+(tab!=='comments'?'<button type="button" data-ao-source="open-cross-ref">Passagens relacionadas</button>':'')+'</div><div id="study-ao-result" aria-live="polite"></div></section>');
    if(tab==='references')void loadAo('open-cross-ref');
  }
  async function loadAo(id){
    const host=$('study-ao-result'),c=state.context,tab=state.tab,generation=state.generation,request=++aoRequest;
    if(!host||!state.enabled||!c?.book||!aoKnown(id))return;
    const selected=tab==='overview'?state.range:{start:state.verse,end:state.verse};
    const numbers=c.verses.map(v=>Number(v.verse)).filter(v=>v>=1&&v<=200);
    if(!numbers.length){host.textContent='Nenhuma referência disponível nesta tradução.';return;}
    const scope=selected&&validRange(c,selected.start,selected.end)?selected:tab==='overview'?{start:Math.min(...numbers),end:Math.max(...numbers)}:null;
    if(!scope){host.textContent='Esta numeração da fonte original não está disponível na tradução portuguesa.';return;}
    host.innerHTML='<p class="study-status" role="status">Carregando '+escapeHtml(aoSources[id].label)+'…</p>';
    const current=()=>state.enabled&&state.generation===generation&&aoRequest===request&&$('study-ao-result')===host;
    try{
      const p=await aoFetch(id,c.book.id,c.chapter);
      if(!current())return;
      if(!p){host.textContent='A fonte não possui este capítulo.';return;}
      const catalog=window.ADPELBibleReferences?.books||[];
      if(id==='open-cross-ref'&&!catalog.length)throw new Error('Catálogo indisponível.');
      host.innerHTML='<h4>'+escapeHtml(aoSources[id].label)+'</h4>'+(id==='open-cross-ref'?aoReferenceMarkup(p,scope,catalog,c.translation?.code):aoCommentMarkup(p,scope))+aoCredit(id,p,aoUrl(id,c.book.id,c.chapter));
    }catch(e){if(current())host.innerHTML='<p class="study-status" role="alert">Não foi possível consultar esta fonte externa agora. Os recursos locais continuam disponíveis.</p><button type="button" data-ao-source="'+id+'">Tentar novamente</button>';}
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
      <nav class="study-tabs" aria-label="Ferramentas de estudo"><button type="button" data-study-tab="overview" aria-pressed="true"><i class="fas fa-book-open" aria-hidden="true"></i> Entender</button><button type="button" data-study-tab="original" aria-pressed="false"><i class="fas fa-language" aria-hidden="true"></i> Originais</button><button type="button" data-study-tab="comments" aria-pressed="false"><i class="fas fa-book" aria-hidden="true"></i> Comentários</button><button type="button" data-study-tab="references" aria-pressed="false"><i class="fas fa-link" aria-hidden="true"></i> Referências</button></nav>
      <div id="study-content" aria-live="polite"></div>
    </section>`);
    document.body.insertAdjacentHTML('beforeend',`<dialog id="study-word-dialog" class="study-word-dialog" aria-labelledby="study-word-title"><div class="study-heading"><h3 id="study-word-title">Estudo da palavra</h3><button type="button" data-study-action="close-word" aria-label="Fechar estudo da palavra">×</button></div><div id="study-word-content" aria-live="polite"></div></dialog>`);
    $('study-verse-select').addEventListener('change',e=>openVerse(Number(e.target.value),false,true));
    $('study-word-dialog').addEventListener('close',()=>state.wordRequest++);
    $('study-word-dialog').addEventListener('click',e=>{if(e.target===$('study-word-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.target.close();}});
    document.addEventListener('click',async e=>{
      const translate=e.target.closest('[data-ao-translate]');
      if(translate){await aoTranslate(translate);return;}
      const copy=e.target.closest('[data-ao-copy]');
      if(copy){await aoCopy(copy);return;}
      const ao=e.target.closest('[data-ao-source]');
      if(ao){await loadAo(ao.dataset.aoSource);return;}
      const mode=e.target.closest('[data-study-mode]');
      if(mode){if(mode.dataset.studyMode==='study'&&!state.enabled){state.tab='overview';state.range=null;}await setEnabled(mode.dataset.studyMode==='study');return;}
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
      if(action==='whole-chapter'){state.range=null;await loadView();}
      if(action==='apply-range'){
        const start=Number($('study-range-start')?.value),end=Number($('study-range-end')?.value);
        if(!validRange(state.context,start,end)){$('study-range-error').textContent='Escolha um intervalo válido: o início deve vir antes do fim.';return;}
        state.range={start,end};state.verse=start;updateVerseOptions();await loadView();
      }
      if(action==='guided-tutor'){
        const start=Number(e.target.closest('[data-study-action]').dataset.start),end=Number(e.target.closest('[data-study-action]').dataset.end);
        openGuidedTutor(start,end);
      }
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
    if(!keepTab){state.tab='overview';state.range={start:number,end:number};}
    window.ADPELBible?.clearSelection?.();
    if(!state.enabled)await setEnabled(true);
    else {
      updateVerseOptions();
      if(scroll)$('bible-study-panel')?.scrollIntoView({behavior:'auto',block:'start'});
      await loadView();
    }
  }
  function validRange(c,start,end){
    const numbers=new Set((c?.verses||[]).map(v=>Number(v.verse)));
    return Number.isInteger(start)&&Number.isInteger(end)&&start>=1&&end>=start&&numbers.has(start)&&numbers.has(end);
  }
  async function openPassage(start,end){
    const c=window.ADPELBible?.getContext();
    if(!validRange(c,start,end))return;
    state.context=c;state.range={start,end};state.tab='overview';
    await openVerse(start,true,true);
  }
  function openGuidedTutor(start,end){
    const c=state.context;
    if(!validRange(c,start,end)||end-start+1>10||end>200)return;
    const context={book_id:c.book.id,book_name:c.book.name_pt,chapter:c.chapter,verse_start:start,verse_end:end,translation_code:c.translation?.code||'acf'};
    if(window.ADPELTutor?.openWithBibleContext(context))return;
    const params=new URLSearchParams({tutor:'1',...Object.fromEntries(Object.entries(context).map(([key,value])=>[key,String(value)]))});
    window.location.href='index.html?'+params.toString()+'#tutor';
  }
  function guidedMarkup(c,range,comments,sources){
    const verses=c.verses.filter(v=>Number(v.verse)>=1);
    const scoped=verses.filter(v=>!range||(v.verse>=range.start&&v.verse<=range.end));
    const first=Number(scoped[0]?.verse),last=Number(scoped[scoped.length-1]?.verse);
    const options=selected=>verses.map(v=>'<option value="'+Number(v.verse)+'" '+(Number(v.verse)===selected?'selected':'')+'>'+Number(v.verse)+'</option>').join('');
    const tutorRanges=[];
    for(let i=0;i<scoped.length;){
      const start=Number(scoped[i].verse);
      let j=i;
      while(j+1<scoped.length&&j+1<i+10&&Number(scoped[j+1].verse)-start<10)j++;
      const end=Number(scoped[j].verse);
      if(validRange(c,start,end)&&end<=200)tutorRanges.push({start,end});
      i=j+1;
    }
    const label=range?'Trecho '+first+(first===last?'':'–'+last):'Capítulo inteiro';
    const cards=comments.map((x,i)=>'<article class="study-comment study-guide-comment"><span class="study-eyebrow">Versículos '+Number(x.verse_start)+'–'+Number(x.verse_end)+'</span><h4>'+escapeHtml(x.title)+'</h4><small>'+escapeHtml(x.author_name||'Autor não informado')+(x.metadata?.ai_assisted?' · Conteúdo assistido por IA':'')+'</small><p class="study-preserve">'+escapeHtml(x.content)+'</p>'+sourceFooter(sources[i])+'</article>').join('');
    return '<section class="study-guide"><h4>Entenda a passagem</h4><p>Comece pelo contexto e pela mensagem. Os detalhes do idioma original ficam na aba Originais.</p>'+
      '<div class="study-guide-range"><strong>'+escapeHtml(label)+'</strong><div class="study-guide-selects"><label>Do versículo<select id="study-range-start">'+options(first)+'</select></label><label>Até o versículo<select id="study-range-end">'+options(last)+'</select></label></div><div class="study-guide-actions"><button type="button" data-study-action="apply-range">Estudar trecho</button><button type="button" data-study-action="whole-chapter">Capítulo inteiro</button></div><p id="study-range-error" role="alert"></p></div>'+
      '<details class="study-original-text"><summary>Ler '+(range?'o trecho':'o capítulo')+' na Bíblia · '+escapeHtml(c.translation?.short_name||'Português')+'</summary><div class="study-guide-text">'+scoped.map(v=>'<p><strong>'+Number(v.verse)+'</strong> '+escapeHtml(v.text)+'</p>').join('')+'</div></details>'+
      '<h4>Explicações publicadas</h4>'+(cards||'<p class="study-status">Ainda não há estudo editorial publicado para este '+(range?'trecho':'capítulo')+'. Você pode ler o texto e usar o guia abaixo ou conversar com o Tutor.</p>')+
      '<article class="study-comment"><h4>Guia para sua leitura</h4><ol class="study-guide-questions"><li>Qual é a mensagem principal do texto?</li><li>O que aprendemos sobre Deus e as pessoas?</li><li>Como posso colocar esse ensino em prática?</li></ol><p class="study-help">Leia os versículos anteriores e posteriores para entender o contexto.</p></article>'+
      '<article class="study-comment"><h4>Precisa de uma explicação em palavras simples?</h4><p>Abra o Tutor Teológico com o trecho escolhido e pergunte sobre contexto, ensinamentos e aplicação. Requer login; nenhuma pergunta é enviada automaticamente.</p><div class="study-guide-actions">'+tutorRanges.map(r=>'<button type="button" data-study-action="guided-tutor" data-start="'+r.start+'" data-end="'+r.end+'">Tutor · '+r.start+(r.start===r.end?'':'–'+r.end)+'</button>').join('')+'</div>'+(tutorRanges.length>1?'<p class="study-help">O Tutor aceita até 10 versículos por consulta. Os blocos acima respeitam esse limite; não representam divisões temáticas.</p>':'')+'</article></section>';
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
    $('bible-study-panel')?.classList.toggle('study-guided',tab==='overview');
    if(tab==='overview')$('study-reference').textContent=c.book.name_pt+' '+c.chapter;
    else updateVerseOptions();
    state.original=null;state.tokens=[];
    $('study-content').innerHTML='<p class="study-status" role="status">Carregando estudo…</p>';
    try {
      if(tab==='overview'){
        const range=state.range&&validRange(c,state.range.start,state.range.end)?state.range:null;
        let query=client().from('bible_commentaries').select('id,title,content,category,author_name,source_code,metadata,verse_start,verse_end').eq('book_id',c.book.id).eq('chapter',c.chapter).eq('is_active',true);
        if(range)query=query.lte('verse_start',range.end).gte('verse_end',range.start);
        const {data,error}=await query.order('verse_start').order('verse_end').order('id').limit(100);
        if(error)throw error;if(request!==state.generation)return;
        const sources=await Promise.all((data||[]).map(x=>getSource(x.source_code)));
        if(request!==state.generation)return;
        $('study-content').innerHTML=guidedMarkup(c,range,data||[],sources);
      }else if(tab==='original'){
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
    if(request===state.generation&&state.enabled)aoPanel(tab);
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
    state.range=null;
    const jump=state.pendingJump;
    state.verse=jump&&jump.book===e.detail.book?.id&&jump.chapter===e.detail.chapter?jump.verse:(e.detail.verses[0]?.verse??1);
    state.generation++;state.wordRequest++;
    if($('study-word-dialog')?.open)$('study-word-dialog').close();
    if(state.enabled){mount();updateVerseOptions();loadView();}
  });
  document.addEventListener('DOMContentLoaded',()=>{mount();state.context=window.ADPELBible?.getContext();});
  window.ADPELBibleStudy={openVerse,openPassage};
  if(typeof module!=='undefined'&&module.exports)module.exports={plainStrong,morphologyParts,safeUrl,validRange,guidedMarkup,aoUrl,aoValidate,aoReferenceRows,aoReferenceMarkup,aoCommentMarkup,aoFetch,splitTranslationText,translateCommentText};
})();
