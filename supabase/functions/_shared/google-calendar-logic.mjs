function dateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const values = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`
  };
}

export function validTimeZone(candidate, fallback = 'UTC') {
  const value = candidate || fallback || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value;
  } catch (_) {
    return fallback || 'UTC';
  }
}

export function previousIsoDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function mapGoogleEvent(item, calendarId, calendarTimeZone) {
  if (!item || !item.id) return null;
  if (item.status === 'cancelled') {
    return { external_event_id: item.id, cancelled: true };
  }

  const start = item.start || {};
  const end = item.end || {};
  if (!start.date && !start.dateTime) return null;

  let eventDate;
  let eventTime = null;
  let endDate = null;
  let endTime = null;

  if (start.date) {
    eventDate = start.date;
    endDate = end.date ? previousIsoDate(end.date) : start.date;
    if (!endDate || endDate < eventDate) endDate = eventDate;
  } else {
    const timeZone = validTimeZone(start.timeZone || end.timeZone || calendarTimeZone, 'UTC');
    const startDate = new Date(start.dateTime);
    const finalDate = new Date(end.dateTime || start.dateTime);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(finalDate.getTime())) return null;
    const mappedStart = dateParts(startDate, timeZone);
    const mappedEnd = dateParts(finalDate, timeZone);
    eventDate = mappedStart.date;
    eventTime = mappedStart.time;
    endDate = mappedEnd.date;
    endTime = mappedEnd.time;
  }

  return {
    title: String(item.summary || 'Evento do Google Calendar').slice(0, 500),
    description: item.description ? String(item.description).slice(0, 10000) : null,
    location: item.location ? String(item.location).slice(0, 1000) : null,
    event_date: eventDate,
    event_time: eventTime,
    end_date: endDate,
    end_time: endTime,
    source: 'google',
    external_event_id: item.id,
    external_calendar_id: calendarId,
    cancelled: false
  };
}

export function publicIntegration(integration) {
  if (!integration) return null;
  return {
    id: integration.id,
    provider: integration.provider,
    calendar_id: integration.calendar_id,
    calendar_name: integration.calendar_name,
    calendar_timezone: integration.calendar_timezone,
    status: integration.status,
    last_synced_at: integration.last_synced_at,
    last_error: integration.last_error,
    watch_expires_at: integration.watch_expires_at,
    updated_at: integration.updated_at
  };
}
