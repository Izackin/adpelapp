var adminCommunityPosts = [];

async function loadAdminCommunity() {
  var container = document.getElementById('admin-community-list');
  if (!container || !window.supabaseClient) return;
  container.innerHTML = '<div class="text-sm text-gray-500 p-4">Carregando publicacoes...</div>';
  try {
    var result = await window.supabaseClient
      .from('community_posts')
      .select('*, profiles:user_id(full_name, public_name), community_reactions(id), community_comments(id)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    adminCommunityPosts = result.data || [];
    renderAdminCommunity();
  } catch (error) {
    console.error('Erro ao carregar comunidade no admin:', error);
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-comments text-2xl"></i></div><h3>Comunidade indisponivel</h3><p>Execute o SQL da Comunidade ADPEL no Supabase.</p></div>';
  }
}

function renderAdminCommunity() {
  var container = document.getElementById('admin-community-list');
  if (!container) return;
  if (!adminCommunityPosts.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-comments text-2xl"></i></div><h3>Nenhuma publicacao</h3><p>As publicacoes da comunidade aparecerao aqui.</p></div>';
    return;
  }
  container.innerHTML = adminCommunityPosts.map(function(post) {
    var author = post.profiles || {};
    var name = author.public_name || author.full_name || 'Membro';
    var reactions = Array.isArray(post.community_reactions) ? post.community_reactions.length : 0;
    var comments = Array.isArray(post.community_comments) ? post.community_comments.length : 0;
    return [
      '<div class="p-4 bg-gray-50 rounded-lg border border-gray-100">',
        '<div class="flex flex-col md:flex-row md:items-start justify-between gap-3">',
          '<div class="min-w-0 flex-1">',
            '<div class="flex flex-wrap gap-2 mb-2"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">' + escapeHtml(post.status || 'published') + '</span><span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">' + escapeHtml(post.category || '') + '</span></div>',
            '<h4 class="font-semibold text-gray-800">' + escapeHtml(name) + '</h4>',
            '<p class="text-xs text-gray-500">' + formatDate(post.created_at) + ' &bull; ' + reactions + ' amens &bull; ' + comments + ' comentarios</p>',
            '<p class="text-sm text-gray-600 mt-3 whitespace-pre-wrap">' + escapeHtml(post.content || '') + '</p>',
          '</div>',
          '<div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-2 min-w-[140px]">',
            '<button onclick="setCommunityPostStatus(&quot;' + post.id + '&quot;,&quot;hidden&quot;)" class="px-3 py-2 rounded-lg bg-yellow-600 text-white text-sm font-bold min-h-[44px]">Ocultar</button>',
            '<button onclick="setCommunityPostStatus(&quot;' + post.id + '&quot;,&quot;published&quot;)" class="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold min-h-[44px]">Restaurar</button>',
            '<button onclick="setCommunityPostStatus(&quot;' + post.id + '&quot;,&quot;removed&quot;)" class="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold min-h-[44px]">Remover</button>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }).join('');
}

async function setCommunityPostStatus(postId, status) {
  if (!window.supabaseClient) return;
  try {
    var result = await window.supabaseClient
      .from('community_posts')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', postId);
    if (result.error) throw result.error;
    if (typeof showToast === 'function') showToast('Publicacao atualizada.', 'success');
    await loadAdminCommunity();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Erro ao moderar publicacao.', 'error');
  }
}

console.log('community-management.js carregado');
