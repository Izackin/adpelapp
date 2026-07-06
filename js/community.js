var communityPostsCache = [];
var communityCommentsCache = {};
var communityFilter = 'all';

var COMMUNITY_CATEGORIES = {
  all: { label: 'Todos', icon: 'fa-layer-group' },
  testemunho: { label: 'Testemunho', icon: 'fa-star' },
  oracao: { label: 'Pedido de oracao', icon: 'fa-hands-praying' },
  gratidao: { label: 'Gratidao', icon: 'fa-heart' },
  reflexao: { label: 'Reflexao', icon: 'fa-book-open' },
  comunhao: { label: 'Comunhao', icon: 'fa-people-group' }
};

function isCommunitySchemaError(error) {
  var text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  var tableError = text.indexOf('42p01') !== -1 || text.indexOf('does not exist') !== -1 || text.indexOf('could not find the table') !== -1;
  var communityTable = text.indexOf('community_posts') !== -1 || text.indexOf('community_comments') !== -1 || text.indexOf('community_reactions') !== -1;
  return tableError && communityTable;
}

function groupByPostId(items) {
  var map = {};
  (items || []).forEach(function(item) {
    if (!item || !item.post_id) return;
    if (!map[item.post_id]) map[item.post_id] = [];
    map[item.post_id].push(item);
  });
  return map;
}

function uniqueValues(values) {
  var seen = {};
  return (values || []).filter(function(value) {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

async function loadCommunityProfiles(userIds) {
  var profilesById = {};
  var ids = uniqueValues(userIds);
  if (!ids.length) return profilesById;

  try {
    var result = await window.supabaseClient
      .from('profiles')
      .select('id, full_name, public_name, avatar_url, show_public_profile')
      .in('id', ids);
    if (result.error) throw result.error;
    (result.data || []).forEach(function(profile) {
      profilesById[profile.id] = profile;
    });
  } catch (error) {
    console.warn('Comunidade carregada, mas houve erro ao buscar perfis:', error);
    if (typeof showToast === 'function') {
      showToast('Comunidade carregada, mas houve erro ao buscar perfis. Tente novamente.', 'warning');
    }
  }

  return profilesById;
}

function renderCommunityShell() {
  var root = document.getElementById('community-content');
  if (!root) return;
  var filters = Object.keys(COMMUNITY_CATEGORIES).map(function(key) {
    var active = communityFilter === key;
    var cat = COMMUNITY_CATEGORIES[key];
    return '<button onclick="setCommunityFilter(&quot;' + key + '&quot;)" class="min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold border transition inline-flex items-center justify-center gap-2 whitespace-nowrap ' + (active ? 'bg-adpel-600 text-white border-adpel-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50') + '"><i class="fas ' + cat.icon + '"></i>' + escapeHtml(cat.label) + '</button>';
  }).join('');

  root.innerHTML = [
    '<div class="space-y-5">',
      '<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">',
        '<div><h2 class="text-3xl md:text-4xl font-bold text-gray-800">Comunidade ADPEL</h2><p class="text-gray-500 mt-2 max-w-2xl">Compartilhe testemunhos, pedidos de oracao e palavras de edificacao.</p></div>',
        '<button onclick="openCommunityComposer()" class="min-h-[48px] px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition inline-flex items-center justify-center gap-2"><i class="fas fa-plus"></i> Nova publicacao</button>',
      '</div>',
      '<div class="flex gap-2 overflow-x-auto pb-2">' + filters + '</div>',
      '<div id="community-composer" class="hidden bg-white rounded-2xl border border-gray-100 p-4 md:p-5"></div>',
      '<div id="community-posts-list" class="space-y-4"></div>',
    '</div>'
  ].join('');
}

async function loadCommunityData() {
  renderCommunityShell();
  var list = document.getElementById('community-posts-list');
  if (list) list.innerHTML = '<div class="text-center py-8 text-gray-500">Carregando comunidade...</div>';
  if (!window.supabaseClient) return;

  try {
    var query = window.supabaseClient
      .from('community_posts')
      .select('*')
      .eq('status', 'published')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (communityFilter !== 'all') query = query.eq('category', communityFilter);
    var postsResult = await query;
    if (postsResult.error) throw postsResult.error;

    var posts = postsResult.data || [];
    var postIds = posts.map(function(post) { return post.id; }).filter(Boolean);
    var reactions = [];
    var comments = [];

    if (postIds.length) {
      var reactionsResult = await window.supabaseClient
        .from('community_reactions')
        .select('id, post_id, user_id, reaction_type, created_at')
        .in('post_id', postIds);
      if (reactionsResult.error) throw reactionsResult.error;
      reactions = reactionsResult.data || [];

      var commentsResult = await window.supabaseClient
        .from('community_comments')
        .select('id, post_id, user_id, content, status, created_at')
        .in('post_id', postIds)
        .eq('status', 'published')
        .order('created_at', { ascending: true });
      if (commentsResult.error) throw commentsResult.error;
      comments = commentsResult.data || [];
    }

    var userIds = posts.map(function(post) { return post.user_id; })
      .concat(comments.map(function(comment) { return comment.user_id; }));
    var profilesById = await loadCommunityProfiles(userIds);
    var reactionsByPost = groupByPostId(reactions);
    var commentsByPost = groupByPostId(comments);

    communityPostsCache = posts.map(function(post) {
      var postComments = (commentsByPost[post.id] || []).map(function(comment) {
        comment.profiles = profilesById[comment.user_id] || {};
        return comment;
      });
      post.profiles = profilesById[post.user_id] || {};
      post.community_reactions = reactionsByPost[post.id] || [];
      post.community_comments = postComments;
      return post;
    });
    renderCommunityPosts();
  } catch (error) {
    console.error('Erro ao carregar comunidade:', error);
    if (list) {
      list.innerHTML = isCommunitySchemaError(error)
        ? '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-comments text-2xl"></i></div><h3>Comunidade ainda nao ativada</h3><p>Execute o SQL da Comunidade ADPEL no Supabase.</p></div>'
        : '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-triangle-exclamation text-2xl"></i></div><h3>Nao foi possivel carregar</h3><p>Tente novamente em instantes.</p></div>';
    }
  }
}

function setCommunityFilter(filter) {
  communityFilter = filter || 'all';
  loadCommunityData();
}

function openCommunityComposer() {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn) {
    showToast('Faca login para publicar na comunidade.', 'warning');
    openModal('login-modal');
    return;
  }
  var composer = document.getElementById('community-composer');
  if (!composer) return;
  composer.classList.remove('hidden');
  composer.innerHTML = [
    '<div class="space-y-3">',
      '<div class="grid grid-cols-1 sm:grid-cols-[14rem_1fr] gap-3">',
        '<select id="community-post-category" class="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white text-gray-800 min-h-[44px]">',
          '<option value="testemunho">Testemunho</option><option value="oracao">Pedido de oracao</option><option value="gratidao">Gratidao</option><option value="reflexao">Reflexao</option><option value="comunhao">Comunhao</option>',
        '</select>',
        '<div class="text-sm text-gray-500 flex items-center">Publique algo que edifique e fortaleça a comunhao.</div>',
      '</div>',
      '<textarea id="community-post-content" maxlength="800" rows="4" oninput="updateCommunityCounter()" placeholder="Escreva sua mensagem..." class="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 resize-y"></textarea>',
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">',
        '<span id="community-char-counter" class="text-xs text-gray-500">0/800</span>',
        '<div class="grid grid-cols-2 sm:flex gap-2">',
          '<button onclick="closeCommunityComposer()" class="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50">Cancelar</button>',
          '<button onclick="createCommunityPost()" class="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"><i class="fas fa-paper-plane mr-1"></i> Publicar</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');
}

function closeCommunityComposer() {
  var composer = document.getElementById('community-composer');
  if (composer) composer.classList.add('hidden');
}

function updateCommunityCounter() {
  var input = document.getElementById('community-post-content');
  var counter = document.getElementById('community-char-counter');
  if (input && counter) counter.textContent = input.value.length + '/800';
}

async function createCommunityPost() {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) return;
  var content = (document.getElementById('community-post-content') || {}).value || '';
  var category = (document.getElementById('community-post-category') || {}).value || 'reflexao';
  content = content.trim().slice(0, 800);
  if (!content) {
    showToast('Escreva uma mensagem antes de publicar.', 'warning');
    return;
  }
  try {
    var result = await window.supabaseClient.from('community_posts').insert([{ user_id: userInfo.user.id, content: content, category: category, status: 'published' }]);
    if (result.error) throw result.error;
    showToast('Publicacao enviada para a Comunidade ADPEL!', 'success');
    closeCommunityComposer();
    await loadCommunityData();
  } catch (error) {
    console.error('Erro ao publicar:', error);
    showToast(isCommunitySchemaError(error) ? 'Execute o SQL da Comunidade ADPEL no Supabase.' : 'Nao foi possivel publicar agora.', 'error');
  }
}

function renderCommunityPosts() {
  var list = document.getElementById('community-posts-list');
  if (!list) return;
  if (!communityPostsCache.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-comments text-2xl"></i></div><h3>Nenhuma publicacao ainda</h3><p>Seja o primeiro a compartilhar uma palavra de edificacao.</p></div>';
    return;
  }
  var userInfo = getCurrentUserInfo();
  list.innerHTML = communityPostsCache.map(function(post) {
    var author = post.profiles || {};
    var authorName = author.public_name || author.full_name || 'Membro';
    var avatar = author.avatar_url || '';
    var initials = String(authorName).charAt(0).toUpperCase();
    var reactions = (post.community_reactions || []).filter(function(r) { return r.reaction_type === 'amen'; });
    var reacted = userInfo.user && reactions.some(function(r) { return r.user_id === userInfo.user.id; });
    var comments = (post.community_comments || []).filter(function(c) { return c.status === 'published'; });
    var cat = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES.reflexao;
    return [
      '<article class="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-sm">',
        '<div class="flex items-start gap-3">',
          '<button onclick="openCommunityAuthorProfile(&quot;' + escapeHtml(post.user_id) + '&quot;)" class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center overflow-hidden shrink-0 font-bold">',
            avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(authorName) + '" class="w-full h-full object-cover">' : escapeHtml(initials),
          '</button>',
          '<div class="flex-1 min-w-0">',
            '<button onclick="openCommunityAuthorProfile(&quot;' + escapeHtml(post.user_id) + '&quot;)" class="font-bold text-gray-800 hover:text-emerald-500 truncate block">' + escapeHtml(authorName) + '</button>',
            '<div class="flex flex-wrap gap-2 mt-1 text-xs text-gray-500"><span class="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold"><i class="fas ' + cat.icon + ' mr-1"></i>' + escapeHtml(cat.label) + '</span><span>' + formatDate(post.created_at) + '</span></div>',
          '</div>',
        '</div>',
        '<p class="mt-4 text-gray-700 leading-relaxed whitespace-pre-wrap">' + escapeHtml(post.content) + '</p>',
        '<div class="mt-4 grid grid-cols-2 sm:flex gap-2">',
          '<button onclick="toggleAmenReaction(&quot;' + post.id + '&quot;)" class="min-h-[44px] px-4 py-2 rounded-xl font-bold border ' + (reacted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-emerald-50') + '"><i class="fas fa-hands-praying mr-1"></i> Amem <span>(' + reactions.length + ')</span></button>',
          '<button onclick="toggleCommunityComments(&quot;' + post.id + '&quot;)" class="min-h-[44px] px-4 py-2 rounded-xl font-bold bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100"><i class="fas fa-comment mr-1"></i> Comentarios (' + comments.length + ')</button>',
        '</div>',
        '<div id="community-comments-' + post.id + '" class="hidden mt-4 border-t border-gray-100 pt-4 space-y-3">' + renderCommunityComments(post, comments) + '</div>',
      '</article>'
    ].join('');
  }).join('');
}

function renderCommunityComments(post, comments) {
  var html = comments.length ? comments.map(function(comment) {
    var author = comment.profiles || {};
    var name = author.public_name || author.full_name || 'Membro';
    return '<div class="bg-gray-50 rounded-xl p-3"><p class="text-xs font-bold text-gray-700">' + escapeHtml(name) + '</p><p class="text-sm text-gray-600 mt-1">' + escapeHtml(comment.content) + '</p></div>';
  }).join('') : '<p class="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">Nenhum comentario ainda.</p>';
  html += '<div class="flex flex-col sm:flex-row gap-2"><input id="community-comment-input-' + post.id + '" maxlength="300" placeholder="Escreva um comentario..." class="flex-1 px-3 py-3 rounded-xl border border-gray-300 bg-white text-gray-800 min-h-[44px]"><button onclick="createCommunityComment(&quot;' + post.id + '&quot;)" class="min-h-[44px] px-4 py-2 rounded-xl bg-adpel-600 text-white font-bold">Comentar</button></div>';
  return html;
}

function toggleCommunityComments(postId) {
  var el = document.getElementById('community-comments-' + postId);
  if (el) el.classList.toggle('hidden');
}

async function createCommunityComment(postId) {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faca login para comentar.', 'warning');
    openModal('login-modal');
    return;
  }
  var input = document.getElementById('community-comment-input-' + postId);
  var content = input ? input.value.trim().slice(0, 300) : '';
  if (!content) {
    showToast('Escreva um comentario.', 'warning');
    return;
  }
  try {
    var result = await window.supabaseClient.from('community_comments').insert([{ post_id: postId, user_id: userInfo.user.id, content: content, status: 'published' }]);
    if (result.error) throw result.error;
    await loadCommunityData();
    setTimeout(function() {
      var el = document.getElementById('community-comments-' + postId);
      if (el) el.classList.remove('hidden');
    }, 50);
  } catch (error) {
    showToast('Nao foi possivel comentar agora.', 'error');
  }
}

async function toggleAmenReaction(postId) {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faca login para reagir.', 'warning');
    openModal('login-modal');
    return;
  }
  var post = communityPostsCache.find(function(item) { return item.id === postId; });
  var reactions = post && Array.isArray(post.community_reactions) ? post.community_reactions : [];
  var existing = reactions.find(function(r) { return r.user_id === userInfo.user.id && r.reaction_type === 'amen'; });
  try {
    var result = existing
      ? await window.supabaseClient.from('community_reactions').delete().eq('id', existing.id)
      : await window.supabaseClient.from('community_reactions').insert([{ post_id: postId, user_id: userInfo.user.id, reaction_type: 'amen' }]);
    if (result.error) throw result.error;
    await loadCommunityData();
  } catch (error) {
    showToast('Nao foi possivel atualizar o Amem.', 'error');
  }
}

function openCommunityAuthorProfile(userId) {
  if (typeof openPublicProfile === 'function') openPublicProfile(userId);
}

Object.assign(window, {
  loadCommunityData,
  setCommunityFilter,
  openCommunityComposer,
  closeCommunityComposer,
  updateCommunityCounter,
  createCommunityPost,
  renderCommunityPosts,
  toggleCommunityComments,
  createCommunityComment,
  toggleAmenReaction,
  openCommunityAuthorProfile
});
