var adminCommunityPosts = [];

function isAdminCommunitySchemaError(error) {
  var text = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
  var tableError = text.indexOf('42p01') !== -1 || text.indexOf('does not exist') !== -1 || text.indexOf('could not find the table') !== -1;
  var communityTable = text.indexOf('community_posts') !== -1 || text.indexOf('community_comments') !== -1 || text.indexOf('community_reactions') !== -1;
  return tableError && communityTable;
}

function groupAdminCommunityByPostId(items) {
  var map = {};
  (items || []).forEach(function(item) {
    if (!item || !item.post_id) return;
    if (!map[item.post_id]) map[item.post_id] = [];
    map[item.post_id].push(item);
  });
  return map;
}

function uniqueAdminCommunityValues(values) {
  var seen = {};
  return (values || []).filter(function(value) {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

async function loadAdminCommunityProfiles(userIds) {
  var profilesById = {};
  var ids = uniqueAdminCommunityValues(userIds);
  if (!ids.length) return profilesById;

  try {
    var result = await window.supabaseClient
      .from('profiles')
      .select('id, full_name, public_name, avatar_url')
      .in('id', ids);
    if (result.error) throw result.error;
    (result.data || []).forEach(function(profile) {
      profilesById[profile.id] = profile;
    });
  } catch (error) {
    console.warn('Erro ao buscar perfis da comunidade no admin:', error);
    if (typeof showToast === 'function') {
      showToast('Não foi possível carregar os perfis da comunidade.', 'warning');
    }
  }

  return profilesById;
}

function formatAdminCommunityDate(value) {
  if (!value) return '';
  var date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getAdminCommunityStatus(post) {
  var status = post && post.status ? post.status : 'published';
  var labels = {
    published: 'Publicado',
    hidden: 'Oculto',
    removed: 'Removido'
  };
  var classes = {
    published: 'is-published',
    hidden: 'is-hidden',
    removed: 'is-removed'
  };
  return {
    value: status,
    label: labels[status] || status,
    classes: classes[status] || 'bg-slate-500/15 text-slate-200 border-slate-400/25'
  };
}

async function loadAdminCommunity() {
  var container = document.getElementById('admin-community-list');
  if (!container || !window.supabaseClient) return;
  container.innerHTML = '<div class="admin-community-loading"><i class="fas fa-circle-notch fa-spin"></i><span>Carregando publicações...</span></div>';

  try {
    var postsResult = await window.supabaseClient
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
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
        .in('post_id', postIds);
      if (commentsResult.error) throw commentsResult.error;
      comments = commentsResult.data || [];
    }

    var userIds = posts.map(function(post) { return post.user_id; })
      .concat(comments.map(function(comment) { return comment.user_id; }));
    var profilesById = await loadAdminCommunityProfiles(userIds);
    var reactionsByPost = groupAdminCommunityByPostId(reactions);
    var commentsByPost = groupAdminCommunityByPostId(comments);

    adminCommunityPosts = posts.map(function(post) {
      post.profiles = profilesById[post.user_id] || {};
      post.community_reactions = reactionsByPost[post.id] || [];
      post.community_comments = commentsByPost[post.id] || [];
      return post;
    });

    renderAdminCommunity();
  } catch (error) {
    console.error('Erro ao carregar comunidade no admin:', error);
    container.innerHTML = isAdminCommunitySchemaError(error)
      ? '<div class="admin-community-empty"><div><i class="fas fa-comments"></i></div><h3>Comunidade ainda não ativada</h3><p>Execute o SQL da Comunidade ADPEL no Supabase.</p></div>'
      : '<div class="admin-community-empty"><div><i class="fas fa-triangle-exclamation"></i></div><h3>Não foi possível carregar a moderação da comunidade.</h3><p>Tente novamente em instantes.</p></div>';
  }
}

function renderAdminCommunity() {
  var container = document.getElementById('admin-community-list');
  if (!container) return;
  if (!adminCommunityPosts.length) {
    container.innerHTML = '<div class="admin-community-empty"><div><i class="fas fa-comments"></i></div><h3>Nenhuma publicação</h3><p>As publicações da comunidade aparecerão aqui.</p></div>';
    return;
  }

  container.innerHTML = '<div class="admin-community-grid">' + adminCommunityPosts.map(function(post) {
    var author = post.profiles || {};
    var name = author.public_name || author.full_name || 'Membro';
    var avatar = author.avatar_url || '';
    var initials = String(name || 'M').trim().charAt(0).toUpperCase() || 'M';
    var reactions = Array.isArray(post.community_reactions) ? post.community_reactions.length : 0;
    var comments = Array.isArray(post.community_comments) ? post.community_comments.length : 0;
    var status = getAdminCommunityStatus(post);
    return [
      '<article class="admin-community-card">',
        '<div class="admin-community-card-header">',
          '<div class="admin-community-author">',
            '<span class="admin-community-avatar">' + (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(name) + '">' : escapeHtml(initials)) + '</span>',
            '<div class="min-w-0">',
              '<h4>' + escapeHtml(name) + '</h4>',
              '<p>' + escapeHtml(formatAdminCommunityDate(post.created_at)) + '</p>',
            '</div>',
          '</div>',
          '<span class="admin-community-status ' + status.classes + '">' + escapeHtml(status.label) + '</span>',
        '</div>',
        '<p class="admin-community-content">' + escapeHtml(post.content || '') + '</p>',
        post.image_url ? '<div class="admin-community-thumb"><img src="' + escapeHtml(post.image_url) + '" alt="Imagem da publicação"></div>' : '',
        '<div class="admin-community-stats">',
          '<span><i class="fas fa-hands-praying"></i> ' + reactions + ' améns</span>',
          '<span><i class="fas fa-comment"></i> ' + comments + ' comentários</span>',
        '</div>',
        '<div class="admin-community-actions">',
          '<button onclick="setCommunityPostStatus(&quot;' + post.id + '&quot;,&quot;hidden&quot;)" class="admin-community-btn warn"><i class="fas fa-eye-slash"></i> Ocultar</button>',
          '<button onclick="setCommunityPostStatus(&quot;' + post.id + '&quot;,&quot;published&quot;)" class="admin-community-btn success"><i class="fas fa-rotate-left"></i> Restaurar</button>',
          '<button onclick="setCommunityPostStatus(&quot;' + post.id + '&quot;,&quot;removed&quot;)" class="admin-community-btn danger"><i class="fas fa-trash"></i> Remover</button>',
        '</div>',
      '</article>'
    ].join('');
  }).join('') + '</div>';
}

async function setCommunityPostStatus(postId, status) {
  if (!window.supabaseClient) return;
  try {
    var result = await window.supabaseClient
      .from('community_posts')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .select('id')
      .single();
    if (result.error) throw result.error;
    if (typeof showToast === 'function') showToast('Publicação atualizada.', 'success');
    await loadAdminCommunity();
  } catch (error) {
    console.error('Erro ao moderar publicação:', error);
    if (typeof showToast === 'function') showToast('Erro ao moderar publicação.', 'error');
  }
}

console.log('community-management.js carregado');
