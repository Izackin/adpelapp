// Utilitarios globais para validade de conteudo sem remover registros do banco.
(function () {
  'use strict';

  var DEFAULT_START_FIELDS = ['start_date', 'startDate', 'data_inicio', 'dataInicio'];
  var DEFAULT_END_FIELDS = ['end_date', 'endDate', 'data_fim', 'dataFim', 'expires_at', 'expiresAt', 'expiry'];
  var EMPTY_VALUES = ['', 'null', 'undefined'];

  function hasValue(value) {
    return value !== null && value !== undefined && EMPTY_VALUES.indexOf(String(value).trim().toLowerCase()) === -1;
  }

  function normalizeDate(date) {
    if (!hasValue(date)) return null;
    if (date instanceof Date) {
      return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
    }

    var value = String(date).trim();
    var dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      );
    }

    var parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function endOfDay(date) {
    var normalized = normalizeDate(date);
    if (!normalized) return null;
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }

  function firstDateFromFields(item, fields) {
    if (!item || !Array.isArray(fields)) return null;
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (hasValue(item[field])) {
        return item[field];
      }
    }
    return null;
  }

  function isWithinDateRange(item, startFields, endFields) {
    var now = new Date();
    var starts = Array.isArray(startFields) && startFields.length ? startFields : DEFAULT_START_FIELDS;
    var ends = Array.isArray(endFields) && endFields.length ? endFields : DEFAULT_END_FIELDS;
    var startValue = firstDateFromFields(item, starts);
    var endValue = firstDateFromFields(item, ends);
    var startDate = normalizeDate(startValue);
    var finalDate = endOfDay(endValue);

    if (startDate && startDate > now) return false;
    if (finalDate && finalDate < now) return false;
    return true;
  }

  function isExpired(item) {
    var endValue = firstDateFromFields(item, DEFAULT_END_FIELDS);
    var finalDate = endOfDay(endValue);
    return !!finalDate && finalDate < new Date();
  }

  function getDaysRemaining(date) {
    var finalDate = endOfDay(date);
    if (!finalDate) return null;
    var diff = finalDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  window.ADPELDateUtils = {
    normalizeDate: normalizeDate,
    isWithinDateRange: isWithinDateRange,
    isExpired: isExpired,
    getDaysRemaining: getDaysRemaining,
    startFields: DEFAULT_START_FIELDS.slice(),
    endFields: DEFAULT_END_FIELDS.slice()
  };
})();
