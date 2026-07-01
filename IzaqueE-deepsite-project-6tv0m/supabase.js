//===================== ADPEL Supabase Client v2.0.0
//======= Configuracao e funcoes de integracao com o Supabase

(function() {
  const supabaseUrl = 'https://piqlrjzlepcpqootpyvq.supabase.co';
  const supabaseAnonKey = 'sb_publishable_oZROSWxtGyUugvdSgCdj_g_YaspR9nr';
  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  const supabase = supabaseClient;
  
  // Expor globalmente para compatibilidade com outros scripts
  window.supabaseClient = supabaseClient;

// ==========================
// AUTH FUNCTIONS
// ==========================

async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { full_name: fullName }
    }
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ==========================
// PROFILE FUNCTIONS
// ==========================

async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateProfile(updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function isMaster() {
  const profile = await getProfile();
  return profile?.role === 'master';
}

// ==========================
// DATA FETCHING FUNCTIONS
// ==========================

async function fetchHomeData() {
  try {
    const { data, error } = await supabase.from('home_sections').select('*').order('order', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) { return []; }
}

async function fetchAnnouncements() {
  try {
    const { data, error } = await supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar avisos:', e);
    return [];
  }
}

async function fetchEvents() {
  try {
    const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar eventos:', e);
    return [];
  }
}

async function fetchCourses() {
  try {
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar cursos:', e);
    return [];
  }
}

async function fetchFeaturedCourses() {
  try {
    const { data, error } = await supabase.from('courses').select('*').eq('is_published', true).eq('is_featured', true).limit(4).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar cursos em destaque:', e);
    return [];
  }
}

async function fetchStudies() {
  try {
    const { data, error } = await supabase.from('studies').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar estudos:', e);
    return [];
  }
}

async function fetchFeaturedStudies() {
  try {
    const { data, error } = await supabase.from('studies').select('*').eq('is_published', true).eq('is_featured', true).limit(3).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar estudos em destaque:', e);
    return [];
  }
}

async function fetchLibrary() {
  try {
    const { data, error } = await supabase.from('library_books').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar biblioteca:', e);
    return [];
  }
}

async function fetchFeaturedBooks() {
  try {
    const { data, error } = await supabase.from('library_books').select('*').eq('is_published', true).eq('is_featured', true).limit(4).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar livros em destaque:', e);
    return [];
  }
}

async function fetchCertificates() {
  try {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase.from('certificates').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) { return []; }
}

async function fetchFundraisingGoals() {
  try {
    const { data, error } = await supabase.from('fundraising_goals').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar cofres:', e);
    return [];
  }
}

async function fetchFundraisingStats() {
  try {
    const { data, error } = await supabase.from('fundraising_stats').select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erro ao buscar estatísticas de cofres:', e);
    return [];
  }
}

// ==========================
// LOCAL STORAGE HELPERS
// ==========================

const LOCAL_KEYS = {
  courses: 'adpel_admin_courses',
  studies: 'adpel_admin_studies',
  library: 'adpel_admin_library',
  announcements: 'adpel_admin_announcements',
  events: 'adpel_admin_events'
};

function getLocalData(key) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Erro ao carregar dados do localStorage:', e);
    return [];
  }
}

function saveLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ==========================
// EXPORT TO WINDOW
// ==========================

// Expor helpers de localStorage globalmente para admin.js
  window.getLocalData = getLocalData;
  window.saveLocalData = saveLocalData;

  window.ADPEL = {
    supabase: supabaseClient,
    auth: { signUp, signIn, signOut, getCurrentUser, getSession, onAuthStateChange },
    profile: { getProfile, updateProfile, isMaster },
    fetch: {
      homeData: fetchHomeData,
      announcements: fetchAnnouncements,
      events: fetchEvents,
      courses: fetchCourses,
      featuredCourses: fetchFeaturedCourses,
      studies: fetchStudies,
      featuredStudies: fetchFeaturedStudies,
      library: fetchLibrary,
      featuredBooks: fetchFeaturedBooks,
      certificates: fetchCertificates,
      fundraisingGoals: fetchFundraisingGoals,
      fundraisingStats: fetchFundraisingStats
    },
    local: { get: getLocalData, save: saveLocalData, keys: LOCAL_KEYS }
  };

  // Logs de verificacao temporarios
  console.log('✅ supabase.js: Cliente inicializado');
  console.log('🔍 window.supabaseClient disponivel:', !!window.supabaseClient);
})();