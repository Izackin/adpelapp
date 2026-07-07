var communityPostsCache = [];
var communityCommentsCache = {};
var communityFilter = 'all';
var openCommunityMenuId = null;

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

function getCommunityProfileDisplay(profile, fallback) {
  var safeProfile = profile || {};
  return safeProfile.public_name || safeProfile.full_name || fallback || 'Membro';
}

function getCommunityInitials(name) {
  var parts = String(name || 'Membro').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'M';
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}

function renderCommunityAvatar(profile, sizeClass, fallback) {
  var name = getCommunityProfileDisplay(profile, fallback);
  var avatar = profile && profile.avatar_url ? profile.avatar_url : '';
  return '<span class="community-avatar ' + (sizeClass || '') + '">' +
    (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(name) + '">' : escapeHtml(getCommunityInitials(name))) +
  '</span>';
}

function formatCommunityDate(value) {
  if (!value) return '';
  var date = new Date(value);
  if (isNaN(date.getTime())) return '';
  var now = new Date();
  var diffMs = now.getTime() - date.getTime();
  var minute = 60 * 1000;
  var hour = 60 * minute;
  var day = 24 * hour;
  if (diffMs < minute) return 'agora';
  if (diffMs < hour) return 'há ' + Math.max(1, Math.floor(diffMs / minute)) + ' min';
  if (diffMs < day) return 'há ' + Math.floor(diffMs / hour) + ' h';

  var yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  var sameYesterday = date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  var time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameYesterday) return 'ontem às ' + time;

  var months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return date.getDate() + ' de ' + months[date.getMonth()] + ' às ' + time;
}

async function loadCommunityProfiles(userIds) {
  var profilesById = {};
  var ids = uniqueValues(userIds);
  if (!ids.length) return profilesById;

  try {
    var result = await window.supabaseClient
      .from('profiles')
      .select('id, full_name, public_name, avatar_url, bio, ministry, show_public_profile')
      .in('id', ids);
    if (result.error) {
      var text = String(result.error && (result.error.message || result.error.details || result.error.hint || result.error.code) || '').toLowerCase();
      var missingOptionalProfileFields = text.indexOf('bio') !== -1 || text.indexOf('ministry') !== -1 || text.indexOf('42703') !== -1 || text.indexOf('pgrst204') !== -1;
      if (missingOptionalProfileFields) {
        result = await window.supabaseClient
          .from('profiles')
          .select('id, full_name, public_name, avatar_url, show_public_profile')
          .in('id', ids);
      }
    }
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
  var userInfo = getCurrentUserInfo();
  var profile = userInfo.profile || {};
  var displayName = getCommunityProfileDisplay(profile, 'Membro');

  root.innerHTML = [
    '<div class="community-shell">',
      '<section class="community-hero">',
        '<div class="community-hero-copy">',
          '<span class="community-kicker"><i class="fas fa-heart"></i> Feed da igreja</span>',
          '<h2>Comunidade ADPEL</h2>',
          '<p>Um espaço para compartilhar pensamentos, testemunhos e momentos com a igreja.</p>',
        '</div>',
        '<div class="community-hero-mark" aria-hidden="true"><i class="fas fa-cross"></i></div>',
      '</section>',
      '<section class="community-composer-card">',
        '<button onclick="openCommunityComposer()" class="community-composer-trigger">',
          renderCommunityAvatar(profile, 'community-avatar-lg', displayName),
          '<span class="community-composer-placeholder">Compartilhe algo com a comunidade...</span>',
          '<span class="community-composer-plus"><i class="fas fa-pen"></i></span>',
        '</button>',
        '<div id="community-composer" class="hidden community-composer"></div>',
      '</section>',
      '<section class="community-feed">',
        '<div id="community-posts-list" class="community-posts-list"></div>',
      '</section>',
    '</div>'
  ].join('');
}

function renderCommunityComposerForm() {
  return [
    '<div class="community-composer-expanded">',
      '<textarea id="community-post-content" maxlength="800" rows="4" oninput="updateCommunityCounter()" placeholder="Compartilhe algo com a comunidade..." class="community-composer-textarea"></textarea>',
      '<input id="community-post-category" type="hidden" value="comunhao">',
      '<div class="community-composer-toolbar">',
        '<span id="community-char-counter" class="community-char-counter">0/800</span>',
        '<div class="community-composer-actions">',
          '<button onclick="closeCommunityComposer()" class="community-secondary-btn">Cancelar</button>',
          '<button onclick="createCommunityPost()" class="community-primary-btn"><i class="fas fa-paper-plane"></i> Publicar</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');
}

async function loadCommunityData() {
  renderCommunityShell();
  var list = document.getElementById('community-posts-list');
  if (list) list.innerHTML = '<div class="community-loading"><i class="fas fa-circle-notch fa-spin"></i><span>Carregando comunidade...</span></div>';
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
        ? '<div class="community-empty"><div class="community-empty-icon"><i class="fas fa-comments"></i></div><h3>Comunidade ainda não ativada</h3><p>Execute o SQL da Comunidade ADPEL no Supabase.</p></div>'
        : '<div class="community-empty"><div class="community-empty-icon"><i class="fas fa-triangle-exclamation"></i></div><h3>Não foi possível carregar</h3><p>Tente novamente em instantes.</p></div>';
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
    showToast('Faça login para publicar na comunidade.', 'warning');
    openModal('login-modal');
    return;
  }
  var composer = document.getElementById('community-composer');
  if (!composer) return;
  composer.classList.remove('hidden');
  composer.innerHTML = renderCommunityComposerForm();
  var input = document.getElementById('community-post-content');
  if (input) input.focus();
}

function closeCommunityComposer() {
  var composer = document.getElementById('community-composer');
  if (composer) {
    composer.classList.add('hidden');
    composer.innerHTML = '';
  }
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
  var category = (document.getElementById('community-post-category') || {}).value || 'comunhao';
  content = content.trim().slice(0, 800);
  if (!content) {
    showToast('Escreva uma mensagem antes de publicar.', 'warning');
    return;
  }
  try {
    var result = await window.supabaseClient.from('community_posts').insert([{ user_id: userInfo.user.id, content: content, category: category, status: 'published' }]);
    if (result.error) throw result.error;
    showToast('Publicação enviada para a Comunidade ADPEL!', 'success');
    closeCommunityComposer();
    await loadCommunityData();
  } catch (error) {
    console.error('Erro ao publicar:', error);
    showToast(isCommunitySchemaError(error) ? 'Execute o SQL da Comunidade ADPEL no Supabase.' : 'Não foi possível publicar agora.', 'error');
  }
}

function renderCommunityPosts() {
  var list = document.getElementById('community-posts-list');
  if (!list) return;
  if (!communityPostsCache.length) {
    list.innerHTML = '<div class="community-empty"><div class="community-empty-icon"><i class="fas fa-comments"></i></div><h3>Nenhuma publicação ainda</h3><p>Seja o primeiro a compartilhar uma palavra de edificação.</p></div>';
    return;
  }
  var userInfo = getCurrentUserInfo();
  list.innerHTML = communityPostsCache.map(function(post) {
    var author = post.profiles || {};
    var authorName = getCommunityProfileDisplay(author, 'Membro');
    var authorMeta = author.ministry || author.bio || 'Membro da comunidade';
    var reactions = (post.community_reactions || []).filter(function(r) { return r.reaction_type === 'amen'; });
    var reacted = userInfo.user && reactions.some(function(r) { return r.user_id === userInfo.user.id; });
    var comments = (post.community_comments || []).filter(function(c) { return c.status === 'published'; });
    return [
      '<article class="community-post">',
        '<div class="community-post-header">',
          '<button onclick="openCommunityAuthorProfile(&quot;' + escapeHtml(post.user_id) + '&quot;)" class="community-author-btn">',
            renderCommunityAvatar(author, '', authorName),
          '</button>',
          '<div class="community-author-meta">',
            '<button onclick="openCommunityAuthorProfile(&quot;' + escapeHtml(post.user_id) + '&quot;)" class="community-author-name">' + escapeHtml(authorName) + '</button>',
            '<div class="community-meta"><span>' + escapeHtml(authorMeta) + '</span><span class="community-dot">&bull;</span><time>' + escapeHtml(formatCommunityDate(post.created_at)) + '</time></div>',
          '</div>',
          renderCommunityPostMenu(post, userInfo),
        '</div>',
        '<div class="community-post-body"><p>' + escapeHtml(post.content) + '</p></div>',
        '<div class="community-post-stats">' + reactions.length + ' améns <span>&bull;</span> ' + comments.length + ' comentários</div>',
        '<div class="community-post-footer">',
          '<button onclick="toggleAmenReaction(&quot;' + post.id + '&quot;)" class="community-action-btn ' + (reacted ? 'is-active' : '') + '"><i class="fas fa-hands-praying"></i><span>Amém</span></button>',
          '<button onclick="toggleCommunityComments(&quot;' + post.id + '&quot;)" class="community-action-btn"><i class="fas fa-comment"></i><span>Comentar</span></button>',
        '</div>',
        '<div id="community-comments-' + post.id + '" class="hidden community-comments">' + renderCommunityComments(post, comments) + '</div>',
      '</article>'
    ].join('');
  }).join('');
}

function renderCommunityPostMenu(post, userInfo) {
  var isAuthor = userInfo.user && userInfo.user.id === post.user_id;
  var isMaster = !!userInfo.isMaster;
  var items = [
    '<button onclick="openCommunityAuthorProfile(&quot;' + escapeHtml(post.user_id) + '&quot;)"><i class="fas fa-user"></i> Ver perfil</button>',
    '<button onclick="copyCommunityPostText(&quot;' + escapeHtml(post.id) + '&quot;)"><i class="fas fa-copy"></i> Copiar texto</button>'
  ];
  if (isAuthor) {
    items.push('<button class="danger" onclick="deleteCommunityPost(&quot;' + escapeHtml(post.id) + '&quot;)"><i class="fas fa-trash"></i> Excluir publicação</button>');
  }
  if (isMaster && !isAuthor) {
    items.push('<button onclick="hideCommunityPost(&quot;' + escapeHtml(post.id) + '&quot;)"><i class="fas fa-eye-slash"></i> Ocultar publicação</button>');
    items.push('<button class="danger" onclick="deleteCommunityPost(&quot;' + escapeHtml(post.id) + '&quot;)"><i class="fas fa-trash"></i> Remover publicação</button>');
  }
  return [
    '<div class="community-menu-wrap">',
      '<button onclick="toggleCommunityMenu(&quot;' + escapeHtml(post.id) + '&quot;)" class="community-menu-trigger" aria-label="Mais opções"><i class="fas fa-ellipsis"></i></button>',
      '<div id="community-menu-' + escapeHtml(post.id) + '" class="community-menu hidden">' + items.join('') + '</div>',
    '</div>'
  ].join('');
}

function renderCommunityComments(post, comments) {
  var html = comments.length ? comments.map(function(comment) {
    var author = comment.profiles || {};
    var name = getCommunityProfileDisplay(author, 'Membro');
    return [
      '<div class="community-comment">',
        renderCommunityAvatar(author, 'community-avatar-sm', name),
        '<div class="community-comment-bubble">',
          '<div class="community-comment-head"><strong>' + escapeHtml(name) + '</strong><span>' + escapeHtml(formatCommunityDate(comment.created_at)) + '</span></div>',
          '<p>' + escapeHtml(comment.content) + '</p>',
        '</div>',
      '</div>'
    ].join('');
  }).join('') : '<p class="community-no-comments">Nenhum comentário ainda.</p>';
  html += '<div class="community-comment-input-row"><input id="community-comment-input-' + post.id + '" maxlength="300" placeholder="Escreva um comentário..." class="community-comment-input"><button onclick="createCommunityComment(&quot;' + post.id + '&quot;)" class="community-comment-submit"><i class="fas fa-paper-plane"></i><span>Enviar</span></button></div>';
  return html;
}

function toggleCommunityComments(postId) {
  var el = document.getElementById('community-comments-' + postId);
  if (el) el.classList.toggle('hidden');
}

async function createCommunityComment(postId) {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faça login para comentar.', 'warning');
    openModal('login-modal');
    return;
  }
  var input = document.getElementById('community-comment-input-' + postId);
  var content = input ? input.value.trim().slice(0, 300) : '';
  if (!content) {
    showToast('Escreva um comentário.', 'warning');
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
    showToast('Não foi possível comentar agora.', 'error');
  }
}

async function toggleAmenReaction(postId) {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.user) {
    showToast('Faça login para reagir.', 'warning');
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
    showToast('Não foi possível atualizar o Amém.', 'error');
  }
}

function openCommunityAuthorProfile(userId) {
  if (typeof openPublicProfile === 'function') openPublicProfile(userId);
}

function toggleCommunityMenu(postId) {
  var current = document.getElementById('community-menu-' + postId);
  document.querySelectorAll('.community-menu').forEach(function(menu) {
    if (menu !== current) menu.classList.add('hidden');
  });
  if (!current) return;
  current.classList.toggle('hidden');
  openCommunityMenuId = current.classList.contains('hidden') ? null : postId;
}

function getCommunityPostById(postId) {
  return communityPostsCache.find(function(item) { return item.id === postId; });
}

async function copyCommunityPostText(postId) {
  var post = getCommunityPostById(postId);
  if (!post) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(post.content || '');
    } else {
      var temp = document.createElement('textarea');
      temp.value = post.content || '';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    showToast('Texto copiado.', 'success');
  } catch (error) {
    showToast('Não foi possível copiar o texto.', 'error');
  }
}

async function hideCommunityPost(postId) {
  var userInfo = getCurrentUserInfo();
  if (!userInfo.isMaster) return;
  try {
    var result = await window.supabaseClient
      .from('community_posts')
      .update({ status: 'hidden', updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select('id')
      .single();
    if (result.error) throw result.error;
    showToast('Publicação ocultada.', 'success');
    await loadCommunityData();
  } catch (error) {
    showToast('Não foi possível ocultar a publicação.', 'error');
  }
}

async function deleteCommunityPost(postId) {
  var userInfo = getCurrentUserInfo();
  var post = getCommunityPostById(postId);
  if (!post || (!userInfo.isMaster && (!userInfo.user || userInfo.user.id !== post.user_id))) return;
  if (!confirm('Deseja remover esta publicação?')) return;
  try {
    var result = await window.supabaseClient
      .from('community_posts')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select('id')
      .single();
    if (result.error) throw result.error;
    showToast('Publicação removida.', 'success');
    await loadCommunityData();
  } catch (error) {
    showToast('Não foi possível remover a publicação.', 'error');
  }
}

document.addEventListener('click', function(event) {
  if (!openCommunityMenuId) return;
  var target = event.target;
  if (target && target.closest && target.closest('.community-menu-wrap')) return;
  document.querySelectorAll('.community-menu').forEach(function(menu) {
    menu.classList.add('hidden');
  });
  openCommunityMenuId = null;
});

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
  openCommunityAuthorProfile,
  toggleCommunityMenu,
  copyCommunityPostText,
  hideCommunityPost,
  deleteCommunityPost
});
