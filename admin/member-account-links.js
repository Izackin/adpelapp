// Vínculo manual e privado. Não altera profiles.role nem autenticação.
var memberAccountState = { request: 0, memberId: null, link: null, accounts: [], busy: false };

function memberAccountElement(tag, text, className) {
  var el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function memberAccountButton(text, handler, className) {
  var el = memberAccountElement('button', text, className || 'px-4 py-2 border rounded-lg min-h-[44px] font-semibold');
  el.type = 'button';
  el.addEventListener('click', handler);
  return el;
}
function closeMemberAccountLink() {
  memberAccountState.request++;
  memberAccountState.memberId = null;
  memberAccountState.link = null;
  memberAccountState.accounts = [];
  memberAccountState.busy = false;
  var modal = document.getElementById('member-account-modal');
  var body = document.getElementById('member-account-body');
  if (modal) modal.classList.add('hidden');
  if (body) body.replaceChildren();
}
function memberAccountIsCurrent(request, memberId) {
  return request === memberAccountState.request && memberId === memberAccountState.memberId;
}
async function openMemberAccountLink(memberId, exactId) {
  var member = membersData.find(function(m){return m.id === memberId;});
  var modal = document.getElementById('member-account-modal');
  var body = document.getElementById('member-account-body');
  if (!member || !modal || !body || !window.supabaseClient) return;
  if (memberAccountState.busy) return;
  var request = ++memberAccountState.request;
  memberAccountState.memberId = memberId;
  memberAccountState.link = null;
  memberAccountState.accounts = [];
  modal.classList.remove('hidden');
  body.replaceChildren(memberAccountElement('p','Consultando vínculo...','text-sm text-gray-600'));
  try {
    var linkResult = await window.supabaseClient.from('member_account_links')
      .select('member_id,user_id,linked_at').eq('member_id',memberId).maybeSingle();
    if (linkResult.error) throw linkResult.error;
    if (!memberAccountIsCurrent(request,memberId)) return;
    var link = linkResult.data;
    var query = window.supabaseClient.from('profiles').select('id,full_name,created_at');
    if (link) query = query.eq('id',link.user_id);
    else if (exactId) query = query.eq('id',exactId);
    else query = query.order('full_name',{ascending:true}).order('id',{ascending:true}).limit(100);
    var result = await query;
    if (!memberAccountIsCurrent(request,memberId)) return;
    if (result.error) throw result.error;
    memberAccountState.link = link;
    memberAccountState.accounts = result.data || [];
    renderMemberAccountLink(member,exactId);
  } catch (_) {
    if (!memberAccountIsCurrent(request,memberId)) return;
    body.replaceChildren(memberAccountElement('p','Não foi possível consultar o vínculo. Verifique seu acesso e tente novamente.','text-sm text-red-600'),
      memberAccountButton('Tentar novamente',function(){openMemberAccountLink(memberId,exactId);}));
  }
}
function renderMemberAccountLink(member, exactId) {
  var body = document.getElementById('member-account-body');
  if (!body || memberAccountState.memberId !== member.id) return;
  body.replaceChildren();
  body.appendChild(memberAccountElement('h4',member.full_name || 'Membro','font-bold text-gray-800 break-words'));
  body.appendChild(memberAccountElement('p','O vínculo não cria conta, não altera permissões e não publica a ficha do membro.','text-sm text-gray-600'));
  var link = memberAccountState.link;
  if (link) {
    var account = memberAccountState.accounts.find(function(a){return a.id===link.user_id;});
    body.appendChild(memberAccountElement('p','Conta vinculada: ' + (account && account.full_name || 'Sem nome'),'text-sm font-semibold text-green-700'));
    body.appendChild(memberAccountElement('p','ID: ' + link.user_id,'text-xs text-gray-500 break-all'));
    body.appendChild(memberAccountButton('Desvincular conta',function(){changeMemberAccountLink(member.id,link.user_id,true);},'px-4 py-3 border border-red-300 text-red-700 rounded-lg min-h-[44px]'));
    return;
  }
  body.appendChild(memberAccountElement('p','Sem vínculo. Confirme a identidade e a autorização do membro antes de selecionar a conta correta. Não use apenas a semelhança dos nomes.','text-sm text-amber-700'));
  var label=memberAccountElement('label','Conta cadastrada no aplicativo','block text-sm font-semibold text-gray-700');
  var select=memberAccountElement('select',null,'block w-full border border-gray-300 rounded-lg p-3 mt-1');
  select.setAttribute('aria-label','Conta cadastrada no aplicativo');
  var blank=memberAccountElement('option','Selecione uma conta');blank.value='';select.appendChild(blank);
  memberAccountState.accounts.forEach(function(account){
    var option=memberAccountElement('option',(account.full_name || 'Sem nome')+' · '+account.id);
    option.value=account.id;select.appendChild(option);
  });
  label.appendChild(select);body.appendChild(label);
  var btn=memberAccountButton('Vincular conta',function(){if(select.value)changeMemberAccountLink(member.id,select.value,false);},'w-full px-4 py-3 rounded-lg bg-adpel-600 text-white min-h-[44px] font-semibold');
  btn.disabled=true;
  select.addEventListener('change',function(){btn.disabled=!select.value;});
  body.appendChild(btn);
  body.appendChild(memberAccountElement('p',exactId?'Resultado da busca por ID.':'Até 100 contas por consulta. Para localizar uma conta específica, use o ID completo.','text-xs text-gray-500'));
  var search=memberAccountElement('input',null,'w-full border border-gray-300 p-3 rounded-lg');
  search.type='text';search.placeholder='ID exato da conta (UUID)';search.value=exactId||'';search.setAttribute('aria-label','ID exato da conta');
  body.appendChild(search);
  body.appendChild(memberAccountButton('Buscar por ID',function(){
    var id=search.value.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {churchShowToast('Informe um ID válido.','warning');return;}
    openMemberAccountLink(member.id,id);
  }));
  if(exactId)body.appendChild(memberAccountButton('Voltar à lista',function(){openMemberAccountLink(member.id);}));
}
async function changeMemberAccountLink(memberId,userId,remove) {
  var state=memberAccountState;
  if (state.busy || state.memberId!==memberId || !window.supabaseClient) return;
  if (remove ? !state.link || state.link.user_id!==userId : state.link || !state.accounts.some(function(a){return a.id===userId;})) return;
  var message=remove?'Desvincular esta conta? A conta e o cadastro do membro serão preservados.':'Confirma que verificou a identidade e a autorização do membro para vincular esta conta?';
  if (!window.confirm(message)) return;
  var request=state.request;
  state.busy=true;
  var body=document.getElementById('member-account-body');
  if(body)body.replaceChildren(memberAccountElement('p','Salvando vínculo...','text-sm text-gray-600'));
  try {
    var result=remove
      ? await window.supabaseClient.from('member_account_links').delete().eq('member_id',memberId).eq('user_id',userId).select('member_id')
      : await window.supabaseClient.from('member_account_links').insert({member_id:memberId,user_id:userId}).select('member_id');
    if(!memberAccountIsCurrent(request,memberId))return;
    if(result.error || !Array.isArray(result.data) || result.data.length!==1)throw result.error||new Error('Alteração não confirmada');
    churchShowToast(remove?'Conta desvinculada.':'Conta vinculada.','success');
  } catch(error) {
    if(memberAccountIsCurrent(request,memberId))churchShowToast(error && error.code==='23505'?'A conta ou o membro já possui vínculo.':'Não foi possível confirmar a alteração.','error');
  } finally {
    if(memberAccountIsCurrent(request,memberId)){state.busy=false;await openMemberAccountLink(memberId);}
  }
}
document.addEventListener('keydown',function(event){
  if(event.key==='Escape' && memberAccountState.memberId)closeMemberAccountLink();
});
