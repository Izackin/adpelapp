(function () {
  'use strict';
  const $=id=>document.getElementById(id), client=()=>window.supabaseClient;
  const esc=value=>window.escapeHtml(value);
  const state={books:[],items:[],page:0,total:0,request:0};
  function mount() {
    if($('admin-view-bible-study'))return;
    document.querySelector('[onclick="adminNavigateTo(\'verses\')"]')?.insertAdjacentHTML('afterend',`<button onclick="adminNavigateTo('bible-study')" class="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white min-h-[44px]"><i class="fas fa-language w-5 text-center"></i><span class="ml-3 font-medium">Comentários bíblicos</span></button>`);
    $('admin-view-verses')?.insertAdjacentHTML('afterend',`<section id="admin-view-bible-study" class="hidden space-y-6">
      <div><h2 class="text-2xl font-bold text-gray-800">Comentários bíblicos</h2><p class="text-sm text-gray-500">Revise o conteúdo e publique comentários por versículo ou intervalo. Rascunhos ficam visíveis somente ao master.</p></div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
        <div class="flex flex-wrap gap-3"><label class="text-sm">Filtrar livro <select id="study-admin-filter" class="border rounded-lg p-2 min-h-[44px]"><option value="">Todos os livros</option></select></label><button type="button" id="study-admin-new" class="bg-blue-600 text-white rounded-lg px-4 min-h-[44px]">Novo comentário</button><button type="button" id="study-admin-reload" class="border rounded-lg px-4 min-h-[44px]">Atualizar</button></div>
        <p id="study-admin-status" class="text-sm text-gray-500" role="status"></p><div id="study-admin-list" class="space-y-3"></div>
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
      if(!state.books.length){const res=await client().from('bible_books').select('id,name_pt,chapter_count').order('book_order');if(res.error)throw res.error;state.books=res.data;const options=state.books.map(b=>`<option value="${esc(b.id)}">${esc(b.name_pt)}</option>`).join('');$('study-admin-filter').innerHTML='<option value="">Todos os livros</option>'+options;$('study-admin-book').innerHTML=options;}
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
    $('study-admin-form').reset();$('study-admin-id').value=item?.id||'';
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
      const payload={source_code:'adpel-editorial',book_id:book.id,chapter,verse_start:start,verse_end:end,category:$('study-admin-category').value,author_name:$('study-admin-author').value.trim(),title:$('study-admin-title').value.trim(),content:$('study-admin-content').value.trim(),is_active:$('study-admin-published').checked,metadata:old?.metadata||{},updated_at:new Date().toISOString()};
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
  window.loadAdminBibleStudy=load;
  document.addEventListener('DOMContentLoaded',mount);
})();
