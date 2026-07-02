// Corrige textos que foram salvos como UTF-8 lido em Windows-1252.
// A correcao e aplicada apenas na apresentacao, sem alterar dados, rotas ou logica.
(function () {
  'use strict';

  var suspiciousPattern = /[\u00c2\u00c3\u00e2\u00f0\u201a-\u201e\u2020-\u2026\u2030\u0152\u0153\u0160\u0161\u0178\u2122]/;
  var textAttributes = ['alt', 'aria-label', 'aria-description', 'placeholder', 'title'];
  var cp1252Reverse = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f
  };

  function encodeCp1252(value) {
    var bytes = [];
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code <= 0xff) {
        bytes.push(code);
      } else if (cp1252Reverse[code]) {
        bytes.push(cp1252Reverse[code]);
      } else {
        return null;
      }
    }
    return new Uint8Array(bytes);
  }

  function repairText(value) {
    if (typeof value !== 'string' || !suspiciousPattern.test(value)) {
      return value;
    }

    var bytes = encodeCp1252(value);
    if (!bytes || typeof TextDecoder === 'undefined') {
      return value;
    }

    try {
      var fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return fixed || value;
    } catch (error) {
      return value;
    }
  }

  function fixTextNode(node) {
    var fixed = repairText(node.nodeValue);
    if (fixed !== node.nodeValue) {
      node.nodeValue = fixed;
    }
  }

  function fixElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    textAttributes.forEach(function (name) {
      if (!element.hasAttribute(name)) {
        return;
      }

      var current = element.getAttribute(name);
      var fixed = repairText(current);
      if (fixed !== current) {
        element.setAttribute(name, fixed);
      }
    });
  }

  function fixTree(root) {
    if (!root) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      fixTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      fixElement(root);
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        fixTextNode(node);
      } else {
        fixElement(node);
      }
      node = walker.nextNode();
    }
  }

  function patchMessages() {
    var nativeAlert = window.alert;
    if (typeof nativeAlert === 'function' && !nativeAlert.__adpelTextFixed) {
      var fixedAlert = function (message) {
        return nativeAlert.call(window, repairText(String(message)));
      };
      fixedAlert.__adpelTextFixed = true;
      window.alert = fixedAlert;
    }

    if (typeof window.showToast === 'function' && !window.showToast.__adpelTextFixed) {
      var originalToast = window.showToast;
      window.showToast = function (message, type) {
        return originalToast.call(this, repairText(String(message)), type);
      };
      window.showToast.__adpelTextFixed = true;
    }
  }

  function start() {
    patchMessages();
    fixTree(document.body);

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'characterData') {
          fixTextNode(mutation.target);
          return;
        }

        if (mutation.type === 'attributes') {
          fixElement(mutation.target);
          return;
        }

        mutation.addedNodes.forEach(fixTree);
      });

      patchMessages();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: textAttributes,
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  window.ADPELTextFix = {
    repairText: repairText,
    fixTree: fixTree
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
