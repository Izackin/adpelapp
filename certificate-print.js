(function() {
  var root = document.getElementById('certificate-print-root');

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return '';
    var dateOnly = String(value).split('T')[0];
    var parts = dateOnly.split('-');
    if (parts.length !== 3) return '';
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function parseData(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }

  function label(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function(letter) { return letter.toUpperCase(); });
  }

  function firstValue(values) {
    for (var i = 0; i < values.length; i++) {
      if (values[i] != null && String(values[i]).trim() !== '') return String(values[i]).trim();
    }
    return '';
  }

  function certificateCode(cert) {
    return firstValue([
      cert.code,
      cert.certificate_code,
      cert.verification_code,
      cert.id
    ]);
  }

  function buildModel(cert, profile) {
    var data = parseData(cert.certificate_data);
    var type = cert.certificate_type || 'curso';
    var church = firstValue([data.church, data.igreja, cert.church_name, 'Igreja ADPEL']);
    var city = firstValue([data.city, data.cidade, '']);
    var pastor = firstValue([data.pastor, data.responsible, data.responsavel, 'Pastor Responsavel']);
    var issuedDate = cert.issued_at || cert.completed_at || cert.created_at;
    var completedDate = cert.completed_at || cert.issued_at || cert.created_at;
    var studentName = firstValue([
      data.student_name,
      data.aluno,
      data.name,
      profile && (profile.full_name || profile.name),
      cert.recipient_name
    ]);
    var personName = firstValue([
      data.name,
      data.full_name,
      data.child_name,
      data.student_name,
      profile && (profile.full_name || profile.name),
      cert.recipient_name
    ]);

    if (type === 'curso') {
      var courseName = firstValue([
        data.course_title,
        data.course_name,
        data.curso,
        data.description_extra,
        cert.course_title,
        cert.title
      ]);
      return {
        type: type,
        title: 'Certificado de Conclusao',
        recipient: studentName || personName || cert.title || 'Aluno',
        body: 'Certificamos que concluiu com aproveitamento o curso ' + (courseName ? '"' + courseName + '"' : 'registrado nesta plataforma') + ', cumprindo as atividades propostas.',
        details: [
          courseName ? 'Curso: ' + courseName : '',
          cert.description ? 'Descricao: ' + cert.description : '',
          completedDate ? 'Conclusao: ' + formatDate(completedDate) : ''
        ],
        church: church,
        city: city,
        pastor: pastor,
        issuedDate: issuedDate,
        code: certificateCode(cert)
      };
    }

    if (type === 'batismo') {
      return {
        type: type,
        title: 'Certificado de Batismo',
        recipient: personName || cert.title || 'Membro',
        body: 'Certificamos que recebeu o batismo nas aguas, em testemunho publico de sua fe em Jesus Cristo e compromisso com a vida crista.',
        details: [
          data.age ? 'Idade: ' + data.age : '',
          data.birth_date ? 'Nascimento: ' + formatDate(data.birth_date) : '',
          data.baptism_date ? 'Batismo: ' + formatDate(data.baptism_date) : '',
          data.place ? 'Local: ' + data.place : '',
          data.verse ? 'Versiculo: ' + data.verse : ''
        ],
        church: church,
        city: city,
        pastor: pastor,
        issuedDate: issuedDate,
        code: certificateCode(cert)
      };
    }

    if (type === 'apresentacao_bebe') {
      return {
        type: type,
        title: 'Certificado de Apresentacao',
        recipient: personName || cert.title || 'Crianca',
        body: 'Certificamos que esta crianca foi apresentada ao Senhor em ato de fe, gratidao e compromisso familiar diante da igreja.',
        details: [
          data.birth_date ? 'Nascimento: ' + formatDate(data.birth_date) : '',
          data.father_name ? 'Pai: ' + data.father_name : '',
          data.mother_name ? 'Mae: ' + data.mother_name : '',
          data.presentation_date ? 'Apresentacao: ' + formatDate(data.presentation_date) : '',
          data.verse ? 'Versiculo: ' + data.verse : ''
        ],
        church: church,
        city: city,
        pastor: pastor,
        issuedDate: issuedDate,
        code: certificateCode(cert)
      };
    }

    if (type === 'membro') {
      return {
        type: type,
        title: 'Certificado de Membro',
        recipient: personName || cert.title || 'Membro',
        body: 'Certificamos que faz parte da membresia desta igreja, participando da comunhao e da caminhada crista desta comunidade de fe.',
        details: [
          completedDate ? 'Data: ' + formatDate(completedDate) : '',
          data.description_extra ? 'Observacao: ' + data.description_extra : ''
        ],
        church: church,
        city: city,
        pastor: pastor,
        issuedDate: issuedDate,
        code: certificateCode(cert)
      };
    }

    return {
      type: type,
      title: type === 'participacao' ? 'Certificado de Participacao' : 'Certificado',
      recipient: personName || cert.title || 'Participante',
      body: 'Certificamos a participacao nas atividades registradas por esta igreja, reconhecendo sua presenca e envolvimento.',
      details: [
        completedDate ? 'Data: ' + formatDate(completedDate) : '',
        cert.description || data.description_extra || ''
      ],
      church: church,
      city: city,
      pastor: pastor,
      issuedDate: issuedDate,
      code: certificateCode(cert)
    };
  }

  function detailHtml(details) {
    var html = '';
    for (var i = 0; i < details.length; i++) {
      if (!details[i]) continue;
      html += '<span class="cert-detail">' + escapeHtml(details[i]) + '</span>';
    }
    return html;
  }

  function renderCertificate(cert, profile) {
    var model = buildModel(cert, profile);
    var dateText = model.city ? model.city + ', ' : '';
    dateText += model.issuedDate ? formatDate(model.issuedDate) : formatDate(new Date().toISOString());
    root.className = 'certificate-sheet';
    root.innerHTML =
      '<div class="certificate-border">' +
        '<div class="cert-header">' +
          '<img class="cert-logo" src="images/adpel.logo.png" alt="Logo ADPEL">' +
          '<div><div class="church-name">' + escapeHtml(model.church) + '</div>' +
          '<div class="church-subtitle">ADPEL Digital</div></div>' +
        '</div>' +
        '<div class="cert-kicker">Documento Oficial</div>' +
        '<div class="cert-title">' + escapeHtml(model.title) + '</div>' +
        '<div class="cert-body">' +
          '<p>Conferimos o presente certificado a</p>' +
          '<div class="recipient-name">' + escapeHtml(model.recipient) + '</div>' +
          '<p>' + escapeHtml(model.body) + '</p>' +
          '<div class="cert-details">' + detailHtml(model.details) + '</div>' +
        '</div>' +
        '<div class="cert-footer">' +
          '<div class="date-line">' + escapeHtml(dateText) + '</div>' +
          '<div class="signature-block"><div class="signature-line">' + escapeHtml(model.pastor) + '</div><span>Pastor / Responsavel</span></div>' +
        '</div>' +
        '<div class="cert-code">Codigo: ' + escapeHtml(model.code || 'Nao informado') + '</div>' +
      '</div>';
  }

  function renderStatus(title, message) {
    root.className = 'status-card';
    root.innerHTML = '<h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p>';
  }

  async function loadCertificate() {
    var id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      renderStatus('Certificado nao informado', 'Abra esta pagina a partir do botao Visualizar/Imprimir no admin.');
      return;
    }
    if (!window.supabaseClient) {
      renderStatus('Supabase indisponivel', 'Nao foi possivel inicializar a conexao com o banco.');
      return;
    }

    try {
      var result = await window.supabaseClient.from('certificates').select('*').eq('id', id).single();
      if (result.error || !result.data) {
        renderStatus('Certificado nao encontrado', 'Verifique se o certificado ainda existe no banco de dados.');
        return;
      }

      var cert = result.data;
      var profile = null;
      if (cert.user_id) {
        var profileResult = await window.supabaseClient.from('profiles').select('full_name, name, email').eq('id', cert.user_id).single();
        if (!profileResult.error) profile = profileResult.data;
      }
      renderCertificate(cert, profile);
    } catch (error) {
      renderStatus('Erro ao carregar certificado', error.message || 'Tente novamente em alguns instantes.');
    }
  }

  document.addEventListener('DOMContentLoaded', loadCertificate);
})();
