(function () {
  'use strict';
  const $=id=>document.getElementById(id), client=()=>window.supabaseClient;
  const esc=value=>window.escapeHtml(value);
  const state={books:[],items:[],page:0,total:0,request:0,formMetadata:{}};
  const chapterModels=[
  {
    "book_id": "GEN",
    "chapter": 1,
    "verse_start": 1,
    "verse_end": 31,
    "category": "expositivo",
    "title": "Gênesis 1 — Deus cria com propósito",
    "content": "RESUMO\nDeus cria os céus e a terra, organiza a criação e declara que ela é boa. O ser humano é criado à imagem de Deus.\n\nCONTEXTO\nO primeiro capítulo abre a narrativa bíblica apresentando Deus como Criador. O relato continua em Gênesis 2:1–3, com o descanso do sétimo dia.\n\nENTENDA POR PARTES\n1–5: Deus cria a luz e separa luz e trevas.\n6–25: Deus ordena os céus, a terra, os seres vivos e os ciclos do mundo criado.\n26–31: Deus cria a humanidade à sua imagem e lhe atribui responsabilidade sobre a criação.\n\nAPLICAÇÃO\nReconheça a dignidade de cada pessoa e cuide da criação com responsabilidade.\n\nREFLEXÃO\nComo reconhecer Deus como Criador muda a forma como trato as pessoas e o mundo?\n\nLEITURAS RELACIONADAS\nGênesis 2:1–3; Salmos 8:3–8; João 1:1–3."
  },
  {
    "book_id": "JHN",
    "chapter": 3,
    "verse_start": 1,
    "verse_end": 36,
    "category": "expositivo",
    "title": "João 3 — Novo nascimento e fé em Cristo",
    "content": "RESUMO\nJesus ensina a Nicodemos sobre o novo nascimento. O capítulo apresenta o amor de Deus, a fé no Filho e o testemunho de João Batista.\n\nCONTEXTO\nNicodemos era fariseu e autoridade entre os judeus. Ele procura Jesus à noite e ouve que é necessário nascer de novo. O diálogo aponta para uma transformação espiritual, não apenas conhecimento religioso.\n\nENTENDA POR PARTES\n1–8: Jesus fala sobre nascer de novo e a obra do Espírito.\n9–21: o texto apresenta a necessidade de crer no Filho, a salvação e o contraste entre luz e trevas.\n22–36: João Batista aponta para a superioridade de Jesus e a importância de crer nele.\n\nAPLICAÇÃO\nExamine se sua fé está limitada ao conhecimento ou se produz mudança na maneira de viver. Reconheça Cristo como centro da caminhada cristã.\n\nREFLEXÃO\nO que significa viver uma vida transformada pelo Espírito?\n\nLEITURAS RELACIONADAS\nNúmeros 21:4–9; João 1:12–13; Tito 3:4–7."
  },
  {
    "book_id": "PHP",
    "chapter": 4,
    "verse_start": 1,
    "verse_end": 23,
    "category": "expositivo",
    "title": "Filipenses 4 — Paz, contentamento e perseverança",
    "content": "RESUMO\nPaulo incentiva a união, a alegria no Senhor, a oração e o contentamento, agradecendo a ajuda dos filipenses.\n\nCONTEXTO\nPaulo escreve enquanto está preso (Filipenses 1:12–14). O capítulo final mostra como a fé se manifesta mesmo diante de dificuldades.\n\nENTENDA POR PARTES\n1–3: permaneçam firmes e busquem a reconciliação.\n4–9: apresentem suas preocupações a Deus em oração e cultivem pensamentos que honram a Deus.\n10–20: Paulo agradece a ajuda recebida e explica que aprendeu a viver tanto na necessidade quanto na abundância. O versículo 13 trata dessa força em Cristo, não de uma garantia de realizar qualquer desejo.\n21–23: saudações e bênção final.\n\nAPLICAÇÃO\nEm meio às dificuldades, pratique a oração, a gratidão, a generosidade e a confiança em Cristo.\n\nREFLEXÃO\nEm quais situações preciso aprender contentamento sem abandonar a responsabilidade de agir?\n\nLEITURAS RELACIONADAS\nFilipenses 1:12–14; 2 Coríntios 12:9–10; 1 Timóteo 6:6–8."
  }
];

  const MAX_BATCH=12;
  const batchSections=['RESUMO','CONTEXTO','ENTENDA POR PARTES','APLICAÇÃO','REFLEXÃO','LEITURAS RELACIONADAS'];
  const starterBatch=[
  {
    "book_id": "PHP",
    "chapter": 1,
    "verse_start": 1,
    "verse_end": 30,
    "title": "Filipenses 1 — Viver para Cristo",
    "content": "RESUMO\nPaulo agradece a Deus pelos filipenses, relata como sua prisão contribuiu para a divulgação do evangelho e incentiva a igreja a permanecer firme.\n\nCONTEXTO\nPaulo escreve como prisioneiro a uma comunidade que participa da divulgação do evangelho (1:5,12–14). Sua alegria não depende de estar livre.\n\nENTENDA POR PARTES\n1–11: saudação, gratidão e oração por amor e discernimento.\n12–26: Paulo considera a divulgação do evangelho e seu compromisso com Cristo, mesmo diante da morte.\n27–30: a igreja é chamada à unidade, coragem e fidelidade.\n\nAPLICAÇÃO\nBusque servir a Cristo mesmo quando seus planos são interrompidos. Ore por discernimento e permaneça unido aos irmãos.\n\nREFLEXÃO\nComo posso responder às dificuldades de forma coerente com o evangelho?\n\nLEITURAS RELACIONADAS\nAtos 16:11–40; Romanos 8:35–39; Filipenses 2:1–4."
  },
  {
    "book_id": "PHP",
    "chapter": 2,
    "verse_start": 1,
    "verse_end": 30,
    "title": "Filipenses 2 — A humildade de Cristo",
    "content": "RESUMO\nPaulo chama a igreja à unidade e à humildade, apresentando Jesus como exemplo supremo de serviço e obediência. Timóteo e Epafrodito aparecem como exemplos de dedicação.\n\nCONTEXTO\nDepois de incentivar a igreja a viver de modo digno do evangelho, Paulo explica como a humildade fortalece a comunhão. Cristo se humilhou e Deus o exaltou (2:5–11).\n\nENTENDA POR PARTES\n1–11: renunciar à rivalidade e seguir o exemplo de Cristo.\n12–18: viver com obediência e responsabilidade, reconhecendo que Deus opera nos seus.\n19–30: Timóteo e Epafrodito exemplificam cuidado e serviço.\n\nAPLICAÇÃO\nProcure o bem dos outros, sirva sem buscar reconhecimento e valorize quem trabalha pela comunidade.\n\nREFLEXÃO\nEm qual relacionamento preciso trocar a competição pela humildade?\n\nLEITURAS RELACIONADAS\nMarcos 10:42–45; João 13:12–17; Romanos 12:9–18."
  },
  {
    "book_id": "PHP",
    "chapter": 3,
    "verse_start": 1,
    "verse_end": 21,
    "title": "Filipenses 3 — Prosseguir em direção ao alvo",
    "content": "RESUMO\nPaulo explica que seu valor não está nas conquistas religiosas, mas em conhecer Cristo. Ele reconhece que ainda não chegou à perfeição e prossegue em direção ao alvo.\n\nCONTEXTO\nPaulo alerta contra a confiança em credenciais religiosas e apresenta sua própria trajetória. Considera suas antigas vantagens inferiores ao valor de conhecer Cristo (3:4–9).\n\nENTENDA POR PARTES\n1–11: a justiça pela fé e o desejo de conhecer Cristo.\n12–16: a caminhada de crescimento continua; Paulo prossegue sem se considerar perfeito.\n17–21: a igreja é chamada a seguir bons exemplos e lembrar sua cidadania celestial.\n\nAPLICAÇÃO\nNão transforme conquistas pessoais em motivo de superioridade. Aprenda com o passado e avance com perseverança, buscando a semelhança com Cristo.\n\nREFLEXÃO\nO que preciso deixar de usar como motivo de orgulho para crescer na fé?\n\nLEITURAS RELACIONADAS\nRomanos 3:21–26; Gálatas 2:20; Hebreus 12:1–2."
  }
];
  function normalizeBatch(raw,books,author){
    if(typeof raw!=='string'||raw.length>260000)throw new Error('Arquivo de estudos muito grande.');
    const responsible=String(author||'').trim();
    if(!responsible||responsible.length>160)throw new Error('Informe o responsável pela revisão (até 160 caracteres).');
    let items;
    try{items=JSON.parse(raw);}catch(_){throw new Error('JSON inválido. Cole somente a lista JSON, sem crases ou texto extra.');}
    if(!Array.isArray(items)||items.length<1||items.length>MAX_BATCH)throw new Error('Use de 1 a '+MAX_BATCH+' capítulos por lote.');
    const seen=new Set();
    return items.map((x,i)=>{
      const fail=msg=>{throw new Error('Item '+(i+1)+': '+msg);};
      if(!x||typeof x!=='object'||Array.isArray(x))fail('objeto inválido.');
      const book=books.find(b=>b.id===x.book_id);
      if(!book||!Number.isInteger(x.chapter)||x.chapter<1||x.chapter>book.chapter_count)fail('livro ou capítulo inválido.');
      if(x.verse_start!==1||!Number.isInteger(x.verse_end)||x.verse_end<1||x.verse_end>200)fail('intervalo de capítulo inválido.');
      const key=book.id+':'+x.chapter;
      if(seen.has(key))fail('capítulo repetido neste lote.');
      seen.add(key);
      const title=typeof x.title==='string'?x.title.trim():'',content=typeof x.content==='string'?x.content.trim():'';
      if(!title||title.length>200||!content||content.length>20000)fail('título ou conteúdo inválido.');
      let previous=-1;
      for(const heading of batchSections){
        const lines=content.split(/\r?\n/),idx=lines.findIndex(line=>line.trim()===heading);
        if(idx<=previous||!lines.slice(idx+1).find(line=>line.trim())||batchSections.includes(lines.slice(idx+1).find(line=>line.trim())?.trim()))fail('seção ausente ou vazia: '+heading);
        previous=idx;
      }
      // Never trust input for publication status, author, identifiers or metadata.
      return {source_code:'adpel-editorial',book_id:book.id,chapter:x.chapter,verse_start:1,verse_end:x.verse_end,category:'expositivo',title,content,author_name:responsible,is_active:false,metadata:{ai_assisted:true,chapter_model:true,batch_import:true}};
    });
  }
  function batchPrompt(book,start,end){
    return 'Prepare estudos bíblicos em português do Brasil, um por capítulo, do livro '+book.name_pt+' (código '+book.id+'), capítulos '+start+' a '+end+'. Use a Bíblia ACF como referência de numeração. Não invente informações históricas, citações, dados ou referências. Diferencie texto bíblico, interpretação e aplicação; explique em linguagem simples; não copie comentários protegidos. Cada estudo deve abordar o capítulo inteiro. Responda exclusivamente com uma lista JSON de objetos, cada um com book_id (código exato '+book.id+'), chapter (inteiro), verse_start (1), verse_end (último versículo real do capítulo), title e content. No campo content, use linhas com estes seis títulos exatos, nesta ordem, seguidos de conteúdo: '+batchSections.join(', ')+'. Use divisões com intervalos de versículos em ENTENDA POR PARTES. Não inclua Markdown externo, IDs, metadados ou campos de publicação. Os estudos serão revisados por um responsável antes da publicação.';
  }
  async function validateBatchInDatabase(rows){
    const db=client();
    const translation=await db.from('bible_translations').select('id').eq('code','acf').maybeSingle();
    if(translation.error||!translation.data?.id)throw new Error('Não foi possível confirmar a tradução ACF.');
    const results=[];
    for(const row of rows){
      const base=db.from('bible_verses').select('verse').eq('translation_id',translation.data.id).eq('book_id',row.book_id).eq('chapter',row.chapter).eq('is_canonical',true);
      const check=await base.order('verse',{ascending:true}).limit(201);
      if(check.error)throw check.error;
      const numbers=(check.data||[]).map(v=>Number(v.verse));
      if(numbers.length!==row.verse_end||!numbers.every((v,i)=>v===i+1))throw new Error(row.book_id+' '+row.chapter+': intervalo não corresponde ao capítulo ACF disponível.');
      const existing=await db.from('bible_commentaries').select('id').eq('source_code','adpel-editorial').eq('book_id',row.book_id).eq('chapter',row.chapter).eq('verse_start',1).eq('verse_end',row.verse_end).limit(1);
      if(existing.error)throw existing.error;
      results.push({row,duplicate:Boolean(existing.data?.length)});
    }
    return results;
  }
  let batchBusy=false,batchSnapshot=null;
  function invalidateBatch(){
    batchSnapshot=null;
    $('study-batch-save').disabled=true;
    $('study-batch-preview').innerHTML='';
    $('study-batch-status').textContent='Valide o lote antes de salvar.';
  }
  function readBatch(){return normalizeBatch($('study-batch-json').value,state.books,$('study-batch-author').value);}
  function setBatchBusy(busy){
    batchBusy=busy;
    for(const id of ['study-batch-validate','study-batch-starter','study-batch-json','study-batch-author'])$(id).disabled=busy;
    $('study-batch-save').disabled=busy||!batchSnapshot;
  }
  async function previewBatch(){
    if(batchBusy)return;
    invalidateBatch();setBatchBusy(true);
    $('study-batch-status').textContent='Conferindo capítulos e duplicidades…';
    try{
      const rows=readBatch(),results=await validateBatchInDatabase(rows);
      batchSnapshot=JSON.stringify(rows);
      $('study-batch-preview').innerHTML=results.map(({row,duplicate})=>'<details class="border rounded-lg p-3"><summary class="cursor-pointer">'+esc(row.title)+' — '+(duplicate?'Já existe: será ignorado':'Novo rascunho')+'</summary><p class="whitespace-pre-wrap break-words mt-2">'+esc(row.content)+'</p></details>').join('');
      $('study-batch-status').textContent=results.filter(x=>!x.duplicate).length+' novos rascunhos; '+results.filter(x=>x.duplicate).length+' capítulos já existentes.';
    }catch(e){$('study-batch-status').textContent=e.message||'Falha ao validar.';}finally{setBatchBusy(false);}
  }
  async function saveBatch(){
    if(batchBusy||!batchSnapshot)return;
    let rows;
    try{rows=readBatch();if(JSON.stringify(rows)!==batchSnapshot)throw new Error('O lote mudou. Valide novamente.');}catch(e){invalidateBatch();$('study-batch-status').textContent=e.message;return;}
    if(!confirm('Salvar somente os novos capítulos como rascunhos privados, sem publicar?'))return;
    setBatchBusy(true);
    try{
      const results=await validateBatchInDatabase(rows);
      const pending=results.filter(x=>!x.duplicate).map(x=>x.row);
      if(!pending.length){invalidateBatch();$('study-batch-status').textContent='Todos os capítulos já existem. Nenhuma gravação.';return;}
      const res=await client().from('bible_commentaries').insert(pending).select('id');
      if(res.error)throw res.error;
      if(res.data?.length!==pending.length)throw new Error('Retorno de gravação inesperado. Atualize a lista antes de tentar de novo.');
      invalidateBatch();
      $('study-batch-status').textContent=pending.length+' rascunhos salvos. Revise cada estudo antes de publicar.';
      state.page=0;await load();
    }catch(e){invalidateBatch();$('study-batch-status').textContent='Não foi possível confirmar a gravação. Confira a lista e valide novamente. '+(e.message||'');}finally{setBatchBusy(false);}
  }
  function mount() {
    if($('admin-view-bible-study'))return;
    document.querySelector('[onclick="adminNavigateTo(\'verses\')"]')?.insertAdjacentHTML('afterend',`<button onclick="adminNavigateTo('bible-study')" class="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white min-h-[44px]"><i class="fas fa-language w-5 text-center"></i><span class="ml-3 font-medium">Comentários bíblicos</span></button>`);
    $('admin-view-verses')?.insertAdjacentHTML('afterend',`<section id="admin-view-bible-study" class="hidden space-y-6">
      <div><h2 class="text-2xl font-bold text-gray-800">Comentários bíblicos</h2><p class="text-sm text-gray-500">Revise e publique estudos de capítulos, passagens ou comentários por versículo. Rascunhos ficam visíveis somente ao master.</p></div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
        <div class="flex flex-wrap gap-3"><label class="text-sm">Filtrar livro <select id="study-admin-filter" class="border rounded-lg p-2 min-h-[44px]"><option value="">Todos os livros</option></select></label><button type="button" id="study-admin-new" class="bg-blue-600 text-white rounded-lg px-4 min-h-[44px]">Novo comentário</button><button type="button" id="study-admin-reload" class="border rounded-lg px-4 min-h-[44px]">Atualizar</button></div>
        <div class="border rounded-xl p-3 space-y-2"><strong>Modelos de estudo por capítulo</strong><p class="text-sm text-gray-600">Preencha um rascunho de demonstração, revise e informe o autor responsável. Nada é salvo nem publicado ao selecionar.</p><label class="block text-sm">Modelo<select id="study-admin-model" class="block w-full border rounded-lg p-2 min-h-[44px]"><option value="">Escolha um capítulo</option>${chapterModels.map((m,i)=>`<option value="${i}">${esc(m.title)}</option>`).join("")}</select></label><button type="button" id="study-admin-use-model" class="border rounded-lg px-4 min-h-[44px]">Carregar modelo para revisão</button></div><details class="border rounded-xl p-4 space-y-3"><summary class="font-bold cursor-pointer">Produção de estudos em lote</summary><p class="text-sm text-gray-600">Gere os textos fora do aplicativo, cole o JSON e importe até 12 capítulos como rascunhos. Nenhuma chamada de IA é feita pelo aplicativo.</p><div class="grid grid-cols-1 md:grid-cols-3 gap-2"><label>Livro<select id="study-batch-book" class="block w-full border rounded-lg p-2 min-h-[44px]"></select></label><label>Capítulo inicial<input type="number" id="study-batch-from" min="1" value="1" class="block w-full border rounded-lg p-2 min-h-[44px]"></label><label>Capítulo final<input type="number" id="study-batch-to" min="1" value="4" class="block w-full border rounded-lg p-2 min-h-[44px]"></label></div><button type="button" id="study-batch-prompt" class="border rounded-lg px-3 min-h-[44px]">Preparar prompt</button><textarea id="study-batch-prompt-text" readonly rows="5" class="block w-full border rounded-lg p-2" aria-label="Prompt para copiar"></textarea><button type="button" id="study-batch-starter" class="border rounded-lg px-3 min-h-[44px]">Carregar pacote Filipenses 1–4</button><label class="block">Responsável pela revisão<input id="study-batch-author" maxlength="160" class="block w-full border rounded-lg p-2 min-h-[44px]"></label><label class="block">JSON dos estudos<textarea id="study-batch-json" maxlength="260000" rows="8" class="block w-full border rounded-lg p-2" placeholder="Cole a lista JSON aqui"></textarea></label><div class="flex flex-wrap gap-2"><button type="button" id="study-batch-validate" class="border rounded-lg px-3 min-h-[44px]">Validar e visualizar</button><button type="button" id="study-batch-save" disabled class="bg-blue-600 disabled:opacity-40 text-white rounded-lg px-3 min-h-[44px]">Salvar como rascunhos</button></div><p id="study-batch-status" role="status" class="text-sm text-gray-600"></p><div id="study-batch-preview" class="space-y-2"></div></details><p id="study-admin-status" class="text-sm text-gray-500" role="status"></p><div id="study-admin-list" class="space-y-3"></div>
        <div class="flex justify-between items-center"><button type="button" id="study-admin-previous" class="border rounded-lg p-2 min-h-[44px]">Anterior</button><span id="study-admin-pagination" class="text-sm"></span><button type="button" id="study-admin-next" class="border rounded-lg p-2 min-h-[44px]">Próxima</button></div>
      </div>
      <form id="study-admin-form" class="hidden bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
        <h3 class="font-bold text-lg text-gray-800">Editar comentário</h3><input id="study-admin-id" type="hidden">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3"><label class="text-sm">Livro<select id="study-admin-book" required class="block w-full border rounded-lg p-2 min-h-[44px]"></select></label><label class="text-sm">Capítulo<input id="study-admin-chapter" type="number" min="1" required value="1" class="block w-full border rounded-lg p-2 min-h-[44px]"></label><label class="text-sm">Versículo inicial<input id="study-admin-start" type="number" min="1" required value="1" class="block w-full border rounded-lg p-2 min-h-[44px]"></label><label class="text-sm">Versículo final<input id="study-admin-end" type="number" min="1" required value="1" class="block w-full border rounded-lg p-2 min-h-[44px]"></label></div>
        <div class="grid md:grid-cols-2 gap-3"><label class="text-sm">Categoria<select id="study-admin-category" class="block w-full border rounded-lg p-2 min-h-[44px]"><option value="expositivo">Expositivo</option><option value="historico">Histórico</option><option value="linguistico">Linguístico</option><option value="pastoral">Pastoral</option></select></label><label class="text-sm">Autor<input id="study-admin-author" maxlength="160" required class="block w-full border rounded-lg p-2 min-h-[44px]"></label></div>
        <label class="block text-sm">Título<input id="study-admin-title" maxlength="200" required class="block w-full border rounded-lg p-2 min-h-[44px]"></label>
        <label class="block text-sm">Comentário e referências<textarea id="study-admin-content" rows="10" maxlength="20000" required class="block w-full border rounded-lg p-3" placeholder="Escreva sua explicação e identifique as referências utilizadas. Use apenas conteúdo próprio ou autorizado."></textarea></label>
        <label class="flex items-center gap-3 text-sm min-h-[44px]"><input id="study-admin-published" type="checkbox">Publicar para os membros após revisão</label>
        <p id="study-admin-ai" class="hidden text-sm text-amber-700">Este rascunho foi assistido por IA. Revise interpretação, contexto e referências antes de publicar. A identificação de assistência por IA será preservada.</p>
        <div class="flex gap-3 justify-end"><button type="button" id="study-admin-cancel" class="border rounded-lg px-4 min-h-[44px]">Cancelar</button><button type="submit" id="study-admin-save" class="bg-blue-600 text-white rounded-lg px-4 min-h-[44px]">Salvar comentário</button></div>
      </form>
    </section>`);
    $('study-admin-new').addEventListener('click',()=>edit());
    $('study-batch-prompt').addEventListener('click',()=>{
      const book=state.books.find(b=>b.id===$('study-batch-book').value),start=Number($('study-batch-from').value),end=Number($('study-batch-to').value);
      const out=$('study-batch-prompt-text');out.value='';
      if(!book||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>book.chapter_count||end-start+1>MAX_BATCH){window.showToast?.('Escolha até 12 capítulos válidos do mesmo livro.','error');return;}
      out.value=batchPrompt(book,start,end);out.focus();out.select();
    });
    $('study-batch-starter').addEventListener('click',()=>{
      if($('study-batch-json').value.trim()&&!confirm('Substituir o JSON atual?'))return;
      $('study-batch-json').value=JSON.stringify([...starterBatch,chapterModels.find(m=>m.book_id==='PHP'&&m.chapter===4)],null,2);invalidateBatch();
    });
    $('study-batch-json').addEventListener('input',invalidateBatch);
    $('study-batch-author').addEventListener('input',invalidateBatch);
    $('study-batch-validate').addEventListener('click',previewBatch);
    $('study-batch-save').addEventListener('click',saveBatch);
    $('study-admin-use-model').addEventListener('click',()=>{
      const value=$('study-admin-model').value;
      const model=value===''?null:chapterModels[Number(value)];
      if(!model||!state.books.some(b=>b.id===model.book_id)){window.showToast?.('Escolha um modelo e aguarde o catálogo de livros.','error');return;}
      if(!$('study-admin-form').classList.contains('hidden')&&!confirm('Substituir os dados ainda não salvos do formulário?'))return;
      edit({...model,metadata:{ai_assisted:true,chapter_model:true},is_active:false,author_name:''});
    });
    $('study-admin-reload').addEventListener('click',load);
    $('study-admin-filter').addEventListener('change',()=>{state.page=0;load();});
    $('study-admin-previous').addEventListener('click',()=>{if(state.page>0){state.page--;load();}});
    $('study-admin-next').addEventListener('click',()=>{if((state.page+1)*50<state.total){state.page++;load();}});
    $('study-admin-cancel').addEventListener('click',()=> $('study-admin-form').classList.add('hidden'));
    $('study-admin-form').addEventListener('submit',save);
    $('study-admin-list').addEventListener('click',event=>{const editButton=event.target.closest('[data-comment-edit]');const removeButton=event.target.closest('[data-comment-delete]');if(editButton)edit(state.items.find(x=>x.id===editButton.dataset.commentEdit));if(removeButton)remove(removeButton.dataset.commentDelete);});
  }
  async function load() {
    mount();const request=++state.request;
    $('study-admin-status').textContent='Carregando comentários…';
    try{
      if(!state.books.length){const res=await client().from('bible_books').select('id,name_pt,chapter_count').order('book_order');if(res.error)throw res.error;state.books=res.data;const options=state.books.map(b=>`<option value="${esc(b.id)}">${esc(b.name_pt)}</option>`).join('');$('study-admin-filter').innerHTML='<option value="">Todos os livros</option>'+options;$('study-admin-book').innerHTML=options;$('study-batch-book').innerHTML=options;}
      let query=client().from('bible_commentaries').select('*',{count:'exact'}).eq('source_code','adpel-editorial').order('updated_at',{ascending:false}).order('id');
      if($('study-admin-filter').value)query=query.eq('book_id',$('study-admin-filter').value);
      const {data,error,count}=await query.range(state.page*50,state.page*50+49);
      if(error)throw error;if(request!==state.request)return;
      state.items=data||[];state.total=count||0;
      $('study-admin-status').textContent=`${state.total} comentários. Publique somente após revisão.`;
      $('study-admin-list').innerHTML=state.items.map(x=>`<article class="border rounded-xl p-4"><div class="flex flex-wrap justify-between gap-3"><div><strong class="text-gray-800">${esc(x.title)}</strong><p class="text-sm text-gray-500">${esc(state.books.find(b=>b.id===x.book_id)?.name_pt||x.book_id)} ${x.chapter}:${x.verse_start}${x.verse_end>x.verse_start?'–'+x.verse_end:''} · ${x.is_active?'Publicado':'Rascunho'} · ${esc(x.author_name||'Autor não informado')}</p></div><div class="flex gap-2"><button type="button" data-comment-edit="${x.id}" class="border rounded-lg px-3 min-h-[44px]">Editar</button><button type="button" data-comment-delete="${x.id}" class="border rounded-lg px-3 min-h-[44px] text-red-700">Excluir</button></div></div><p class="text-sm text-gray-600 mt-3 whitespace-pre-wrap">${esc(x.content.slice(0,240))}</p></article>`).join('')||'<p class="text-gray-500">Nenhum comentário cadastrado.</p>';
      $('study-admin-pagination').textContent=`${state.page+1} / ${Math.max(1,Math.ceil(state.total/50))}`;
      $('study-admin-previous').disabled=state.page===0;$('study-admin-next').disabled=(state.page+1)*50>=state.total;
    }catch(e){$('study-admin-status').textContent='Não foi possível carregar os comentários. Confirme seu acesso master e tente Atualizar.';console.error('Comentários:',e.message);}
  }
  function edit(item=null) {
    $('study-admin-form').reset();$('study-admin-id').value=item?.id||'';state.formMetadata={...(item?.metadata||{})};
    for(const [field,key] of [['book','book_id'],['chapter','chapter'],['start','verse_start'],['end','verse_end'],['category','category'],['author','author_name'],['title','title'],['content','content']])if(item)$('study-admin-'+field).value=item[key]||'';
    if(!item)$('study-admin-book').value=$('study-admin-filter').value||state.books[0]?.id;
    $('study-admin-published').checked=Boolean(item?.is_active);
    $('study-admin-ai').classList.toggle('hidden',!item?.metadata?.ai_assisted);
    $('study-admin-form').classList.remove('hidden');$('study-admin-form').scrollIntoView({behavior:'smooth'});
  }
  async function save(event) {
    event.preventDefault();const button=$('study-admin-save');if(button.disabled)return;
    const id=$('study-admin-id').value;
    const book=state.books.find(b=>b.id===$('study-admin-book').value),chapter=Number($('study-admin-chapter').value),start=Number($('study-admin-start').value),end=Number($('study-admin-end').value);
    if(!book||!Number.isInteger(chapter)||chapter<1||chapter>book.chapter_count||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start){window.showToast?.('Confira livro, capítulo e intervalo de versículos.','error');return;}
    button.disabled=true;
    try{
      // Validate the range against canonical text, not just positive integers.
      const check=await client().from('bible_verses').select('verse').eq('book_id',book.id).eq('chapter',chapter).eq('is_canonical',true).in('verse',[start,end]);if(check.error)throw check.error;
      if(!check.data.some(v=>v.verse===start)||!check.data.some(v=>v.verse===end))throw new Error('O intervalo informado não existe no texto bíblico.');
      const old=state.items.find(x=>x.id===id);
      const payload={source_code:'adpel-editorial',book_id:book.id,chapter,verse_start:start,verse_end:end,category:$('study-admin-category').value,author_name:$('study-admin-author').value.trim(),title:$('study-admin-title').value.trim(),content:$('study-admin-content').value.trim(),is_active:$('study-admin-published').checked,metadata:old?.metadata||state.formMetadata||{},updated_at:new Date().toISOString()};
      if(!payload.title||!payload.content||!payload.author_name)throw new Error('Preencha título, autor e comentário.');
      const res=id?await client().from('bible_commentaries').update(payload).eq('id',id).eq('source_code','adpel-editorial').select('id'):await client().from('bible_commentaries').insert(payload).select('id');
      if(res.error)throw res.error;if(!res.data?.length)throw new Error('Seu acesso não permite salvar este comentário.');
      $('study-admin-form').classList.add('hidden');window.showToast?.(payload.is_active?'Comentário publicado.':'Rascunho salvo.','success');await load();
    }catch(e){window.showToast?.(e.message||'Não foi possível salvar o comentário.','error');}finally{button.disabled=false;}
  }
  async function remove(id) {
    if(!confirm('Excluir este comentário bíblico?'))return;
    try{const res=await client().from('bible_commentaries').delete().eq('id',id).eq('source_code','adpel-editorial').select('id');if(res.error)throw res.error;if(!res.data?.length)throw new Error('Seu acesso não permite excluir este comentário.');await load();}catch(e){window.showToast?.(e.message,'error');}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={normalizeBatch,batchPrompt,starterBatch,chapterModels,validateBatchInDatabase};
  if(typeof window!=='undefined')window.loadAdminBibleStudy=load;
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',mount);
})();
