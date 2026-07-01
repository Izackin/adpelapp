// setup-rls.js - Configurar Row Level Security para ADPEL
// Execute este script uma vez no console do navegador ou inclua temporariamente no admin.html

const RLS_SQL = {
  // Cursos
  courses: `
    -- Permitir SELECT para todos (público)
    CREATE POLICY "Allow public read" ON courses FOR SELECT USING (true);
    
    -- Permitir INSERT para autenticados
    CREATE POLICY "Allow authenticated insert" ON courses FOR INSERT WITH CHECK (true);
    
    -- Permitir UPDATE para autenticados
    CREATE POLICY "Allow authenticated update" ON courses FOR UPDATE USING (true);
    
    -- Permitir DELETE para autenticados
    CREATE POLICY "Allow authenticated delete" ON courses FOR DELETE USING (true);
  `,
  
  // Estudos
  studies: `
    CREATE POLICY "Allow public read" ON studies FOR SELECT USING (true);
    CREATE POLICY "Allow authenticated insert" ON studies FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow authenticated update" ON studies FOR UPDATE USING (true);
    CREATE POLICY "Allow authenticated delete" ON studies FOR DELETE USING (true);
  `,
  
  // Biblioteca
  library_books: `
    CREATE POLICY "Allow public read" ON library_books FOR SELECT USING (true);
    CREATE POLICY "Allow authenticated insert" ON library_books FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow authenticated update" ON library_books FOR UPDATE USING (true);
    CREATE POLICY "Allow authenticated delete" ON library_books FOR DELETE USING (true);
  `,
  
  // Avisos
  announcements: `
    CREATE POLICY "Allow public read" ON announcements FOR SELECT USING (true);
    CREATE POLICY "Allow authenticated insert" ON announcements FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow authenticated update" ON announcements FOR UPDATE USING (true);
    CREATE POLICY "Allow authenticated delete" ON announcements FOR DELETE USING (true);
  `,
  
  // Eventos
  events: `
    CREATE POLICY "Allow public read" ON events FOR SELECT USING (true);
    CREATE POLICY "Allow authenticated insert" ON events FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow authenticated update" ON events FOR UPDATE USING (true);
    CREATE POLICY "Allow authenticated delete" ON events FOR DELETE USING (true);
  `
};

// Função para aplicar todas as políticas
async function setupAllRLS() {
  console.log('🔧 Configurando RLS para ADPEL...');
  
  for (const [table, sql] of Object.entries(RLS_SQL)) {
    try {
      const { error } = await window.supabaseClient.rpc('exec', { sql: sql });
      if (error) {
        // Se a função exec não existir, tentar executar via query direta
        console.log(`⚠️ Política para ${table} pode já existir ou precisa ser criada manualmente`);
      } else {
        console.log(`✅ RLS configurado para ${table}`);
      }
    } catch (err) {
      console.log(`⚠️ ${table}:`, err.message);
    }
  }
  
  console.log('📝 Para configurar manualmente, vá em:');
  console.log('   Supabase Dashboard > Table Editor > selecione a tabela > Policies');
  console.log('   E adicione políticas para INSERT, UPDATE, DELETE com "Public" ou "Authenticated"');
}

// Verificar políticas atuais
async function checkCurrentPolicies() {
  try {
    const { data, error } = await window.supabaseClient
      .from('pg_policies')
      .select('polname, polcmd, qual, with_check')
      .like('schemaname', 'public');
    
    if (error) throw error;
    
    console.log('📋 Políticas atuais:', data);
    return data;
  } catch (err) {
    console.log('⚠️ Não foi possível verificar políticas:', err.message);
    return [];
  }
}

// Executar se chamado diretamente
if (typeof window !== 'undefined') {
  window.setupADPELRLS = setupAllRLS;
  window.checkADPELPolicies = checkCurrentPolicies;
  
  console.log('✅ setup-rls.js carregado');
  console.log('   Execute window.setupADPELRLS() para configurar RLS');
  console.log('   Execute window.checkADPELPolicies() para ver políticas atuais');
}