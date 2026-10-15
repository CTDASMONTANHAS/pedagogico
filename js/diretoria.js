/* Painel da diretoria (somente leitura, senha própria): avaliação dos professores, reuniões e visitas pedagógicas. */
(() => {
  function TITULOS_OK(p) { return ['conferencia', 'anual', 'assiduidade', 'faltas', 'desligados', 'reunioes', 'visitas', 'ocorrencias', 'avaliacao', 'documentos'].includes(p) ? p : 'avaliacao'; }
  const $ = s => document.querySelector(s);
  const CHAVE = 'ped_dir_key';
  const PAGINA = TITULOS_OK(new URLSearchParams(location.search).get('p'));
  // abas do painel, na ordem do menu
  const TITULOS = {
    conferencia: 'Conferência mensal', anual: 'Conferência anual', assiduidade: 'Assiduidade geral', faltas: 'Faltas consecutivas',
    desligados: 'Alunos desligados', reunioes: 'Reuniões pedagógicas', visitas: 'Visitas pedagógicas', ocorrencias: 'Ocorrências',
    avaliacao: 'Avaliação do professor', documentos: 'Relatórios e arquivos',
  };
  const lerChave = () => { try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; } };
  const gravarChave = v => { try { v ? localStorage.setItem(CHAVE, v) : localStorage.removeItem(CHAVE); } catch (e) { /* sem storage */ } };
  const graficos = [];
  const st = { mes: thisMonth(), tipo: 'mensal', area: '' };

  async function chamar(payload) {
    if (API.demo) return Demo.handle(Object.assign({}, payload, { action: payload.action === 'diretoriaFotos' ? 'getFotos' : 'diretoria' }));
    const res = await fetch(window.APP_CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: lerChave() }, payload)) });
    const json = await res.json();
    if (!json.ok) { const e = new Error(json.error || 'Erro ao carregar'); e.auth = json.auth === false; throw e; }
    return json.data;
  }
  // fotos das visitas pela senha da diretoria
  API.getFotos = ids => chamar({ action: 'diretoriaFotos', ids });

  function carregando(on, txt) { $('#loading').classList.toggle('hidden', !on); $('#loadingText').textContent = txt || 'Carregando…'; }
  function abrirModal(titulo, html) { $('#modalTitle').textContent = titulo; $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
  function fecharModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }

  async function entrar(senha) {
    if (senha) gravarChave(senha);
    carregando(true, 'Carregando dados…');
    try {
      const data = await chamar({ action: 'diretoria' });
      SHEETS.forEach(s => { DB[s] = (data && data[s]) || []; });
      $('#dirLogin').classList.add('hidden');
      $('#dirApp').classList.remove('hidden');
      $('#dirSair').classList.remove('hidden');
      $('#dirNav').classList.remove('hidden');
      desenhar();
    } catch (e) {
      gravarChave('');
      $('#dirLogin').classList.remove('hidden');
      $('#dirApp').classList.add('hidden');
      $('#dirErro').textContent = e.auth ? 'Senha incorreta.' : e.message;
    } finally { carregando(false); }
  }

  const kpiD = (rot, val, sub, cor) => `<div class="kpi" ${cor ? `style="border-top-color:${cor}"` : ''}><span>${rot}</span><strong ${cor ? `style="color:${cor}"` : ''}>${val}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const badgeArea = a => `<span class="badge area-${(a || '').toLowerCase()}">${esc(AREAS[a] || a || '')}</span>`;
  const tabsArea = () => `<div class="tabs">${[['', 'Todas']].concat(Object.entries(AREAS)).map(([k, l]) => `<button class="tab ${st.area === k ? 'active' : ''} ${k ? 'tab-' + k.toLowerCase() : ''}" data-area="${k}">${l}</button>`).join('')}</div>`;
  const cabMeses = (ano, mes) => Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`)
    .map(m => `<th><a href="javascript:void 0" data-mes="${m}" class="${m === mes ? 'mes-atual' : ''}">${MESES[+m.slice(5) - 1].slice(0, 3)}</a></th>`).join('');

  function filtros() {
    const mesInp = `<label>Mês de referência<input type="month" class="input" id="dirRef" value="${st.mes}"></label>`;
    if (PAGINA === 'avaliacao') {
      return `<label>Período<select class="input" id="dirTipo">${[['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'], ['anual', 'Anual']].map(([k, l]) => `<option value="${k}" ${k === st.tipo ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${mesInp}<span class="muted small" id="dirPeriodo"></span>`;
    }
    if (PAGINA === 'documentos' || PAGINA === 'faltas') return '';
    if (PAGINA === 'anual') return `<label>Ano de referência<input type="month" class="input" id="dirRef" value="${st.mes}"></label>`;
    return mesInp;
  }

  function desenhar() {
    graficos.splice(0).forEach(c => c.destroy());
    document.title = `${TITULOS[PAGINA]} · Painel da Diretoria`;
    $('#dirSub').textContent = `Instituto Cultural das Montanhas · ${TITULOS[PAGINA]}`;
    $('#dirNav').innerHTML = Object.entries(TITULOS).map(([k, l]) => `<a href="diretoria.html${k === 'avaliacao' ? '' : '?p=' + k}" class="${k === PAGINA ? 'ativo' : ''}">${l}</a>`).join('');
    $('#dirFiltros').classList.toggle('hidden', PAGINA === 'documentos' || PAGINA === 'faltas');
    $('#dirFiltros').innerHTML = filtros();
    ({ avaliacao: telaAvaliacao, reunioes: telaReunioes, visitas: telaVisitas, conferencia: telaConfMensal, anual: telaConfAnual, assiduidade: telaAssiduidade,
      faltas: telaFaltas, desligados: telaDesligados, ocorrencias: telaOcorrencias, documentos: () => { $('#dirRodape').textContent = 'Arquivos da pasta de relatórios da diretoria. Clique para abrir na tela.'; } })[PAGINA]();
    secaoDocs();
  }

  /* ---------- Avaliação dos professores ---------- */
  const corNota = n => n == null ? 'var(--muted)' : n >= 70 ? 'var(--ok)' : n >= 50 ? 'var(--warn)' : 'var(--bad)';
  const barra = (rot, v, inverso, extra) => {
    const val = v == null ? null : inverso ? 100 - v : v;
    const cor = val == null ? 'var(--border)' : val >= 85 ? 'var(--ok)' : val >= 70 ? '#6aa84f' : val >= 50 ? 'var(--warn)' : 'var(--bad)';
    return `<div class="dir-bar"><span>${rot}</span><div class="dir-track"><i style="width:${val ?? 0}%;background:${cor}"></i></div>
      <b>${v == null ? '—' : v + '%'}</b><small>${extra || ''}</small></div>`;
  };
  function telaAvaliacao() {
    const { P, lista } = avaliacaoProfessores(st.tipo, st.mes);
    $('#dirPeriodo').textContent = P.nome;
    const com = lista.filter(x => x.nota != null);
    const media = com.length ? Math.round(com.reduce((s, x) => s + x.nota, 0) / com.length) : null;
    const med = k => { const v = lista.map(x => x[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const meses = Array.from({ length: 6 }, (_, i) => addMonths(st.mes, i - 5));
    const evol = meses.map(m => { const l = avaliacaoProfessores('mensal', m).lista.filter(x => x.nota != null); return l.length ? Math.round(l.reduce((s, x) => s + x.nota, 0) / l.length) : null; });
    $('#dirRodape').textContent = 'Somente leitura. Nota = conferência 35% + frequência das turmas 30% + permanência dos alunos 20% + reuniões mensais 15%.';
    $('#dirView').innerHTML = `
      <div class="kpis">
        ${kpiD('Nota média da equipe', media ?? '—', nivelAval(media)[1], corNota(media))}
        ${kpiD('Professores avaliados', lista.length)}
        ${kpiD('Conferência em dia (média)', med('conf') == null ? '—' : med('conf') + '%')}
        ${kpiD('Frequência média das turmas', med('freq') == null ? '—' : med('freq') + '%')}
        ${kpiD('Bom ou Excelente', com.filter(x => x.nota >= 70).length, 'nota 70 ou mais', 'var(--ok)')}
        ${kpiD('Em atenção', com.filter(x => x.nota < 50).length, 'nota abaixo de 50', com.some(x => x.nota < 50) ? 'var(--bad)' : '')}
      </div>
      <div class="dir-graficos">
        <section class="card"><h3>Nota por professor</h3><div class="dir-canvas" style="height:${Math.max(200, com.length * 34 + 40)}px"><canvas id="gNotas"></canvas></div></section>
        <section class="card"><h3>Evolução da nota média da equipe</h3><div class="dir-canvas" style="height:240px"><canvas id="gEvol"></canvas></div></section>
      </div>
      <h3 class="dir-sub">Professores</h3>
      <div class="dir-profs">${lista.map(x => `
        <article class="card dir-prof">
          <header><div><strong>${esc(x.p.nome)}</strong><small>${x.turmas.map(t => esc(shortName(t.nome))).join(' · ')}</small></div>
            <div class="dir-nota-box" style="border-color:${corNota(x.nota)};color:${corNota(x.nota)}"><b>${x.nota ?? '—'}</b><span>${x.nivel[1]}</span></div></header>
          ${barra('Conferência em dia', x.conf, false, `${x.conferidos}/${x.celulas} itens conferidos`)}
          ${barra('Frequência das turmas', x.freq, false, `${x.aulas} aulas registradas`)}
          ${barra('Evasão', x.evasao, true, `${x.deslig.length} saíram de ${x.ativos + x.deslig.length}`)}
          ${barra('Reuniões mensais', x.reun, false, `${x.reunFeitas}/${x.mesesProf.length} meses`)}
          <footer><span>${x.pendencias.length} pendência(s) na conferência</span><span>${x.alertas.length} aluno(s) em alerta de faltas</span><span>${x.ocorr.length} ocorrência(s)</span></footer>
        </article>`).join('') || '<p class="empty">Nenhum professor com turmas no período.</p>'}</div>`;
    const css = getComputedStyle(document.documentElement);
    const grid = css.getPropertyValue('--border').trim() || '#ddd';
    Chart.defaults.color = css.getPropertyValue('--text').trim() || '#333';
    if (com.length) {
      graficos.push(new Chart($('#gNotas'), {
        type: 'bar', data: { labels: com.map(x => x.p.nome.split(' ').slice(0, 2).join(' ')), datasets: [{ data: com.map(x => x.nota), backgroundColor: com.map(x => x.nota >= 70 ? '#2a8f57' : x.nota >= 50 ? '#e0a526' : '#d0443e'), borderRadius: 4 }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, grid: { color: grid } }, y: { grid: { display: false } } } },
      }));
    }
    graficos.push(new Chart($('#gEvol'), {
      type: 'line', data: { labels: meses.map(fmtMonthShort), datasets: [{ data: evol, borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,.15)', fill: true, tension: 0.25, spanGaps: true, pointRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
  }

  /* ---------- Reuniões pedagógicas ---------- */
  function telaReunioes() {
    const mes = st.mes, ano = mes.slice(0, 4);
    const profs = professores();
    const feitaNo = (p, m) => reunioesDo(p, m).find(r => r.status === 'REALIZADA');
    const feitas = profs.filter(p => feitaNo(p.nome, mes)).length;
    const anoTot = DB.Reunioes.filter(r => r.status === 'REALIZADA' && (r.mes || '').startsWith(ano)).length;
    const gerais = DB.Reunioes.filter(r => r.mes === mes && !r.professor);
    const situacao = (p, m) => {
      const rs = reunioesDo(p, m);
      if (rs.some(r => r.status === 'REALIZADA')) return '<span class="hist-cell st-ok" title="Reunião realizada">✓</span>';
      if (rs.length) return '<span class="hist-cell st-warn" title="Agendada">◷</span>';
      return m > thisMonth() ? '<span class="hist-cell st-future">·</span>' : '<span class="hist-cell st-none" title="Sem reunião">—</span>';
    };
    const botoes = r => `<button class="btn ghost small" data-ata="${r.id}">Ver ata</button>`;
    $('#dirRodape').textContent = 'Somente leitura. Uma reunião mensal com cada professor, com a secretaria e com o responsável pela van; as atas são lavradas pela coordenação pedagógica.';
    $('#dirView').innerHTML = `
      <div class="kpis">
        ${kpiD('Referência', fmtMonth(mes))}
        ${kpiD('Reuniões realizadas no mês', `${feitas}/${profs.length}`, feitas === profs.length && profs.length ? 'todos em dia' : `${profs.length - feitas} pendente(s)`, feitas === profs.length ? 'var(--ok)' : 'var(--warn)')}
        ${kpiD('Pessoas acompanhadas', profs.length, 'professores, secretaria e van')}
        ${kpiD(`Reuniões realizadas em ${ano}`, anoTot)}
      </div>
      <section class="card">
        <div class="card-head"><h3>Reuniões de ${fmtMonth(mes)}</h3><small class="muted">uma reunião por pessoa por mês</small></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Pessoa</th><th>Turmas / função</th><th>Situação</th><th>Ata</th><th></th></tr></thead>
          <tbody>${profs.map(p => {
            const rs = reunioesDo(p.nome, mes); const r = rs.find(x => x.status === 'REALIZADA') || rs[0];
            return `<tr><td><strong>${esc(p.nome)}</strong></td>
              <td><small class="muted">${p.turmas.map(t => esc(shortName(t.nome))).join(' · ') || esc(p.funcao)}</small></td>
              <td>${r ? (r.status === 'REALIZADA' ? `<span class="tag ok">✓ realizada ${fmtDate(r.data)}</span>` : `<span class="tag warn">agendada ${fmtDate(r.data)}</span>`) : '<span class="flag amber">pendente</span>'}</td>
              <td>${r ? `<small>Ata ${esc(r.numero)}${r.assunto ? ' · ' + esc(r.assunto) : ''}</small>` : '—'}</td>
              <td class="row-actions">${r ? botoes(r) : ''}</td></tr>`;
          }).join('')}</tbody></table></div>
        ${gerais.length ? `<h4>Outras reuniões do mês</h4><ul class="list">${gerais.map(r => `<li><span><strong>Ata ${esc(r.numero)}</strong> · ${fmtDate(r.data)} · ${esc(r.assunto || '')}</span><span class="actions">${botoes(r)}</span></li>`).join('')}</ul>` : ''}
      </section>
      <section class="card">
        <h3>Controle de ${ano} <small class="muted">✓ realizada · ◷ agendada · — sem reunião</small></h3>
        <div class="table-wrap"><table class="table hist"><thead><tr><th>Pessoa</th>${cabMeses(ano, mes)}<th>Total</th></tr></thead>
        <tbody>${profs.map(p => `<tr><td>${esc(p.nome)}</td>${Array.from({ length: 12 }, (_, i) => `<td>${situacao(p.nome, `${ano}-${pad(i + 1)}`)}</td>`).join('')}
          <td><strong>${Array.from({ length: 12 }, (_, i) => feitaNo(p.nome, `${ano}-${pad(i + 1)}`)).filter(Boolean).length}</strong></td></tr>`).join('')}</tbody></table></div>
      </section>`;
    graficosReunioes(ano, mes, profs);
  }
  function verAta(r) {
    const a = reuniaoObj(r);
    abrirModal(`Ata ${a.numero || ''}`, `<div class="dir-doc">
      <p><strong>${esc(a.assunto || 'Reunião')}</strong></p>
      <dl><dt>Data</dt><dd>${fmtDataExtenso(a.data)}</dd><dt>Horário / formato</dt><dd>${esc(horarioFormato(a) || '—')}</dd>
        <dt>Local</dt><dd>${esc(a.local || '—')}</dd><dt>Projeto</dt><dd>${esc(a.projeto || '—')}</dd><dt>Redator(a)</dt><dd>${esc(a.redator || '—')}</dd>
        <dt>Situação</dt><dd>${a.status === 'REALIZADA' ? 'Realizada' : 'Agendada / em elaboração'}</dd></dl>
      <h4>Participantes</h4><ul>${a.participantes.map(p => `<li>${esc(p.nome)}${p.funcao ? ' — ' + esc(p.funcao) : ''}</li>`).join('') || '<li>—</li>'}</ul>
      ${a.relato ? `<h4>Relato</h4><p>${esc(a.relato).replace(/\n/g, '<br>')}</p>` : ''}
      ${a.itens.length ? `<h4>Assuntos tratados</h4>${a.itens.map(i => `<p><strong>${esc(i.titulo || '')}</strong><br>${esc(i.texto || '').replace(/\n/g, '<br>')}</p>`).join('')}` : ''}
      ${a.encaminhamentos ? `<h4>Encaminhamentos</h4><p>${esc(a.encaminhamentos).replace(/\n/g, '<br>')}</p>` : ''}</div>`);
  }

  /* ---------- Visitas pedagógicas ---------- */
  function telaVisitas() {
    const mes = st.mes, ano = mes.slice(0, 4);
    const ts = turmasConferencia(st.area, mes);
    const todas = turmasAtivas(st.area);
    const visitadas = ts.filter(t => visitasDe(t.id, mes).length);
    const doMes = DB.Visitas.filter(v => (v.data || '').startsWith(mes) && ts.some(t => t.id === v.turma_id));
    const nFotos = doMes.reduce((s, v) => s + fotosDaVisita(v.id).length, 0);
    const situacao = (t, m) => {
      const n = visitasDe(t.id, m).length;
      if (n) return `<span class="hist-cell st-ok" title="${n} visita(s)">✓${n > 1 ? n : ''}</span>`;
      if (!iniciou(t, m) || m > thisMonth()) return '<span class="hist-cell st-future">·</span>';
      return '<span class="hist-cell st-none" title="Sem visita">—</span>';
    };
    $('#dirRodape').textContent = 'Somente leitura. Relatórios das visitas da coordenação pedagógica às aulas, com aspectos observados e fotos.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD('Referência', fmtMonth(mes))}
        ${kpiD('Turmas visitadas', `${visitadas.length}/${ts.length}`, visitadas.length === ts.length && ts.length ? 'todas visitadas' : `${ts.length - visitadas.length} pendente(s)`, visitadas.length === ts.length ? 'var(--ok)' : 'var(--warn)')}
        ${kpiD('Relatórios no mês', doMes.length)}
        ${kpiD('Fotos registradas', nFotos)}
      </div>
      <section class="card">
        <div class="card-head"><h3>Visitas de ${fmtMonth(mes)}</h3><small class="muted">uma visita por turma por mês</small></div>
        ${ts.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Turma</th><th>Professor(a)</th><th>Situação</th><th>Relatório</th><th>Fotos</th><th></th></tr></thead>
          <tbody>${ts.map(t => {
            const vs = visitasDe(t.id, mes); const fs = vs.flatMap(v => fotosDaVisita(v.id));
            return `<tr><td>${badgeArea(t.area)} <strong>${esc(shortName(t.nome))}</strong></td><td><small class="muted">${esc(t.professor || '—')}</small></td>
              <td>${vs.length ? vs.map(v => `<span class="tag ok">✓ visitada ${fmtDate(v.data)}</span>`).join(' ') : '<span class="flag amber">pendente</span>'}</td>
              <td>${vs.length ? vs.map(v => `<small>Relatório ${esc(v.numero)}${v.observador ? ' · ' + esc(v.observador) : ''}</small>`).join('<br>') : '—'}</td>
              <td>${fs.length ? `<div class="foto-mini">${fs.slice(0, 3).map(f => `<img src="${f.miniatura}" data-foto="${f.id}" title="${esc(f.legenda || '')}">`).join('')}${fs.length > 3 ? `<span>+${fs.length - 3}</span>` : ''}</div>` : '<small class="muted">—</small>'}</td>
              <td class="row-actions">${vs.map(v => `<button class="btn ghost small" data-visita="${v.id}">Ver relatório</button>`).join('')}</td></tr>`;
          }).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma turma ativa neste mês.</p>'}
      </section>
      <section class="card">
        <h3>Controle de ${ano} <small class="muted">✓ visitada · — sem visita · · turma não iniciada</small></h3>
        <div class="table-wrap"><table class="table hist"><thead><tr><th>Turma</th>${cabMeses(ano, mes)}<th>Total</th></tr></thead>
        <tbody>${todas.map(t => `<tr><td>${esc(shortName(t.nome))}</td>${Array.from({ length: 12 }, (_, i) => `<td>${situacao(t, `${ano}-${pad(i + 1)}`)}</td>`).join('')}
          <td><strong>${Array.from({ length: 12 }, (_, i) => visitasDe(t.id, `${ano}-${pad(i + 1)}`).length ? 1 : 0).reduce((a, b) => a + b, 0)}</strong></td></tr>`).join('')}</tbody></table></div>
      </section>`;
    graficosVisitas(ano, mes);
  }
  function verVisita(v) {
    const t = turma(v.turma_id) || {};
    const asp = jsonParse(v.aspectos, {});
    const fs = fotosDaVisita(v.id);
    const cor = { OTIMO: 'var(--ok)', BOM: 'var(--ok)', REGULAR: 'var(--warn)', INSUF: 'var(--bad)', NA: 'var(--muted)' };
    abrirModal(`Relatório de visita ${v.numero || ''}`, `<div class="dir-doc">
      <dl><dt>Turma</dt><dd>${esc(t.nome || '—')}</dd><dt>Data</dt><dd>${fmtDataExtenso(v.data)}${v.hora ? ', às ' + esc(v.hora) : ''}</dd>
        <dt>Professor(a)</dt><dd>${esc(v.professor || t.professor || '—')}</dd><dt>Observador(a)</dt><dd>${esc([v.observador, v.observador_cargo].filter(Boolean).join(' — ') || '—')}</dd>
        <dt>Alunos presentes</dt><dd>${esc(v.alunos_presentes || '—')}</dd></dl>
      <h4>Aspectos observados</h4>
      <table class="table"><tbody>${ASPECTOS_VISITA.map(([k, l]) => `<tr><td>${l}</td><td style="color:${cor[asp[k] || 'NA']};font-weight:700;text-align:right">${NOTAS_VISITA[asp[k] || 'NA']}</td></tr>`).join('')}</tbody></table>
      ${[['Relato da visita', v.relato], ['Pontos positivos', v.pontos_positivos], ['Pontos a melhorar', v.pontos_melhorar], ['Encaminhamentos', v.encaminhamentos]]
        .filter(([, x]) => x).map(([h, x]) => `<h4>${h}</h4><p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('')}
      ${fs.length ? `<h4>Fotos e evidências</h4><div class="dir-fotos">${fs.map(f => `<figure><img src="${f.miniatura}" data-foto="${f.id}"><figcaption>${esc(f.legenda || '')}</figcaption></figure>`).join('')}</div>` : ''}</div>`);
  }
  async function zoomFoto(id) {
    const f = DB.Fotos.find(x => x.id === id); if (!f) return;
    const box = document.createElement('div');
    box.className = 'foto-zoom';
    box.innerHTML = `<figure><img src="${f.miniatura}"><figcaption>${esc(f.legenda || '')}</figcaption></figure>`;
    box.onclick = () => box.remove();
    document.body.appendChild(box);
    try { const m = await Fotos.carregar([id]); if (m[id]) box.querySelector('img').src = m[id]; } catch (e) { /* fica a miniatura */ }
  }

  /* ---------- Gráficos dos painéis de reuniões e visitas ---------- */
  function corGrade() { const css = getComputedStyle(document.documentElement); Chart.defaults.color = css.getPropertyValue('--text').trim() || '#333'; return css.getPropertyValue('--border').trim() || '#ddd'; }
  function inserirGraficos(html) { const k = $('#dirView .kpis'); if (k) k.insertAdjacentHTML('afterend', `<div class="dir-graficos">${html}</div>`); }

  function graficosReunioes(ano, mes, profs) {
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
    const feitas = meses.map(m => m > thisMonth() ? null : profs.filter(p => reunioesDo(p.nome, m).some(r => r.status === 'REALIZADA')).length);
    const esperadas = meses.map(m => m > thisMonth() ? null : profs.length);
    const rsMes = profs.map(p => reunioesDo(p.nome, mes));
    const real = rsMes.filter(rs => rs.some(r => r.status === 'REALIZADA')).length;
    const ag = rsMes.filter(rs => rs.length && !rs.some(r => r.status === 'REALIZADA')).length;
    inserirGraficos(`<section class="card"><h3>Reuniões realizadas por mês — ${ano}</h3><div class="dir-canvas" style="height:250px"><canvas id="gReunAno"></canvas></div></section>
      <section class="card"><h3>Situação em ${fmtMonth(mes)}</h3><div class="dir-canvas" style="height:250px"><canvas id="gReunMes"></canvas></div></section>`);
    const grid = corGrade();
    graficos.push(new Chart($('#gReunAno'), {
      data: { labels: meses.map(fmtMonthShort), datasets: [
        { type: 'bar', label: 'Realizadas', data: feitas, backgroundColor: '#2a8f57', borderRadius: 4 },
        { type: 'line', label: 'Esperadas', data: esperadas, borderColor: '#e0a526', borderDash: [6, 4], pointRadius: 0, spanGaps: false }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
    graficos.push(new Chart($('#gReunMes'), {
      type: 'doughnut', data: { labels: [`Realizadas: ${real}`, `Agendadas: ${ag}`, `Pendentes: ${profs.length - real - ag}`], datasets: [{ data: [real, ag, profs.length - real - ag], backgroundColor: ['#2a8f57', '#e0a526', '#8a8a85'] }] },
      options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right' } } },
    }));
  }

  function graficosVisitas(ano, mes) {
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
    const visit = meses.map(m => m > thisMonth() ? null : turmasConferencia(st.area, m).filter(t => visitasDe(t.id, m).length).length);
    const total = meses.map(m => m > thisMonth() ? null : turmasConferencia(st.area, m).length);
    const vsMes = DB.Visitas.filter(v => (v.data || '').startsWith(mes) && (!st.area || (turma(v.turma_id) || {}).area === st.area));
    const notas = ['OTIMO', 'BOM', 'REGULAR', 'INSUF'];
    const cores = { OTIMO: '#1f7a45', BOM: '#5cb85c', REGULAR: '#e0a526', INSUF: '#d0443e' };
    const conta = ASPECTOS_VISITA.map(([k]) => notas.map(n => vsMes.filter(v => jsonParse(v.aspectos, {})[k] === n).length));
    inserirGraficos(`<section class="card"><h3>Turmas visitadas por mês — ${ano}</h3><div class="dir-canvas" style="height:260px"><canvas id="gVisAno"></canvas></div></section>
      <section class="card"><h3>Aspectos observados em ${fmtMonth(mes)}</h3>${vsMes.length ? `<div class="dir-canvas" style="height:260px"><canvas id="gVisAsp"></canvas></div>` : '<p class="empty">Nenhuma visita neste mês.</p>'}</section>`);
    const grid = corGrade();
    graficos.push(new Chart($('#gVisAno'), {
      data: { labels: meses.map(fmtMonthShort), datasets: [
        { type: 'bar', label: 'Turmas visitadas', data: visit, backgroundColor: '#4a90d9', borderRadius: 4 },
        { type: 'line', label: 'Turmas ativas', data: total, borderColor: '#e0a526', borderDash: [6, 4], pointRadius: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
    if (vsMes.length) {
      graficos.push(new Chart($('#gVisAsp'), {
        type: 'bar', data: { labels: ASPECTOS_VISITA.map(([, l]) => l.split(' (')[0].replace('Aula de acordo com o ', '').replace(/^./, c => c.toUpperCase())),
          datasets: notas.map((n, i) => ({ label: NOTAS_VISITA[n], data: conta.map(c => c[i]), backgroundColor: cores[n] })) },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, ticks: { precision: 0 }, grid: { color: grid } }, y: { stacked: true, grid: { display: false } } } },
      }));
    }
  }

  /* ---------- Relatórios e arquivos (pasta do Drive da diretoria) ---------- */
  let docs = null;
  const RELACIONADOS = {
    avaliacao: ['avalia', 'desempenho'], reunioes: ['reuni', 'ata'], visitas: ['visita'], conferencia: ['conferencia mensal', 'conferencia'],
    anual: ['anual'], assiduidade: ['assiduidade', 'frequencia'], faltas: ['falta'], desligados: ['deslig'], ocorrencias: ['ocorrenc', 'adverten'], documentos: [],
  };
  const ext = n => (String(n).match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  function iconeDoc(f) {
    const t = f.tipo || '', e = ext(f.nome);
    if (t.includes('pdf') || e === 'pdf') return ['PDF', 'pdf'];
    if (t.includes('spreadsheet') || t.includes('excel') || ['xlsx', 'xls', 'csv', 'ods'].includes(e)) return ['PLAN', 'plan'];
    if (t.includes('presentation') || t.includes('powerpoint') || ['pptx', 'ppt'].includes(e)) return ['APRES', 'apres'];
    if (t.includes('document') || t.includes('word') || ['docx', 'doc', 'odt', 'txt'].includes(e)) return ['DOC', 'doc'];
    if (t.startsWith('image/')) return ['IMG', 'img'];
    if (t.startsWith('video/') || t.startsWith('audio/')) return ['MÍDIA', 'midia'];
    return ['ARQ', 'arq'];
  }
  async function obterDocs() {
    if (docs && !API.demo) return docs;
    docs = API.demo ? (window.__dirDemoDocs || { pasta: 'Documentos', arquivos: [] }) : await chamar({ action: 'diretoriaArquivos' });
    return docs;
  }
  const botaoDoc = f => { const [rot, cls] = iconeDoc(f); return `<button class="dir-doc-btn" data-doc="${f.id}" title="${esc(f.nome)}"><span class="dir-doc-ico ${cls}">${rot}</span>
    <span class="dir-doc-nome">${esc(f.nome.replace(/\.[a-z0-9]{2,5}$/i, ''))}</span><small>${fmtDate(f.modificado)}</small></button>`; };
  function listaDocs(arquivos) {
    const grupos = {};
    arquivos.forEach(f => { (grupos[f.pasta || ''] = grupos[f.pasta || ''] || []).push(f); });
    return Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(p => `<div class="dir-docs-grupo">${p ? `<h4>${esc(p)}</h4>` : ''}
      <div class="dir-docs-btns">${grupos[p].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(botaoDoc).join('')}</div></div>`).join('');
  }
  async function secaoDocs() {
    const alvo = PAGINA === 'documentos' ? $('#dirView') : (() => { $('#dirView').insertAdjacentHTML('beforeend', '<section class="card" id="dirDocs"></section>'); return $('#dirDocs'); })();
    alvo.innerHTML = '<p class="muted">Carregando relatórios e arquivos…</p>';
    let d;
    try { d = await obterDocs(); } catch (e) { alvo.innerHTML = `<h3>Relatórios e arquivos</h3><p class="muted">Não foi possível abrir a pasta de documentos: ${esc(e.message)}</p>`; return; }
    const chaves = RELACIONADOS[PAGINA] || [];
    const rel = chaves.length ? d.arquivos.filter(f => chaves.some(k => norm(f.nome + ' ' + f.pasta).includes(k))) : [];
    alvo.innerHTML = `<div class="card-head"><h3>Relatórios e arquivos <span class="count">${d.arquivos.length}</span></h3>
        <input type="search" class="input dir-docs-busca" placeholder="Buscar arquivo…"></div>
      ${rel.length ? `<h4 class="dir-docs-rel">Relacionados a esta página</h4><div class="dir-docs-btns">${rel.map(botaoDoc).join('')}</div><h4 class="dir-docs-rel">Todos os arquivos</h4>` : ''}
      <div class="dir-docs-lista">${d.arquivos.length ? listaDocs(d.arquivos) : '<p class="empty">A pasta está vazia.</p>'}</div>`;
    alvo.querySelector('.dir-docs-busca').addEventListener('input', ev => {
      const q = norm(ev.target.value);
      alvo.querySelector('.dir-docs-lista').innerHTML = listaDocs(d.arquivos.filter(f => !q || norm(f.nome + ' ' + f.pasta).includes(q))) || '<p class="empty">Nenhum arquivo encontrado.</p>';
    });
  }

  // carrega bibliotecas de visualização só quando necessário
  const libs = {};
  const carregarScript = src => libs[src] || (libs[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar o visualizador')); document.head.appendChild(s); }));
  const b64Bytes = b64 => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

  function visor(titulo) {
    let v = $('#dirVisor');
    if (!v) {
      document.body.insertAdjacentHTML('beforeend', `<div id="dirVisor" class="dir-visor"><div class="dir-visor-top"><strong id="dirVisorTit"></strong><button class="btn ghost small" id="dirVisorFechar">Fechar ✕</button></div><div class="dir-visor-corpo" id="dirVisorCorpo"></div></div>`);
      v = $('#dirVisor');
      $('#dirVisorFechar').addEventListener('click', () => { v.classList.remove('aberto'); $('#dirVisorCorpo').innerHTML = ''; });
      v.addEventListener('contextmenu', e => e.preventDefault());
    }
    $('#dirVisorTit').textContent = titulo;
    $('#dirVisorCorpo').innerHTML = '<p class="dir-visor-msg">Abrindo arquivo…</p>';
    v.classList.add('aberto');
    return $('#dirVisorCorpo');
  }

  async function abrirDoc(id) {
    const f = (docs && docs.arquivos.find(x => x.id === id)) || { nome: 'Arquivo', tipo: '' };
    const corpo = visor(f.nome);
    try {
      const d = API.demo ? window.__dirDemoArquivo(id) : await chamar({ action: 'diretoriaArquivo', id });
      const tipo = d.tipo || '', e = ext(d.nome);
      const bytes = b64Bytes(d.base64);
      if (tipo === 'application/pdf') {
        await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        corpo.innerHTML = `<p class="dir-visor-msg">${pdf.numPages} página(s)</p>`;
        const largura = Math.min(corpo.clientWidth - 24, 1000);
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!$('#dirVisor').classList.contains('aberto')) return;
          const pg = await pdf.getPage(i);
          const esc1 = pg.getViewport({ scale: 1 });
          const vp = pg.getViewport({ scale: (largura / esc1.width) * (window.devicePixelRatio || 1) });
          const c = document.createElement('canvas');
          c.width = vp.width; c.height = vp.height; c.style.width = largura + 'px';
          corpo.appendChild(c);
          await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        }
      } else if (tipo.startsWith('image/')) {
        corpo.innerHTML = `<img src="data:${tipo};base64,${d.base64}" alt="">`;
      } else if (tipo.startsWith('video/') || tipo.startsWith('audio/')) {
        const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
        corpo.innerHTML = tipo.startsWith('video/') ? `<video src="${url}" controls controlslist="nodownload noplaybackrate" disablepictureinpicture></video>` : `<audio src="${url}" controls controlslist="nodownload"></audio>`;
      } else if (tipo.includes('wordprocessingml') || e === 'docx') {
        await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        await carregarScript('https://cdn.jsdelivr.net/npm/docx-preview@0.3.2/dist/docx-preview.min.js');
        corpo.innerHTML = '<div class="dir-visor-docx"></div>';
        await docx.renderAsync(bytes, corpo.firstChild, null, { inWrapper: true, ignoreLastRenderedPageBreak: true });
      } else if (tipo.includes('spreadsheetml') || tipo.includes('ms-excel') || ['xlsx', 'xls', 'ods', 'csv'].includes(e)) {
        await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const wb = XLSX.read(bytes, { type: 'array' });
        corpo.innerHTML = wb.SheetNames.map(n => `<h4 class="dir-visor-aba">${esc(n)}</h4><div class="dir-visor-plan">${XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })}</div>`).join('');
      } else if (tipo.startsWith('text/') || ['txt', 'csv', 'json', 'md'].includes(e)) {
        corpo.innerHTML = `<pre class="dir-visor-txt">${esc(new TextDecoder('utf-8').decode(bytes))}</pre>`;
      } else {
        corpo.innerHTML = `<p class="dir-visor-msg">A pré-visualização deste tipo de arquivo (${esc(e || tipo)}) não está disponível no painel.<br>Para visualizar, a coordenação pode salvar o arquivo em PDF na pasta.</p>`;
      }
    } catch (err) {
      corpo.innerHTML = `<p class="dir-visor-msg">Não foi possível abrir o arquivo: ${esc(err.message)}</p>`;
    }
  }

  /* ---------- Conferência mensal dos professores ---------- */
  const chipConf = v => { const s = CONF_STATUS[v || ''] || CONF_STATUS['']; return `<span class="hist-cell ${s.cls}" title="${s.label}">${v === 'EM_DIA' ? '✓' : v === 'PARCIAL' ? '½' : v === 'PENDENTE' ? '✕' : '—'}</span>`; };
  function telaConfMensal() {
    const mes = st.mes;
    const ts = turmasConferencia(st.area, mes);
    const r = resumoConferencia(mes, st.area);
    const linhas = ts.map(t => { const c = conferencia(t.id, mes) || {}; return { t, c, ok: CONF_ITENS.filter(([k]) => c[k] === 'EM_DIA').length }; });
    const contaStatus = s => linhas.reduce((n, l) => n + CONF_ITENS.filter(([k]) => (l.c[k] || '') === s).length, 0);
    $('#dirRodape').textContent = 'Conferência mensal dos 4 itens de cada turma: plano de aula mensal, relatório de aulas, registro de chamada e fechamento mensal.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD('Referência', fmtMonth(mes))}
        ${kpiD('Itens em dia', r.pct == null ? '—' : r.pct + '%', `${r.ok} de ${r.total}`, r.pct >= 85 ? 'var(--ok)' : r.pct >= 60 ? 'var(--warn)' : 'var(--bad)')}
        ${kpiD('Turmas 100% em dia', `${linhas.filter(l => l.ok === 4).length}/${ts.length}`)}
        ${kpiD('Itens pendentes ou parciais', contaStatus('PENDENTE') + contaStatus('PARCIAL'), '', 'var(--warn)')}
      </div>
      <div class="dir-graficos">
        <section class="card"><h3>Situação dos itens</h3><div class="dir-canvas" style="height:240px"><canvas id="gConfSit"></canvas></div></section>
        <section class="card"><h3>Itens em dia por tipo</h3><div class="dir-canvas" style="height:240px"><canvas id="gConfItem"></canvas></div></section>
      </div>
      <section class="card"><div class="card-head"><h3>Conferência de ${fmtMonth(mes)}</h3><small class="muted">✓ em dia · ½ parcial · ✕ pendente · — não conferido</small></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Turma</th><th>Professor(a)</th>${CONF_ITENS.map(([, l]) => `<th class="center">${l}</th>`).join('')}<th>Em dia</th><th>Observações</th></tr></thead>
        <tbody>${linhas.map(l => `<tr><td>${badgeArea(l.t.area)} <strong>${esc(shortName(l.t.nome))}</strong></td><td><small class="muted">${esc(l.t.professor || '—')}</small></td>
          ${CONF_ITENS.map(([k]) => `<td class="center">${chipConf(l.c[k])}</td>`).join('')}<td><strong>${l.ok}/4</strong></td><td><small>${esc(l.c.observacoes || '')}</small></td></tr>`).join('')}</tbody></table></div></section>`;
    const grid = corGrade();
    graficos.push(new Chart($('#gConfSit'), {
      type: 'doughnut', data: { labels: ['Em dia', 'Parcial', 'Pendente', 'Não conferido'].map((l, i) => `${l}: ${[contaStatus('EM_DIA'), contaStatus('PARCIAL'), contaStatus('PENDENTE'), contaStatus('')][i]}`),
        datasets: [{ data: [contaStatus('EM_DIA'), contaStatus('PARCIAL'), contaStatus('PENDENTE'), contaStatus('')], backgroundColor: ['#2a8f57', '#e0a526', '#d0443e', '#8a8a85'] }] },
      options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right' } } },
    }));
    graficos.push(new Chart($('#gConfItem'), {
      type: 'bar', data: { labels: CONF_ITENS.map(([, l]) => l), datasets: [{ data: CONF_ITENS.map(([k]) => pct(linhas.filter(l => l.c[k] === 'EM_DIA').length, linhas.length) || 0), backgroundColor: '#4a90d9', borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: grid } }, y: { grid: { display: false } } } },
    }));
  }

  /* ---------- Conferência anual ---------- */
  function telaConfAnual() {
    const ano = st.mes.slice(0, 4);
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`).filter(m => m <= thisMonth());
    const todas = turmasAtivas(st.area);
    const porMes = meses.map(m => resumoConferencia(m, st.area));
    const ok = porMes.reduce((s, r) => s + r.ok, 0), tot = porMes.reduce((s, r) => s + r.total, 0);
    const celula = (t, m) => {
      if (!iniciou(t, m)) return '<span class="hist-cell st-future">·</span>';
      const c = conferencia(t.id, m) || {};
      const n = CONF_ITENS.filter(([k]) => c[k] === 'EM_DIA').length;
      const algum = CONF_ITENS.some(([k]) => c[k]);
      return `<span class="hist-cell ${!algum ? 'st-none' : n === 4 ? 'st-ok' : n >= 2 ? 'st-warn' : 'st-bad'}" title="${n}/4 itens em dia">${algum ? n + '/4' : '—'}</span>`;
    };
    $('#dirRodape').textContent = 'Quadro do ano: quantos dos 4 itens da conferência estavam em dia em cada turma e mês.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD('Ano', ano)}
        ${kpiD('Itens em dia no ano', tot ? pct(ok, tot) + '%' : '—', `${ok} de ${tot}`)}
        ${kpiD('Melhor mês', porMes.length ? fmtMonth(meses[porMes.reduce((b, r, i) => (r.pct ?? -1) > (porMes[b].pct ?? -1) ? i : b, 0)]) : '—')}
        ${kpiD('Turmas acompanhadas', todas.length)}
      </div>
      <section class="card"><h3>% de itens em dia por mês — ${ano}</h3><div class="dir-canvas" style="height:250px"><canvas id="gConfAno"></canvas></div></section>
      <section class="card"><h3>Quadro anual por turma <small class="muted">itens em dia de 4</small></h3>
        <div class="table-wrap"><table class="table hist"><thead><tr><th>Turma</th>${cabMeses(ano, st.mes)}</tr></thead>
        <tbody>${todas.map(t => `<tr><td>${esc(shortName(t.nome))}</td>${Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`).map(m => `<td>${m > thisMonth() ? '<span class="hist-cell st-future">·</span>' : celula(t, m)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
    const grid = corGrade();
    graficos.push(new Chart($('#gConfAno'), {
      type: 'line', data: { labels: meses.map(fmtMonthShort), datasets: [{ data: porMes.map(r => r.pct), borderColor: '#2a8f57', backgroundColor: 'rgba(42,143,87,.15)', fill: true, tension: 0.25, pointRadius: 4, spanGaps: true }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
  }

  /* ---------- Assiduidade geral ---------- */
  function telaAssiduidade() {
    const mes = st.mes, de = mes + '-01', ate = mes + '-31';
    const ts = turmasAtivas(st.area);
    const linhas = ts.map(t => ({ t, s: statsTurma(t.id, de, ate), ativos: alunosDaTurma(t.id).length })).filter(l => l.s.registros);
    const P = linhas.reduce((n, l) => n + l.s.presencas, 0), R = linhas.reduce((n, l) => n + l.s.registros, 0);
    const meses6 = Array.from({ length: 6 }, (_, i) => addMonths(mes, i - 5));
    const evol = meses6.map(m => { let p = 0, r = 0; ts.forEach(t => { const s = statsTurma(t.id, m + '-01', m + '-31'); p += s.presencas; r += s.registros; }); return pct(p, r); });
    $('#dirRodape').textContent = 'Assiduidade = presenças sobre o total de registros de chamada do período.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD('Referência', fmtMonth(mes))}
        ${kpiD('Frequência geral', R ? pct(P, R) + '%' : '—', `${P} presenças em ${R} registros`, R ? (pct(P, R) >= 75 ? 'var(--ok)' : 'var(--warn)') : '')}
        ${kpiD('Aulas registradas', linhas.reduce((n, l) => n + l.s.aulas, 0), `${linhas.length} turma(s) com chamada`)}
        ${kpiD('Alunos ativos', ts.reduce((n, t) => n + alunosDaTurma(t.id).length, 0))}
      </div>
      <div class="dir-graficos">
        <section class="card"><h3>Frequência por turma</h3><div class="dir-canvas" style="height:${Math.max(220, linhas.length * 26 + 40)}px"><canvas id="gAssTurma"></canvas></div></section>
        <section class="card"><h3>Evolução da frequência geral</h3><div class="dir-canvas" style="height:240px"><canvas id="gAssEvol"></canvas></div></section>
      </div>
      <section class="card"><h3>Turmas — ${fmtMonth(mes)}</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th>Turma</th><th>Professor(a)</th><th>Aulas</th><th>Alunos ativos</th><th>Frequência</th></tr></thead>
        <tbody>${linhas.sort((a, b) => (b.s.pct ?? 0) - (a.s.pct ?? 0)).map(l => `<tr><td>${badgeArea(l.t.area)} <strong>${esc(shortName(l.t.nome))}</strong></td><td><small class="muted">${esc(l.t.professor || '—')}</small></td>
          <td>${l.s.aulas}</td><td>${l.ativos}</td><td>${barra('', l.s.pct)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhuma chamada registrada neste mês.</td></tr>'}</tbody></table></div></section>`;
    const grid = corGrade();
    if (linhas.length) {
      graficos.push(new Chart($('#gAssTurma'), {
        type: 'bar', data: { labels: linhas.map(l => shortName(l.t.nome)), datasets: [{ data: linhas.map(l => l.s.pct), backgroundColor: linhas.map(l => l.s.pct >= 85 ? '#2a8f57' : l.s.pct >= 70 ? '#6aa84f' : l.s.pct >= 50 ? '#e0a526' : '#d0443e'), borderRadius: 4 }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: grid } }, y: { grid: { display: false } } } },
      }));
    }
    graficos.push(new Chart($('#gAssEvol'), {
      type: 'line', data: { labels: meses6.map(fmtMonthShort), datasets: [{ data: evol, borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,.15)', fill: true, tension: 0.25, pointRadius: 4, spanGaps: true }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
  }

  /* ---------- Faltas consecutivas ---------- */
  function telaFaltas() {
    const al = alertasFaltas(st.area);
    const n3 = al.filter(x => x.nivel === 3), n2 = al.filter(x => x.nivel === 2);
    const porTurma = {};
    al.forEach(x => { porTurma[x.turma.id] = (porTurma[x.turma.id] || 0) + 1; });
    const tabela = (lista, titulo, cls) => `<section class="card ${cls}"><h3>${titulo} <span class="count">${lista.length}</span></h3>
      ${lista.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Aluno(a)</th><th>Turma</th><th>Faltas seguidas</th><th>Desde</th><th>Contato da secretaria</th></tr></thead>
      <tbody>${lista.map(x => `<tr><td><strong>${esc(x.aluno.nome)}</strong></td><td>${badgeArea(x.turma.area)} ${esc(shortName(x.turma.nome))}</td>
        <td><span class="flag ${x.nivel === 3 ? 'red' : 'amber'}">${x.stats.seqAtual} faltas</span></td><td>${fmtDate(x.desde)}</td>
        <td>${x.contato ? `<small>${fmtDate(x.contato.data)} · ${esc(x.contato.resultado || x.contato.alerta || 'contato feito')}</small>` : '<small class="muted">sem contato registrado</small>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nenhum aluno nesta situação.</p>'}</section>`;
    $('#dirRodape').textContent = 'Situação atual: 2 faltas seguidas → a secretaria contata o aluno ou a família; 3 ou mais → apto a desligamento.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD('Alunos em alerta', al.length, 'situação de hoje')}
        ${kpiD('3 ou mais faltas seguidas', n3.length, 'aptos a desligamento', n3.length ? 'var(--bad)' : '')}
        ${kpiD('2 faltas seguidas', n2.length, 'contatar a família', n2.length ? 'var(--warn)' : '')}
        ${kpiD('Com contato registrado', al.filter(x => x.contato).length, `de ${al.length}`)}
      </div>
      ${Object.keys(porTurma).length ? `<section class="card"><h3>Alunos em alerta por turma</h3><div class="dir-canvas" style="height:${Object.keys(porTurma).length * 28 + 50}px"><canvas id="gFaltas"></canvas></div></section>` : ''}
      ${tabela(n3, 'Aptos a desligamento — 3 ou mais faltas seguidas', 'alert-red')}
      ${tabela(n2, 'Atenção — 2 faltas seguidas', 'alert-amber')}`;
    if (Object.keys(porTurma).length) {
      const grid = corGrade(), ids = Object.keys(porTurma).sort((a, b) => porTurma[b] - porTurma[a]);
      graficos.push(new Chart($('#gFaltas'), {
        type: 'bar', data: { labels: ids.map(id => shortName(turma(id).nome)), datasets: [
          { label: '3+ faltas', data: ids.map(id => n3.filter(x => x.turma.id === id).length), backgroundColor: '#d0443e' },
          { label: '2 faltas', data: ids.map(id => n2.filter(x => x.turma.id === id).length), backgroundColor: '#e0a526' }] },
        options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, ticks: { precision: 0 }, grid: { color: grid } }, y: { stacked: true, grid: { display: false } } } },
      }));
    }
  }

  /* ---------- Alunos desligados ---------- */
  function telaDesligados() {
    const ano = st.mes.slice(0, 4);
    const lista = alunosDesligados(st.area, ano + '-01-01', ano + '-12-31');
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
    const porTurma = {};
    lista.forEach(x => { porTurma[x.turma.id] = (porTurma[x.turma.id] || 0) + 1; });
    $('#dirRodape').textContent = 'Desligado: aluno que estava na lista de presença e não aparece no relatório seguinte, ou desligado pela coordenação.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD(`Desligados em ${ano}`, lista.length, '', lista.length ? 'var(--bad)' : '')}
        ${kpiD('No mês de referência', lista.filter(x => (x.aluno.data_desligamento || '').startsWith(st.mes)).length, fmtMonth(st.mes))}
        ${kpiD('Nunca compareceram', lista.filter(x => !x.ultimaPresenca).length)}
        ${kpiD('Turmas com desligamentos', Object.keys(porTurma).length)}
      </div>
      <div class="dir-graficos">
        <section class="card"><h3>Desligamentos por mês — ${ano}</h3><div class="dir-canvas" style="height:240px"><canvas id="gDesMes"></canvas></div></section>
        <section class="card"><h3>Desligamentos por turma</h3><div class="dir-canvas" style="height:${Math.max(220, Object.keys(porTurma).length * 26 + 40)}px"><canvas id="gDesTurma"></canvas></div></section>
      </div>
      <section class="card"><h3>Relação de desligados — ${ano}</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th>Aluno(a)</th><th>Turma</th><th>Desligado em</th><th>Motivo</th><th>Última presença</th><th>Presença</th></tr></thead>
        <tbody>${lista.map(x => `<tr><td><strong>${esc(x.aluno.nome)}</strong></td><td>${badgeArea(x.turma.area)} ${esc(shortName(x.turma.nome))}</td><td>${fmtDate(x.aluno.data_desligamento) || '—'}</td>
          <td><small>${esc(x.aluno.motivo_desligamento || '—')}</small></td><td>${x.ultimaPresenca ? fmtDate(x.ultimaPresenca) : '<span class="muted">nunca compareceu</span>'}</td><td>${x.stats.pct == null ? '—' : x.stats.pct + '%'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum desligamento no ano.</td></tr>'}</tbody></table></div></section>`;
    const grid = corGrade(), ids = Object.keys(porTurma).sort((a, b) => porTurma[b] - porTurma[a]);
    graficos.push(new Chart($('#gDesMes'), {
      type: 'bar', data: { labels: meses.map(fmtMonthShort), datasets: [{ data: meses.map(m => m > thisMonth() ? null : lista.filter(x => (x.aluno.data_desligamento || '').startsWith(m)).length), backgroundColor: '#d0443e', borderRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
    graficos.push(new Chart($('#gDesTurma'), {
      type: 'bar', data: { labels: ids.map(id => shortName(turma(id).nome)), datasets: [{ data: ids.map(id => porTurma[id]), backgroundColor: '#8a8a85', borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, y: { grid: { display: false } } } },
    }));
  }

  /* ---------- Ocorrências ---------- */
  const TIPOS_OC = { OCORRENCIA: 'Registro de ocorrência', ADV_VERBAL: 'Advertência verbal', ADV_ESCRITA: 'Advertência escrita', SUSPENSAO: 'Suspensão temporária' };
  const GRAV_OC = { LEVE: 'Leve', MEDIA: 'Média', GRAVE: 'Grave' };
  function telaOcorrencias() {
    const ano = st.mes.slice(0, 4);
    const lista = DB.Ocorrencias.filter(o => (o.data_ocorrencia || '').startsWith(ano) && (!st.area || (turma(o.turma_id) || {}).area === st.area))
      .sort((a, b) => (b.data_ocorrencia || '').localeCompare(a.data_ocorrencia || ''));
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
    const reinc = {};
    lista.forEach(o => { reinc[o.aluno_id] = (reinc[o.aluno_id] || 0) + 1; });
    $('#dirRodape').textContent = 'Registros de ocorrências e advertências disciplinares do ano.';
    $('#dirView').innerHTML = `${tabsArea()}
      <div class="kpis">
        ${kpiD(`Registros em ${ano}`, lista.length)}
        ${kpiD('Advertências', lista.filter(o => o.tipo === 'ADV_VERBAL' || o.tipo === 'ADV_ESCRITA').length)}
        ${kpiD('Suspensões', lista.filter(o => o.tipo === 'SUSPENSAO').length, '', lista.some(o => o.tipo === 'SUSPENSAO') ? 'var(--bad)' : '')}
        ${kpiD('Aguardando ciência do responsável', lista.filter(o => o.status === 'ABERTA').length, '', lista.some(o => o.status === 'ABERTA') ? 'var(--warn)' : '')}
        ${kpiD('Alunos reincidentes', Object.values(reinc).filter(n => n > 1).length, '2 ou mais registros')}
      </div>
      ${lista.length ? `<div class="dir-graficos">
        <section class="card"><h3>Registros por mês — ${ano}</h3><div class="dir-canvas" style="height:240px"><canvas id="gOcMes"></canvas></div></section>
        <section class="card"><h3>Por tipo</h3><div class="dir-canvas" style="height:240px"><canvas id="gOcTipo"></canvas></div></section></div>` : ''}
      <section class="card"><h3>Registros de ${ano}</h3>
        ${lista.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Nº</th><th>Data</th><th>Aluno(a)</th><th>Turma</th><th>Tipo</th><th>Gravidade</th><th>Situação</th><th></th></tr></thead>
        <tbody>${lista.map(o => { const t = turma(o.turma_id) || {}; return `<tr><td><strong>${esc(o.numero || '')}</strong></td><td>${fmtDate(o.data_ocorrencia)}</td>
          <td>${esc(o.aluno_nome || '')}${reinc[o.aluno_id] > 1 ? ` <span class="flag red">${reinc[o.aluno_id]}×</span>` : ''}</td><td>${t.area ? badgeArea(t.area) : ''} ${esc(shortName(t.nome || ''))}</td>
          <td>${esc(TIPOS_OC[o.tipo] || '')}</td><td>${esc(GRAV_OC[o.gravidade] || '')}</td>
          <td>${o.status === 'ABERTA' ? '<span class="flag amber">aguardando ciência</span>' : `<span class="tag ok">${o.status === 'CIENTE' ? 'responsável ciente' : 'encerrada'}</span>`}</td>
          <td><button class="btn ghost small" data-ocor="${o.id}">Ver</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma ocorrência registrada no ano.</p>'}</section>`;
    if (!lista.length) return;
    const grid = corGrade();
    graficos.push(new Chart($('#gOcMes'), {
      type: 'bar', data: { labels: meses.map(fmtMonthShort), datasets: [{ data: meses.map(m => m > thisMonth() ? null : lista.filter(o => (o.data_ocorrencia || '').startsWith(m)).length), backgroundColor: '#e0a526', borderRadius: 4 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid } }, x: { grid: { display: false } } } },
    }));
    const tipos = Object.keys(TIPOS_OC).filter(k => lista.some(o => o.tipo === k));
    graficos.push(new Chart($('#gOcTipo'), {
      type: 'doughnut', data: { labels: tipos.map(k => `${TIPOS_OC[k]}: ${lista.filter(o => o.tipo === k).length}`), datasets: [{ data: tipos.map(k => lista.filter(o => o.tipo === k).length), backgroundColor: ['#8a8a85', '#e0a526', '#d0443e', '#7a1f1a'] }] },
      options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right' } } },
    }));
  }
  function verOcorrencia(o) {
    const t = turma(o.turma_id) || {};
    abrirModal(`Ocorrência ${o.numero || ''}`, `<div class="dir-doc"><dl>
      <dt>Aluno(a)</dt><dd>${esc(o.aluno_nome || '—')}</dd><dt>Turma</dt><dd>${esc(t.nome || '—')}</dd>
      <dt>Data</dt><dd>${fmtDataExtenso(o.data_ocorrencia)}</dd><dt>Local</dt><dd>${esc(o.local || '—')}</dd>
      <dt>Tipo</dt><dd>${esc(TIPOS_OC[o.tipo] || '—')}</dd><dt>Gravidade</dt><dd>${esc(GRAV_OC[o.gravidade] || '—')}</dd>
      <dt>Presenciado por</dt><dd>${esc([o.testemunha_nome, o.testemunha_funcao].filter(Boolean).join(' — ') || '—')}</dd>
      <dt>Situação</dt><dd>${o.status === 'ABERTA' ? 'Aguardando ciência do responsável' : o.status === 'CIENTE' ? 'Responsável ciente (termo assinado)' : 'Encerrada'}</dd></dl>
      ${o.descricao ? `<h4>Relato dos fatos</h4><p>${esc(o.descricao).replace(/\n/g, '<br>')}</p>` : ''}
      ${o.providencias ? `<h4>Providências adotadas</h4><p>${esc(o.providencias).replace(/\n/g, '<br>')}</p>` : ''}</div>`);
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-area],[data-mes],[data-ata],[data-visita],[data-foto],[data-doc],[data-ocor]');
    if (!el) return;
    const d = el.dataset;
    if (d.area !== undefined) { st.area = d.area; desenhar(); }
    else if (d.mes) { st.mes = d.mes; desenhar(); window.scrollTo(0, 0); }
    else if (d.ata) verAta(DB.Reunioes.find(r => r.id === d.ata));
    else if (d.visita) verVisita(DB.Visitas.find(v => v.id === d.visita));
    else if (d.foto) zoomFoto(d.foto);
    else if (d.doc) abrirDoc(d.doc);
    else if (d.ocor) verOcorrencia(DB.Ocorrencias.find(o => o.id === d.ocor));
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'dirRef') { st.mes = e.target.value || thisMonth(); desenhar(); }
    if (e.target.id === 'dirTipo') { st.tipo = e.target.value; desenhar(); }
  });
  $('#modalClose').addEventListener('click', fecharModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') fecharModal(); });
  $('#dirForm').addEventListener('submit', e => { e.preventDefault(); $('#dirErro').textContent = ''; entrar($('#dirSenha').value); });
  $('#dirSair').addEventListener('click', () => { gravarChave(''); location.reload(); });
  if (lerChave() || API.demo) entrar(); else $('#dirLogin').classList.remove('hidden');
})();
