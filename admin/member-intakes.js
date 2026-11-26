// Dados de acolhimento: leitura e atualização exclusiva de master via RLS.
var memberIntakeRequest=0;
var memberIntakeBusy=false;
var memberIntakeOffset=0;
var memberIntakeMemberId=null;
var memberIntakeOpen=false;
function openMemberIntakeDialog(memberId){
  if(memberIntakeBusy)return;
  memberIntakeMemberId=memberId||null;
  memberIntakeOpen=true;
  var modal=document.getElementById('member-intake-modal');
  if(!modal)return;
  var kind=document.getElementById('member-intake-kind'),status=document.getElementById('member-intake-status');
  if(kind){kind.value='';kind.classList.toggle('hidden',!!memberId);}
  if(status){status.value='';status.classList.toggle('hidden',!!memberId);}
  modal.classList.remove('hidden');
  loadMemberIntakes();
}
function closeMemberIntakeDialog(){
  memberIntakeOpen=false;memberIntakeMemberId=null;++memberIntakeRequest;
  var modal=document.getElementById('member-intake-modal'),box=document.getElementById('member-intake-list');
  if(modal)modal.classList.add('hidden');if(box)box.replaceChildren();
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&memberIntakeOpen)closeMemberIntakeDialog();});
function intakeEl(tag,text,classes){var e=document.createElement(tag);if(text!=null)e.textContent=text;if(classes)e.className=classes;return e;}
function intakeButton(text,fn,classes){var b=intakeEl('button',text,classes||'px-3 py-2 border rounded-lg text-sm min-h-[44px]');b.type='button';b.addEventListener('click',fn);return b;}
async function loadMemberIntakes(offset){
  var box=document.getElementById('member-intake-list');
  if(!box||!window.supabaseClient||memberIntakeBusy||!memberIntakeOpen)return;
  offset=Number.isInteger(offset)&&offset>=0?offset:0;
  var request=++memberIntakeRequest;
  var kind=(document.getElementById('member-intake-kind')||{}).value||'';
  var status=(document.getElementById('member-intake-status')||{}).value||'';
  box.replaceChildren(intakeEl('p','Consultando cadastros...','text-sm text-gray-500'));
  try{
    var query=window.supabaseClient.from('member_registration_intakes').select('user_id,member_id,declared_type,full_name,email,whatsapp,birth_date,contact_allowed,review_required,followup_status,created_at,congregations(name)').order('created_at',{ascending:false}).order('user_id',{ascending:true});
    if(memberIntakeMemberId) query=query.eq('member_id',memberIntakeMemberId);
    else {
      query=query.is('member_id',null);
      if(kind==='membro'||kind==='visitante')query=query.eq('declared_type',kind);
      if(['novo','em_acompanhamento','concluido'].includes(status))query=query.eq('followup_status',status);
      else query=query.neq('followup_status','concluido');
    }
    var result=await query.range(offset,offset+50);
    if(request!==memberIntakeRequest)return;
    if(result.error)throw result.error;
    var rows=result.data||[];
    memberIntakeOffset=offset;
    box.replaceChildren();
    if(!rows.length)box.appendChild(intakeEl('p',memberIntakeMemberId?'Nenhum acolhimento do aplicativo vinculado a esta ficha.':'Nenhuma revisão neste filtro.','text-sm text-gray-500'));
    rows.slice(0,50).forEach(function(row){box.appendChild(renderMemberIntake(row));});
    if(offset>0)box.appendChild(intakeButton('Anterior',function(){loadMemberIntakes(Math.max(0,offset-50));}));
    if(rows.length>50)box.appendChild(intakeButton('Próxima página',function(){loadMemberIntakes(offset+50);}));
  }catch(_){if(request===memberIntakeRequest)box.replaceChildren(intakeEl('p','Não foi possível carregar os cadastros. Tente atualizar.','text-sm text-red-600'));}
}
function renderMemberIntake(row){
  var card=intakeEl('article',null,'border rounded-xl p-3 space-y-2');
  card.appendChild(intakeEl('h4',row.full_name,'font-semibold text-gray-800 break-words'));
  card.appendChild(intakeEl('p',(row.declared_type==='membro'?'Membro declarado':'Visitante')+' · '+(row.congregations&&row.congregations.name||'Congregação não disponível'),'text-sm text-gray-700'));
  card.appendChild(intakeEl('p',row.email,'text-xs text-gray-500 break-all'));
  card.appendChild(intakeEl('p',row.review_required?'Possível duplicidade — revise o cadastro existente e vincule a conta manualmente se for a mesma pessoa.':row.member_id?'Acolhimento vinculado à ficha existente.':'Ficha não disponível.','text-sm text-amber-700'));
  card.appendChild(intakeEl('p',row.contact_allowed?'Contato pelo WhatsApp autorizado.':'Contato pelo WhatsApp não autorizado.','text-xs '+(row.contact_allowed?'text-green-700':'text-gray-500')));
  if(row.contact_allowed && /^[1-9][0-9]{9,10}$/.test(row.whatsapp)){
    var link=intakeEl('a','WhatsApp: '+row.whatsapp,'inline-flex items-center px-3 py-2 min-h-[44px] rounded-lg bg-green-50 text-green-700 font-semibold text-sm');
    link.href='https://wa.me/55'+row.whatsapp;link.target='_blank';link.rel='noopener noreferrer';card.appendChild(link);
  }
  var label=intakeEl('label','Acompanhamento','block text-xs font-semibold text-gray-700');
  var select=intakeEl('select',null,'block w-full border rounded-lg p-2 mt-1 min-h-[44px]');
  [['novo','Novo'],['em_acompanhamento','Em acompanhamento'],['concluido','Concluído']].forEach(function(item){var op=intakeEl('option',item[1]);op.value=item[0];select.appendChild(op);});
  select.value=row.followup_status;label.appendChild(select);card.appendChild(label);
  card.appendChild(intakeButton('Salvar acompanhamento',function(){saveMemberIntakeStatus(row.user_id,select.value);}));
  if(row.review_required)card.appendChild(intakeEl('p','ID da conta: '+row.user_id,'text-xs text-gray-500 break-all'));
  return card;
}
async function saveMemberIntakeStatus(userId,status){
  if(memberIntakeBusy||!['novo','em_acompanhamento','concluido'].includes(status)||!window.supabaseClient)return;
  memberIntakeBusy=true;++memberIntakeRequest;
  try{
    var r=await window.supabaseClient.from('member_registration_intakes').update({followup_status:status}).eq('user_id',userId).select('user_id');
    if(r.error||!Array.isArray(r.data)||r.data.length!==1)throw r.error||new Error('not saved');
    churchShowToast('Acompanhamento atualizado.','success');
  }catch(_){churchShowToast('Não foi possível confirmar a atualização.','error');}
  finally{memberIntakeBusy=false;await loadMemberIntakes(memberIntakeOffset);}
}
