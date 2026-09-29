// Agenda/events module - extracted from script.js without behavior changes.

function buildUnifiedAgenda(events, announcements) {
  const eventItems = (events || []).map(e => ({ ...e, agenda_type: 'event' }));
  const announcementItems = (announcements || []).map(a => {
    const dateSource = a.expiry || a.expires_at || a.created_at || new Date().toISOString();
    return {
      id: 'announcement-' + (a.id || String(a.title || '').replace(/\s+/g, '-')),
      agenda_type: 'announcement',
      title: a.title || 'Aviso',
      description: a.message || a.description || '',
      event_date: String(dateSource).slice(0, 10),
      event_time: '',
      category: a.priority === 'urgent' ? 'aviso_urgente' : 'aviso',
      link: a.link || ''
    };
  });

  return eventItems.concat(announcementItems).sort((a, b) => {
    const aDate = String(a.event_date || '').slice(0, 10);
    const bDate = String(b.event_date || '').slice(0, 10);
    return aDate.localeCompare(bDate);
  });
}

function isHomeEventVisible(event) {
  if (!window.ADPELDateUtils || typeof window.ADPELDateUtils.isWithinDateRange !== 'function') {
    return true;
  }

  return window.ADPELDateUtils.isWithinDateRange(
    event,
    window.ADPELDateUtils.startFields,
    window.ADPELDateUtils.endFields.concat(['event_date'])
  );
}

async function fetchAllAttendances() {
  try {
    const { data, error } = await window.supabaseClient.from('event_attendances').select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar presenças:', e);
    return [];
  }
}

async function fetchAttendancesForEvents(events) {
  const eventIds = (events || [])
    .filter(event => event && event.agenda_type !== 'announcement' && event.id)
    .map(event => event.id);

  if (!eventIds.length) return [];

  try {
    const { data, error } = await window.supabaseClient
      .from('event_attendances')
      .select('*')
      .in('event_id', eventIds);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('Nao foi possivel buscar presencas por evento. Usando fallback geral:', e);
    return fetchAllAttendances();
  }
}

async function confirmAttendance(eventId) {
  const userInfo = getCurrentUserInfo();
  if (!userInfo.isLoggedIn) {
    showToast('Faça login para confirmar presença.', 'warning');
    openModal('login-modal');
    return;
  }
  
  const name = userInfo.profile?.full_name || userInfo.user?.email || 'Membro';
  
  try {
    // Verifica se já existe presença do usuário neste evento
    const { data: existing, error: fetchError } = await window.supabaseClient
      .from('event_attendances')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userInfo.user.id)
      .maybeSingle();
      
    if (fetchError) throw fetchError;
    
    if (existing) {
      // Desmarcar presença
      const { error: delError } = await window.supabaseClient
        .from('event_attendances')
        .delete()
        .eq('id', existing.id);
      if (delError) throw delError;
      showToast('Presença cancelada.', 'info');
    } else {
      // Marcar presença
      const { error } = await window.supabaseClient
        .from('event_attendances')
        .insert([{ event_id: eventId, user_id: userInfo.user.id, user_name: name }]);
      if (error) throw error;
      showToast('Estamos te aguardando!', 'success');
    }
    
    await renderEventAttendees(eventId);
  } catch (e) {
    console.error('Erro ao confirmar presença:', e);
    showToast('Erro ao atualizar presença.', 'error');
  }
}

async function renderEventAttendees(eventId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('event_attendances')
      .select('user_id, user_name')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    const container = document.getElementById(`attendees-${eventId}`);
    const btn = document.getElementById(`attendance-btn-${eventId}`);
    if (!container) return;
    
    const attendees = data || [];
    const userInfo = getCurrentUserInfo();
    const hasConfirmed = userInfo.isLoggedIn && attendees.some(a => a.user_id === userInfo.user?.id);
    
    // Atualiza botão
    if (btn) {
      const isAgendaSheetButton = btn.classList && btn.classList.contains('agenda-attendance-button');
      if (isAgendaSheetButton) {
        btn.className = 'agenda-attendance-button' + (hasConfirmed ? ' is-confirmed' : '');
        btn.innerHTML = hasConfirmed
          ? '<i class="fas fa-check"></i> Presença confirmada'
          : '<i class="fas fa-hand-point-up"></i> Marcar presença';
      } else if (hasConfirmed) {
        btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-bold transition bg-green-100 text-green-700 border border-green-200';
        btn.innerHTML = '<i class="fas fa-check mr-1"></i> Presença Confirmada';
      } else {
        btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-bold transition bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800';
        btn.innerHTML = '<i class="fas fa-hand-point-up mr-1"></i> Marcar Presença';
      }
    }
    
    if (attendees.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    const visible = attendees.slice(0, 3);
    const hidden = attendees.slice(3);
    const hiddenCount = hidden.length;
    const isAgendaSheet = container.classList && container.classList.contains('agenda-v2-attendees');
    const attendeeClass = isAgendaSheet
      ? 'agenda-v2-attendee-chip'
      : 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200';
    const toggleClass = isAgendaSheet
      ? 'agenda-v2-attendee-more'
      : 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition';
    const extraClass = isAgendaSheet
      ? 'hidden agenda-v2-attendee-extra'
      : 'hidden flex flex-wrap gap-1 w-full mt-1';
    
    let html = visible.map(a => 
      `<span class="${attendeeClass}">${escapeHtml(a.user_name || 'Membro')}</span>`
    ).join('');
    
    if (hiddenCount > 0) {
      html += `<button onclick="toggleAttendees('${eventId}')" id="attendees-toggle-${eventId}" data-count="${hiddenCount}" class="${toggleClass}">+${hiddenCount}</button>`;
      html += `<div id="attendees-extra-${eventId}" class="${extraClass}">`;
      html += hidden.map(a => `<span class="${attendeeClass}">${escapeHtml(a.user_name || 'Membro')}</span>`).join('');
      html += `</div>`;
    }
    
    container.innerHTML = html;
  } catch (e) {
    console.error('Erro ao renderizar presenças:', e);
  }
}

function toggleAttendees(eventId) {
  const extra = document.getElementById(`attendees-extra-${eventId}`);
  const btn = document.getElementById(`attendees-toggle-${eventId}`);
  if (!extra || !btn) return;
  const originalCount = btn.getAttribute('data-count');
  if (extra.classList.contains('hidden')) {
    extra.classList.remove('hidden');
    btn.textContent = 'Ver menos';
  } else {
    extra.classList.add('hidden');
    btn.textContent = `+${originalCount}`;
  }
}

Object.assign(window, {
  buildUnifiedAgenda,
  isHomeEventVisible,
  fetchAllAttendances,
  fetchAttendancesForEvents,
  confirmAttendance,
  renderEventAttendees,
  toggleAttendees,
  renderAnnouncements,
  renderEvents,
  renderHomeEvents,
  renderCommunityAgenda,
  setCommunityAgendaMonth,
  showMoreCommunityAgenda,
  openCommunityEventDetails,
  closeCommunityEventDetails
});

function renderAnnouncements(announcements) {
  const container = document.getElementById('news-container');
  if (!container) return;
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;
  
  if (!announcements || announcements.length === 0) {
    container.innerHTML = `
      <div class="min-w-full bg-white rounded-xl p-6 text-center border border-gray-100 snap-start">
        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-bullhorn text-2xl text-blue-500"></i>
        </div>
        <h3 class="font-semibold text-gray-800 mb-2">Nenhum Aviso Pendente</h3>
        <p class="text-gray-500 text-sm">Comunicados importantes aparecerao aqui.</p>
      </div>`;
    container.classList.toggle('blur-overlay', !isLoggedIn);
    return;
  }
  container.innerHTML = announcements.map(a => `
    <div class="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start bg-yellow-50 border border-yellow-200 rounded-xl p-4 ${a.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i class="fas fa-bullhorn text-yellow-600"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-gray-800 truncate">${escapeHtml(a.title)}</h4>
          <p class="text-gray-600 text-sm mt-1 line-clamp-3">${escapeHtml(a.message)}</p>
          ${safeExternalUrl(a.link) ? `<a href="${escapeHtml(safeExternalUrl(a.link))}" target="_blank" rel="noopener noreferrer" class="inline-block mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"><i class="fas fa-external-link-alt mr-1"></i>Saiba mais</a>` : ''}
          ${a.expiry ? `<p class="text-xs text-gray-400 mt-2">Validade: ${formatDate(a.expiry)}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');
  
  if (!isLoggedIn) {
    container.classList.add('blur-overlay');
  } else {
    container.classList.remove('blur-overlay');
  }
}

function renderEvents(events, attendancesByEvent = {}) {
  const container = document.getElementById('events-container');
  if (!container) return;
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;
  
  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="min-w-full bg-white rounded-xl p-6 text-center border border-gray-100 snap-start">
        <div class="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-calendar-alt text-2xl text-purple-500"></i>
        </div>
        <h3 class="font-semibold text-gray-800 mb-2">Agenda Vazia</h3>
        <p class="text-gray-500 text-sm">Eventos programados aparecerao aqui.</p>
      </div>`;
    container.classList.toggle('blur-overlay', !isLoggedIn);
    return;
  }
  
  const categoryColors = {
    culto: 'border-l-blue-500 bg-blue-50',
    estudo: 'border-l-purple-500 bg-purple-50',
    reuniao: 'border-l-gray-500 bg-gray-50',
    evento: 'border-l-gold-500 bg-gold-50'
  };
  
  container.innerHTML = events.map(e => {
    const isAnnouncement = e.agenda_type === 'announcement';
    const dateStr = e.event_date && e.event_date !== 'null' && e.event_date !== 'undefined' ? String(e.event_date) : '';
    const dateParts = dateStr ? dateStr.split('-') : [];
    const day = dateParts[2] || '--';
    const month = dateParts[1] || '';
    const attendees = isAnnouncement ? [] : (attendancesByEvent[e.id] || []);
    const hasConfirmed = isLoggedIn && attendees.some(a => a.user_id === getCurrentUserInfo().user?.id);
    const visibleAttendees = attendees.slice(0, 3);
    const hiddenAttendees = attendees.slice(3);
    const hiddenCount = hiddenAttendees.length;
    
    return `
    <div class="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start bg-white rounded-xl p-4 border border-gray-100 border-l-4 ${categoryColors[e.category] || 'border-l-gray-300'}">
      <div class="flex items-center gap-3">
        <div class="text-center min-w-[50px]">
          <span class="text-2xl font-bold text-gray-800">${escapeHtml(day)}</span>
          <span class="block text-xs text-gray-500 uppercase">${escapeHtml(month ? getMonthName(month) : '')}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-gray-800 truncate">${escapeHtml(e.title || 'Evento')}</h4>
          <p class="text-sm text-gray-500 flex items-center gap-1 mt-1 flex-wrap">
            <i class="fas fa-clock text-xs"></i> ${escapeHtml(e.event_time || '')}
            ${e.location ? `<span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-xs ml-2"></i> ${safeExternalUrl(e.maps_url) ? `<a href="${escapeHtml(safeExternalUrl(e.maps_url))}" target="_blank" rel="noopener noreferrer" class="hover:text-adpel-600 hover:underline">${escapeHtml(e.location)}</a>` : escapeHtml(e.location)}</span>` : ''}
          </p>
        </div>
      </div>
      ${e.description ? `<p class="text-xs text-gray-500 mt-2 line-clamp-2">${escapeHtml(e.description)}</p>` : ''}
      ${safeExternalUrl(e.link) ? `<a href="${escapeHtml(safeExternalUrl(e.link))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-3 text-xs font-bold text-adpel-700 hover:text-adpel-900 hover:underline"><i class="fas fa-arrow-up-right-from-square"></i> Abrir link</a>` : ''}
      <div class="${isAnnouncement ? 'hidden' : ''} mt-3 pt-3 border-t border-gray-100">
        <button id="attendance-btn-${e.id}" onclick="confirmAttendance('${e.id}')" class="w-full py-1.5 px-3 rounded-lg text-xs font-bold transition ${hasConfirmed ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800'}">
          ${hasConfirmed ? '<i class="fas fa-check mr-1"></i> Presença Confirmada' : '<i class="fas fa-hand-point-up mr-1"></i> Marcar Presença'}
        </button>
        <div id="attendees-${e.id}" class="mt-2 flex flex-wrap gap-1 items-center">
          ${visibleAttendees.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('')}
          ${hiddenCount > 0 ? `<button onclick="toggleAttendees('${e.id}')" id="attendees-toggle-${e.id}" data-count="${hiddenCount}" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">+${hiddenCount}</button>` : ''}
          <div id="attendees-extra-${e.id}" class="hidden flex flex-wrap gap-1 w-full mt-1">
            ${hiddenAttendees.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  if (!isLoggedIn) {
    container.classList.add('blur-overlay');
  } else {
    container.classList.remove('blur-overlay');
  }
}

var COMMUNITY_AGENDA_BATCH = 5;
var communityAgendaState = {
  events: [],
  announcements: [],
  attendancesByEvent: {},
  selectedMonth: '',
  visibleCount: COMMUNITY_AGENDA_BATCH
};

function communityAgendaDateValue(item) {
  return String(item && item.event_date || '').slice(0, 10);
}

function communityAgendaMonthKey(item) {
  const value = communityAgendaDateValue(item);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : '';
}

function communityAgendaMonthLabel(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ''))) return '';
  const date = new Date(monthKey + '-01T12:00:00');
  if (Number.isNaN(date.getTime())) return '';
  const text = date.toLocaleDateString('pt-BR', { month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function communityAgendaYearLabel(monthKey) {
  return /^\d{4}-\d{2}$/.test(String(monthKey || '')) ? String(monthKey).slice(0, 4) : '';
}

function communityAgendaCompactLocation(location) {
  const text = String(location || '').trim();
  if (!text) return '';
  const firstSegment = text.split(/\s+-\s+|,/)[0].trim();
  return firstSegment || text;
}

function communityAgendaDayParts(item) {
  const value = communityAgendaDateValue(item);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { day: '--', month: '', weekday: '', longDate: 'Data a confirmar' };
  }
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: '', weekday: '', longDate: 'Data a confirmar' };
  }
  return {
    day: value.slice(8, 10),
    month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
    weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    longDate: date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  };
}

function communityAgendaTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function communityAgendaEventDomId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function communityAgendaHasConfirmed(eventId) {
  const userInfo = getCurrentUserInfo();
  const attendees = communityAgendaState.attendancesByEvent[eventId] || [];
  return !!(userInfo.isLoggedIn && attendees.some(item => item.user_id === userInfo.user?.id));
}

function renderHomeEvents(events, attendancesByEvent = {}) {
  const section = document.getElementById('home-events-section');
  const container = document.getElementById('home-events-container');
  if (!section || !container) return;

  if (!events || events.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  const event = events[0];
  const date = communityAgendaDayParts(event);
  const time = communityAgendaTime(event.event_time);

  container.innerHTML = `
    <button type="button" class="home-next-event-card" onclick="navigateTo('community-hub')" aria-label="Abrir agenda e ver detalhes de ${escapeHtml(event.title || 'evento')}">
      <span class="home-next-event-card__date" aria-hidden="true">
        <strong>${escapeHtml(date.day)}</strong>
        <small>${escapeHtml(date.month || 'EM BREVE')}</small>
      </span>
      <span class="home-next-event-card__content">
        <strong class="home-next-event-card__title">${escapeHtml(event.title || 'Evento')}</strong>
        <span class="home-next-event-card__meta">
          ${time ? `<span><i class="fas fa-clock"></i> ${escapeHtml(time)}</span>` : ''}
          ${event.location ? `<span><i class="fas fa-location-dot"></i> ${escapeHtml(communityAgendaCompactLocation(event.location))}</span>` : ''}
        </span>
      </span>
      <span class="home-next-event-card__arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>
    </button>`;
}

function setCommunityAgendaMonth(monthKey) {
  if (!communityAgendaState.events.some(item => communityAgendaMonthKey(item) === monthKey)) return;
  communityAgendaState.selectedMonth = monthKey;
  communityAgendaState.visibleCount = COMMUNITY_AGENDA_BATCH;
  renderCommunityAgendaView();
}

function showMoreCommunityAgenda() {
  communityAgendaState.visibleCount += COMMUNITY_AGENDA_BATCH;
  renderCommunityAgendaView();
}

function closeCommunityEventDetails() {
  const sheet = document.getElementById('community-event-sheet');
  if (!sheet) return;
  sheet.classList.add('hidden');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = '';
  document.body.classList.remove('agenda-sheet-open');
}

function openCommunityEventDetails(eventId) {
  const event = communityAgendaState.events.find(item => String(item.id) === String(eventId));
  const sheet = document.getElementById('community-event-sheet');
  if (!event || !sheet) return;

  const eventDomId = communityAgendaEventDomId(event.id);
  const date = communityAgendaDayParts(event);
  const time = communityAgendaTime(event.event_time);
  const endTime = communityAgendaTime(event.end_time);
  const attendees = communityAgendaState.attendancesByEvent[event.id] || [];
  const hasConfirmed = communityAgendaHasConfirmed(event.id);
  const mapsUrl = safeExternalUrl(event.maps_url);
  const eventLink = safeExternalUrl(event.link);
  const timeLabel = time
    ? (endTime && endTime !== time ? time + ' – ' + endTime : time)
    : 'Horário a confirmar';

  sheet.innerHTML = `
    <button type="button" class="agenda-v2-sheet__backdrop" onclick="closeCommunityEventDetails()" aria-label="Fechar detalhes"></button>
    <section class="agenda-v2-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="agenda-sheet-title">
      <div class="agenda-v2-sheet__handle" aria-hidden="true"></div>
      <div class="agenda-v2-sheet__header">
        <span class="agenda-v2-sheet__date">
          <strong>${escapeHtml(date.day)}</strong>
          <small>${escapeHtml(date.month)}</small>
        </span>
        <div>
          <p class="agenda-v2-kicker">Agenda ADPEL</p>
          <h3 id="agenda-sheet-title">${escapeHtml(event.title || 'Evento')}</h3>
          <p>${escapeHtml(date.longDate)}</p>
        </div>
        <button type="button" class="agenda-v2-sheet__close" onclick="closeCommunityEventDetails()" aria-label="Fechar"><i class="fas fa-xmark"></i></button>
      </div>

      <div class="agenda-v2-sheet__info">
        <div><i class="fas fa-clock"></i><span><small>Horário</small><strong>${escapeHtml(timeLabel)}</strong></span></div>
        ${event.location ? `<div><i class="fas fa-location-dot"></i><span><small>Local</small><strong>${escapeHtml(event.location)}</strong></span></div>` : ''}
      </div>

      ${event.description ? `<div class="agenda-v2-sheet__description"><p>${escapeHtml(event.description)}</p></div>` : ''}

      ${mapsUrl || eventLink ? `
        <div class="agenda-v2-sheet__links">
          ${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-location-arrow"></i> Abrir localização</a>` : ''}
          ${eventLink ? `<a href="${escapeHtml(eventLink)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> Abrir link</a>` : ''}
        </div>
      ` : ''}

      <div class="agenda-v2-attendance">
        <div class="agenda-v2-attendance__heading">
          <div><span class="agenda-v2-attendance__icon"><i class="fas fa-users"></i></span><span><small>Comunidade</small><strong>${attendees.length ? attendees.length + (attendees.length === 1 ? ' pessoa confirmou' : ' pessoas confirmaram') : 'Seja o primeiro a confirmar'}</strong></span></div>
        </div>
        <button id="attendance-btn-${eventDomId}" type="button" onclick="confirmAttendance('${eventDomId}')" class="agenda-attendance-button${hasConfirmed ? ' is-confirmed' : ''}">
          ${hasConfirmed ? '<i class="fas fa-check"></i> Presença confirmada' : '<i class="fas fa-hand-point-up"></i> Marcar presença'}
        </button>
        <div id="attendees-${eventDomId}" class="agenda-v2-attendees"></div>
      </div>
    </section>`;

  sheet.classList.remove('hidden');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('agenda-sheet-open');
  window.setTimeout(() => renderEventAttendees(eventDomId), 0);
}

function renderCommunityAgendaView() {
  const container = document.getElementById('community-agenda-container');
  if (!container) return;

  const events = communityAgendaState.events;
  const announcements = communityAgendaState.announcements;
  const months = [...new Set(events.map(communityAgendaMonthKey).filter(Boolean))];
  const nextEvent = events[0] || null;

  const announcementsHtml = announcements.length ? `
    <section class="agenda-v2-alerts" aria-label="Avisos importantes">
      <div class="agenda-v2-section-heading">
        <div><span class="agenda-v2-kicker">Fique por dentro</span><h3>Avisos importantes</h3></div>
        <span class="agenda-v2-counter">${announcements.length}</span>
      </div>
      <div class="agenda-v2-alert-strip">
        ${announcements.map(item => `
          <article class="agenda-v2-alert ${item.category === 'aviso_urgente' ? 'is-urgent' : ''}">
            <span class="agenda-v2-alert__icon"><i class="fas fa-bullhorn"></i></span>
            <div>
              <strong>${escapeHtml(item.title || 'Aviso')}</strong>
              ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
              ${safeExternalUrl(item.link) ? `<a href="${escapeHtml(safeExternalUrl(item.link))}" target="_blank" rel="noopener noreferrer">Abrir aviso <i class="fas fa-arrow-up-right-from-square"></i></a>` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    </section>` : '';

  if (!events.length) {
    container.innerHTML = `
      <div class="agenda-v2-shell">
        ${announcementsHtml}
        <div class="agenda-v2-empty">
          <span><i class="fas fa-calendar-check"></i></span>
          <h3>Nenhum evento programado</h3>
          <p>Quando houver novos acontecimentos, eles aparecerão aqui.</p>
        </div>
      </div>`;
    return;
  }

  if (!months.includes(communityAgendaState.selectedMonth)) {
    communityAgendaState.selectedMonth = months[0] || '';
  }

  const selectedMonth = communityAgendaState.selectedMonth;
  const nextEventMonth = nextEvent ? communityAgendaMonthKey(nextEvent) : '';
  const selectedMonthEvents = events.filter(item => communityAgendaMonthKey(item) === selectedMonth);
  const selectedMonthTotal = selectedMonthEvents.length;
  const selectedYear = communityAgendaYearLabel(selectedMonth);
  const selectedEvents = selectedMonthEvents.filter(item => {
    return !(nextEvent && selectedMonth === nextEventMonth && String(item.id) === String(nextEvent.id));
  });
  const visibleEvents = selectedEvents.slice(0, communityAgendaState.visibleCount);
  const remaining = Math.max(0, selectedEvents.length - visibleEvents.length);
  const nextDate = nextEvent ? communityAgendaDayParts(nextEvent) : null;
  const nextTime = nextEvent ? communityAgendaTime(nextEvent.event_time) : '';

  container.innerHTML = `
    <div class="agenda-v2-shell">
      ${announcementsHtml}

      <section class="agenda-v2-next">
        <div class="agenda-v2-next__date" aria-hidden="true">
          <strong>${escapeHtml(nextDate.day)}</strong>
          <small>${escapeHtml(nextDate.month)}</small>
        </div>
        <div class="agenda-v2-next__content">
          <span class="agenda-v2-kicker"><i class="fas fa-star"></i> Próximo evento</span>
          <h3>${escapeHtml(nextEvent.title || 'Evento')}</h3>
          <div class="agenda-v2-next__meta">
            ${nextTime ? `<span><i class="fas fa-clock"></i> ${escapeHtml(nextTime)}</span>` : ''}
            ${nextEvent.location ? `<span><i class="fas fa-location-dot"></i> ${escapeHtml(nextEvent.location)}</span>` : ''}
          </div>
        </div>
        <button type="button" onclick="openCommunityEventDetails('${communityAgendaEventDomId(nextEvent.id)}')" class="agenda-v2-next__action">Ver detalhes <i class="fas fa-arrow-right"></i></button>
      </section>

      <section class="agenda-v2-calendar">
        <div class="agenda-v2-section-heading">
          <div><span class="agenda-v2-kicker">Programação</span><h3>Agenda da igreja</h3></div>
          <span class="agenda-v2-counter agenda-v2-counter--events">${selectedMonthTotal} ${selectedMonthTotal === 1 ? 'evento' : 'eventos'}</span>
        </div>

        <div class="agenda-v2-month-nav">
          <span class="agenda-v2-year">${escapeHtml(selectedYear)}</span>
          <div class="agenda-v2-months" role="tablist" aria-label="Meses da agenda">
            ${months.map(month => `
              <button type="button" role="tab" aria-selected="${month === selectedMonth ? 'true' : 'false'}" class="${month === selectedMonth ? 'is-active' : ''}" onclick="setCommunityAgendaMonth('${month}')">
                ${escapeHtml(communityAgendaMonthLabel(month))}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="agenda-v2-list">
          ${visibleEvents.map(item => {
            const date = communityAgendaDayParts(item);
            const time = communityAgendaTime(item.event_time);
            const confirmedCount = (communityAgendaState.attendancesByEvent[item.id] || []).length;
            return `
              <button type="button" class="agenda-v2-row" onclick="openCommunityEventDetails('${communityAgendaEventDomId(item.id)}')">
                <span class="agenda-v2-row__date"><strong>${escapeHtml(date.day)}</strong><small>${escapeHtml(date.month)}</small></span>
                <span class="agenda-v2-row__main">
                  <strong>${escapeHtml(item.title || 'Evento')}</strong>
                  <span>
                    ${time ? `<em><i class="fas fa-clock"></i> ${escapeHtml(time)}</em>` : ''}
                    ${item.location ? `<em class="agenda-v2-row__location"><i class="fas fa-location-dot"></i> ${escapeHtml(communityAgendaCompactLocation(item.location))}</em>` : ''}
                  </span>
                </span>
                ${confirmedCount ? `<span class="agenda-v2-row__confirmed"><i class="fas fa-user-check"></i> ${confirmedCount}</span>` : ''}
                <span class="agenda-v2-row__chevron"><i class="fas fa-chevron-right"></i></span>
              </button>`;
          }).join('')}
          ${selectedEvents.length === 0 ? `<div class="agenda-v2-month-note"><i class="fas fa-circle-check"></i><span>O próximo evento acima é o único compromisso em ${escapeHtml(communityAgendaMonthLabel(selectedMonth))}.</span></div>` : ''}
        </div>

        ${remaining > 0 ? `
          <button type="button" class="agenda-v2-more" onclick="showMoreCommunityAgenda()">
            Ver mais ${remaining} ${remaining === 1 ? 'evento' : 'eventos'} <i class="fas fa-chevron-down"></i>
          </button>` : ''}
      </section>
    </div>
    <div id="community-event-sheet" class="agenda-v2-sheet hidden" aria-hidden="true"></div>`;
}

function renderCommunityAgenda(events, attendancesByEvent = {}) {
  const container = document.getElementById('community-agenda-container');
  if (!container) return;

  const items = Array.isArray(events) ? events : [];
  communityAgendaState.events = items.filter(item => item && item.agenda_type !== 'announcement');
  communityAgendaState.announcements = items.filter(item => item && item.agenda_type === 'announcement');
  communityAgendaState.attendancesByEvent = attendancesByEvent || {};
  communityAgendaState.visibleCount = COMMUNITY_AGENDA_BATCH;

  const months = [...new Set(communityAgendaState.events.map(communityAgendaMonthKey).filter(Boolean))];
  if (!months.includes(communityAgendaState.selectedMonth)) {
    communityAgendaState.selectedMonth = months[0] || '';
  }

  renderCommunityAgendaView();
}

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') closeCommunityEventDetails();
});
