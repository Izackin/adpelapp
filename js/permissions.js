(function () {
  'use strict';

  var DEBUG = false;

  function getUserRole(userInfo) {
    var info = userInfo || (typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : {});
    var profile = info && info.profile ? info.profile : {};
    return String(profile.role || '').trim().toLowerCase();
  }

  function isUserMaster(userInfo) {
    return getUserRole(userInfo) === 'master';
  }

  function canManageOwnResource(resourceUserId, userInfo) {
    var info = userInfo || (typeof getCurrentUserInfo === 'function' ? getCurrentUserInfo() : {});
    var user = info && info.user ? info.user : null;
    if (!resourceUserId || !user || !user.id) return false;
    return String(resourceUserId) === String(user.id);
  }

  function canManageCommunityPost(post, userInfo) {
    return !!(post && (isUserMaster(userInfo) || canManageOwnResource(post.user_id, userInfo)));
  }

  function adpelDebugLog() {
    if (!DEBUG && !window.ADPEL_DEBUG) return;
    console.log.apply(console, arguments);
  }

  function validateAdpelUploadFile(file, options) {
    options = options || {};
    if (!file) return { ok: false, message: 'Arquivo inválido.' };

    var name = String(file.name || '').toLowerCase();
    var ext = name.indexOf('.') >= 0 ? name.split('.').pop() : '';
    var blocked = ['js', 'mjs', 'exe', 'bat', 'cmd', 'html', 'htm', 'svg', 'sh', 'ps1', 'php'];
    var allowed = options.allowedExtensions || ['pdf', 'doc', 'docx'];
    var maxSize = options.maxSize || 20 * 1024 * 1024;

    if (blocked.indexOf(ext) !== -1) {
      return { ok: false, message: 'Tipo de arquivo não permitido por segurança.' };
    }
    if (allowed.indexOf(ext) === -1) {
      return { ok: false, message: 'Envie apenas: ' + allowed.join(', ').toUpperCase() + '.' };
    }
    if (file.size > maxSize) {
      return { ok: false, message: 'Arquivo muito grande. Limite: ' + Math.round(maxSize / 1024 / 1024) + 'MB.' };
    }
    return { ok: true };
  }

  Object.assign(window, {
    ADPEL_DEBUG: window.ADPEL_DEBUG || DEBUG,
    getUserRole: getUserRole,
    isUserMaster: isUserMaster,
    canManageOwnResource: canManageOwnResource,
    canManageCommunityPost: canManageCommunityPost,
    validateAdpelUploadFile: validateAdpelUploadFile,
    adpelDebugLog: adpelDebugLog
  });
})();
