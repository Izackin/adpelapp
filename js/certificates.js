async function loadCertificatesData() {
  try {
    const userInfo = getCurrentUserInfo();
    if (!userInfo.isLoggedIn) { renderCertificatesList([]); return; }
    const certificates = await ADPEL.fetch.certificates();
    renderCertificatesList(certificates || []);
  } catch (e) {
    console.error(e);
    renderCertificatesList([]);
  }
}

function renderCertificatesList(certificates) {
  const container = document.getElementById('certificates-list');
  if (!container) return;
  const isLoggedIn = getCurrentUserInfo().isLoggedIn;

  if (!isLoggedIn) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-lock text-2xl text-gray-400"></i>
        </div>
        <h3 class="font-semibold text-gray-800 mb-2">Área Exclusiva para Membros</h3>
        <p class="text-gray-500 text-sm mb-6">Faça login para visualizar seus certificados.</p>
        <button onclick="openModal('login-modal')" class="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Entrar na Plataforma</button>
      </div>`;
    return;
  }

  if (!certificates || certificates.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <i class="fas fa-certificate text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500 font-medium">Voce ainda nao possui certificados.</p>
        <p class="text-sm text-gray-400 mt-2">Ao finalizar seus cursos, eles aparecerao aqui.</p>
      </div>`;
    return;
  }
  container.innerHTML = certificates.map(cert => {
    const certTitle = escapeHtml(cert.title || 'Certificado');
    const certDesc = escapeHtml(cert.description || 'Certificado de conclusão');
    return `
    <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
          <i class="fas fa-certificate text-2xl text-yellow-600"></i>
        </div>
        <div>
          <h4 class="font-bold text-gray-800">${certTitle}</h4>
          <p class="text-sm text-gray-500 mt-1">${certDesc}</p>
        </div>
      </div>
      <button onclick="viewCertificate('${encodeURIComponent(JSON.stringify(cert))}')" class="mt-4 w-full py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100 transition flex items-center justify-center gap-2">
        <i class="fas fa-eye"></i> Visualizar Certificado
      </button>
    </div>
  `}).join('');
}

function buildCertificateHTML({ userName, certTitle, courseTitle, description, duration, completedDate, logoUrl }) {
  // Fallbacks seguros para evitar undefined/null no certificado
  const safeUserName = userName || 'Estudante';
  const safeCertTitle = certTitle || 'Certificado de Conclusão';
  const safeCourseTitle = courseTitle || 'Curso';
  const safeDescription = description || 'concluiu com êxito o curso de';
  const safeDuration = duration || null;
  const safeCompletedDate = completedDate || new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const safeLogoUrl = logoUrl || '';

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(safeCertTitle)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: 210mm 297mm; margin: 0; }
      body {
        font-family: 'Inter', sans-serif;
        background: #e5e7eb;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 12px;
      }
      .cert-frame {
        background: #fffbeb;
        border: 10px double #d97706;
        padding: 32px 48px;
        width: 210mm;
        height: 297mm;
        max-width: 210mm;
        max-height: 297mm;
        position: relative;
        box-shadow: 0 25px 80px rgba(0,0,0,0.25);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }
      .cert-inner-border {
        position: absolute;
        inset: 8px;
        border: 2px solid #d97706;
        opacity: 0.4;
        pointer-events: none;
      }
      .watermark {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.04;
        pointer-events: none;
      }
      .watermark img { width: 320px; height: auto; }
      .header { text-align: center; position: relative; z-index: 1; }
      .logo { width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; border: 3px solid #d97706; background: white; }
      .logo img { width: 100%; height: 100%; object-fit: cover; }
      .institution { font-size: 0.8rem; letter-spacing: 3px; text-transform: uppercase; color: #92400e; font-weight: 600; margin-bottom: 6px; }
      h1 { font-family: 'Playfair Display', serif; font-size: 2.2rem; color: #1e3a8a; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px; }
      .subtitle { font-family: 'Playfair Display', serif; font-size: 1rem; color: #92400e; font-style: italic; }
      .body { text-align: center; position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; }
      .body p { font-size: 1rem; color: #475569; line-height: 1.7; margin-bottom: 10px; }
      .recipient {
        font-family: 'Playfair Display', serif;
        font-size: 1.9rem;
        color: #1e3a8a;
        font-weight: 700;
        margin: 16px 0;
        display: inline-block;
        border-bottom: 2px solid #d97706;
        padding-bottom: 6px;
      }
      .course-name {
        font-family: 'Playfair Display', serif;
        font-size: 1.3rem;
        color: #b45309;
        font-weight: 700;
        margin: 12px 0;
      }
      .details { font-size: 0.9rem; color: #64748b; margin-top: 12px; }
      .footer {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        position: relative;
        z-index: 1;
        gap: 48px;
        padding-bottom: 8px;
      }
      .signature { text-align: center; min-width: 160px; }
      .signature-line { border-top: 1px solid #1e3a8a; width: 100%; margin: 0 auto 8px; padding-top: 8px; }
      .signature-name { font-weight: 600; color: #1e3a8a; font-size: 0.85rem; }
      .signature-role { font-size: 0.75rem; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
      .seal {
        width: 100px;
        height: 100px;
        border: 3px solid #d97706;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #92400e;
        font-weight: 700;
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        flex-shrink: 0;
        background: rgba(255,251,235,0.8);
        position: relative;
        margin-bottom: 4px;
      }
      .seal::before {
        content: '';
        position: absolute;
        inset: 5px;
        border: 1px solid #d97706;
        border-radius: 50%;
        opacity: 0.5;
      }
      .date { text-align: center; font-size: 0.85rem; color: #64748b; position: relative; z-index: 1; margin-bottom: 8px; }
      @media print {
        body { background: white; padding: 0; margin: 0; }
        .cert-frame { box-shadow: none; border-color: #d97706 !important; width: 210mm !important; height: 297mm !important; max-width: 210mm !important; max-height: 297mm !important; overflow: hidden !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid; break-inside: avoid; }
        .no-print { display: none !important; }
      }
      @media (max-width: 900px) {
        body { padding: 8px; }
        .cert-frame { width: 100%; height: auto; min-height: 297mm; padding: 24px; }
        h1 { font-size: 1.6rem; }
        .recipient { font-size: 1.4rem; }
        .course-name { font-size: 1.1rem; }
        .footer { gap: 24px; flex-wrap: wrap; }
        .seal { width: 85px; height: 85px; }
      }
    </style>
  </head>
  <body>
    <div class="cert-frame">
      <div class="cert-inner-border"></div>
      <div class="watermark">
        <img src="${safeLogoUrl}" alt="">
      </div>
      <div class="header">
        <div class="logo"><img src="${safeLogoUrl}" alt="ADPEL"></div>
        <div class="institution">Assembleia de Deus &mdash; Campo Pedro Ludovico</div>
        <h1>${escapeHtml(safeCertTitle)}</h1>
        <div class="subtitle">ADPEL Digital &mdash; Plataforma de Discipulado</div>
      </div>
      <div class="body">
        <p>Certificamos que</p>
        <div class="recipient">${escapeHtml(safeUserName)}</div>
        <p>${escapeHtml(safeDescription)}</p>
        <div class="course-name">${escapeHtml(safeCourseTitle)}</div>
        <p class="details">Carga horária de ${safeDuration ? safeDuration + ' horas' : 'não especificada'} &bull; Concluído em ${safeCompletedDate}</p>
      </div>
      <div class="date">Goiânia, ${safeCompletedDate}</div>
      <div class="footer">
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-name">Pr. Presidente</div>
          <div class="signature-role">Diretor de Ensino</div>
        </div>
        <div class="seal">
          <span>ADPEL</span>
          <span style="font-size:1rem; color:#d97706; margin:3px 0;">&#10013;</span>
          <span>Digital</span>
        </div>
        <div class="signature">
          <div class="signature-line"></div>
          <div class="signature-name">Secretaria ADPEL</div>
          <div class="signature-role">Validação Digital</div>
        </div>
      </div>
    </div>
    <div class="no-print" style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:12px;">
      <button onclick="window.print()" style="padding:12px 24px; background:#1e3a8a; color:white; border:none; border-radius:10px; cursor:pointer; font-size:0.95rem; font-weight:600; box-shadow:0 4px 15px rgba(30,58,138,0.3);">Imprimir / Salvar PDF</button>
    </div>
  </body>
  </html>`;
}

function openCertificateViewModal() {
  const modal = document.getElementById('certificate-view-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
}

function closeCertificateViewModal() {
  const modal = document.getElementById('certificate-view-modal');
  const iframe = document.getElementById('certificate-iframe');
  if (iframe) iframe.srcdoc = '';
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
}

function printCurrentCertificate() {
  const iframe = document.getElementById('certificate-iframe');
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.print();
  }
}

async function viewCertificate(encodedCert) {
  let cert;
  try {
    cert = JSON.parse(decodeURIComponent(encodedCert));
  } catch (e) {
    console.error('Erro ao visualizar certificado:', e);
    return;
  }

  const userInfo = getCurrentUserInfo();
  const userName = cert.certificate_data?.user_name || userInfo.profile?.full_name || userInfo.user?.email || 'Estudante';
  const certTitle = cert.title || 'Certificado de Conclusão';
  const courseTitle = cert.certificate_data?.course_title || cert.title || 'Curso';
  const description = cert.certificate_data?.description || cert.description || 'concluiu com êxito o curso de';
  const duration = cert.certificate_data?.course_duration || '';
  const certDateRaw = cert.completed_at || cert.created_at;
  const completedDate = certDateRaw
    ? new Date(certDateRaw).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const logoUrl = 'https://huggingface.co/spaces/IzaqueE/deepsite-project-6tv0m/resolve/main/images/adpel.logo.png';

  const html = buildCertificateHTML({
    userName,
    certTitle,
    courseTitle,
    description,
    duration,
    completedDate,
    logoUrl
  });

  const iframe = document.getElementById('certificate-iframe');
  if (iframe) {
    iframe.srcdoc = html;
  }
  openCertificateViewModal();
}

Object.assign(window, {
  loadCertificatesData,
  renderCertificatesList,
  buildCertificateHTML,
  openCertificateViewModal,
  closeCertificateViewModal,
  printCurrentCertificate,
  viewCertificate
});
