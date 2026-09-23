(function () {
  'use strict';

  var DEBUG = false;

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function sanitizeUrl(value, options) {
    options = options || {};
    var raw = String(value == null ? '' : value).trim();
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return '';

    var protocols = options.protocols || ['https:', 'http:'];
    var allowRelative = options.allowRelative === true;
    var hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw);

    if (!hasScheme) {
      if (!allowRelative || raw.indexOf('//') === 0 || raw.indexOf('\\\\') === 0) return '';
      try {
        var base = new URL((window.location && window.location.origin) || 'https://adpel.invalid');
        var relative = new URL(raw, base);
        if (relative.origin !== base.origin) return '';
        return raw;
      } catch (error) {
        return '';
      }
    }

    try {
      var parsed = new URL(raw);
      return protocols.indexOf(parsed.protocol.toLowerCase()) !== -1 ? parsed.href : '';
    } catch (error) {
      return '';
    }
  }

  function safeExternalUrl(value) {
    return sanitizeUrl(value, { protocols: ['https:', 'http:'] });
  }

  function safeImageUrl(value, options) {
    options = options || {};
    var protocols = options.allowBlob === true ? ['https:', 'http:', 'blob:'] : ['https:', 'http:'];
    return sanitizeUrl(value, { protocols: protocols, allowRelative: options.allowRelative === true });
  }

  function safeNavigationUrl(value) {
    return sanitizeUrl(value, { protocols: ['https:', 'http:'], allowRelative: true });
  }

  function encodeInlineJson(value) {
    return encodeURIComponent(JSON.stringify(value)).replace(/'/g, '%27');
  }

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
    escapeHtml: typeof window.escapeHtml === 'function' ? window.escapeHtml : escapeHtml,
    sanitizeUrl: sanitizeUrl,
    safeExternalUrl: safeExternalUrl,
    safeImageUrl: safeImageUrl,
    safeNavigationUrl: safeNavigationUrl,
    encodeInlineJson: encodeInlineJson,
    getUserRole: getUserRole,
    isUserMaster: isUserMaster,
    canManageOwnResource: canManageOwnResource,
    canManageCommunityPost: canManageCommunityPost,
    validateAdpelUploadFile: validateAdpelUploadFile,
    adpelDebugLog: adpelDebugLog
  });
})();
