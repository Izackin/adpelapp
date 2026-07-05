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
      if (hasConfirmed) {
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
    
    let html = visible.map(a => 
      `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`
    ).join('');
    
    if (hiddenCount > 0) {
      html += `<button onclick="toggleAttendees('${eventId}')" id="attendees-toggle-${eventId}" data-count="${hiddenCount}" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition">+${hiddenCount}</button>`;
      html += `<div id="attendees-extra-${eventId}" class="hidden flex flex-wrap gap-1 w-full mt-1">`;
      html += hidden.map(a => `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">${escapeHtml(a.user_name || 'Membro')}</span>`).join('');
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
  renderHomeEvents
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
          ${a.link ? `<a href="${escapeHtml(a.link)}" target="_blank" class="inline-block mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"><i class="fas fa-external-link-alt mr-1"></i>Saiba mais</a>` : ''}
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
            ${e.location ? `<span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-xs ml-2"></i> ${e.maps_url ? `<a href="${escapeHtml(e.maps_url)}" target="_blank" class="hover:text-adpel-600 hover:underline">${escapeHtml(e.location)}</a>` : escapeHtml(e.location)}</span>` : ''}
          </p>
        </div>
      </div>
      ${e.description ? `<p class="text-xs text-gray-500 mt-2 line-clamp-2">${escapeHtml(e.description)}</p>` : ''}
      ${e.link ? `<a href="${escapeHtml(e.link)}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-xs font-bold text-adpel-700 hover:text-adpel-900 hover:underline"><i class="fas fa-arrow-up-right-from-square"></i> Abrir link</a>` : ''}
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

function renderHomeEvents(events, attendancesByEvent = {}) {
  const section = document.getElementById('home-events-section');
  const container = document.getElementById('home-events-container');
  if (!section || !container) return;

  if (!events || events.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  const sectionTitle = section.querySelector('h2');
  if (sectionTitle) sectionTitle.textContent = 'Agenda';
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;

  const categoryColors = {
    culto: 'border-l-blue-500 bg-blue-50',
    estudo: 'border-l-purple-500 bg-purple-50',
    reuniao: 'border-l-gray-500 bg-gray-50',
    evento: 'border-l-gold-500 bg-gold-50',
    aviso: 'border-l-amber-500 bg-amber-50',
    aviso_urgente: 'border-l-red-500 bg-red-50'
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
            ${e.location ? `<span class="flex items-center gap-1"><i class="fas fa-map-marker-alt text-xs ml-2"></i> ${e.maps_url ? `<a href="${escapeHtml(e.maps_url)}" target="_blank" class="hover:text-adpel-600 hover:underline">${escapeHtml(e.location)}</a>` : escapeHtml(e.location)}</span>` : ''}
          </p>
        </div>
      </div>
      ${e.description ? `<p class="text-xs text-gray-500 mt-2 line-clamp-2">${escapeHtml(e.description)}</p>` : ''}
      ${e.link ? `<a href="${escapeHtml(e.link)}" target="_blank" class="inline-flex items-center gap-1 mt-3 text-xs font-bold text-adpel-700 hover:text-adpel-900 hover:underline"><i class="fas fa-arrow-up-right-from-square"></i> Abrir link</a>` : ''}
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
}
