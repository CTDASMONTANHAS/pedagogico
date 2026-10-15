/* Painel da diretoria (somente leitura, senha própria): avaliação dos professores, reuniões e visitas pedagógicas. */
(() => {
  const $ = s => document.querySelector(s);
  const CHAVE = 'ped_dir_key';
  const PAGINA = new URLSearchParams(location.search).get('p') || 'avaliacao';
  const TITULOS = { avaliacao: 'Avaliação dos professores', reunioes: 'Reuniões pedagógicas', visitas: 'Visitas pedagógicas' };
  const lerChave = () => { try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; } };
  const gravarChave = v => { try { v ? localStorage.setItem(CHAVE, v) : localStorage.removeItem(CHAVE); } catch (e) { /* sem storage */ } };
  const graficos = [];
  const st = { mes: addMonths(thisMonth(), -1), tipo: 'mensal', area: '' };
  if (PAGINA !== 'avaliacao') st.mes = thisMonth();

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
  async function tarefa(fn, txt) { carregando(true, txt); try { await fn(); } catch (e) { alert(e.message); } finally { carregando(false); } }

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
        ${mesInp}<span class="muted small" id="dirPeriodo"></span><button class="btn primary" data-pdf-geral>Baixar PDF geral</button>`;
    }
    return mesInp;
  }

  function desenhar() {
    graficos.splice(0).forEach(c => c.destroy());
    document.title = `${TITULOS[PAGINA]} · Painel da Diretoria`;
    $('#dirSub').textContent = `Instituto Cultural das Montanhas · ${TITULOS[PAGINA]}`;
    document.querySelectorAll('#dirNav a').forEach(a => a.classList.toggle('ativo', a.dataset.p === PAGINA));
    $('#dirFiltros').innerHTML = filtros();
    ({ avaliacao: telaAvaliacao, reunioes: telaReunioes, visitas: telaVisitas })[PAGINA]();
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
          <footer><span>${x.pendencias.length} pendência(s) na conferência</span><span>${x.alertas.length} aluno(s) em alerta de faltas</span><span>${x.ocorr.length} ocorrência(s)</span>
            <button class="btn ghost small" data-ficha="${esc(x.p.nome)}">Ficha PDF</button></footer>
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
    const botoes = r => `<button class="btn ghost small" data-ata="${r.id}">Ver ata</button><button class="btn ghost small" data-ata-pdf="${r.id}">PDF</button><button class="btn ghost small" data-ata-word="${r.id}">Word</button>`;
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
      ${a.encaminhamentos ? `<h4>Encaminhamentos</h4><p>${esc(a.encaminhamentos).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="form-actions"><button class="btn ghost" data-ata-word="${r.id}">Baixar Word</button><button class="btn primary" data-ata-pdf="${r.id}">Baixar PDF</button></div></div>`);
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
              <td class="row-actions">${vs.map(v => `<button class="btn ghost small" data-visita="${v.id}">Ver relatório</button><button class="btn ghost small" data-visita-pdf="${v.id}">PDF</button>`).join('')}</td></tr>`;
          }).join('')}</tbody></table></div>` : '<p class="empty">Nenhuma turma ativa neste mês.</p>'}
      </section>
      <section class="card">
        <h3>Controle de ${ano} <small class="muted">✓ visitada · — sem visita · · turma não iniciada</small></h3>
        <div class="table-wrap"><table class="table hist"><thead><tr><th>Turma</th>${cabMeses(ano, mes)}<th>Total</th></tr></thead>
        <tbody>${todas.map(t => `<tr><td>${esc(shortName(t.nome))}</td>${Array.from({ length: 12 }, (_, i) => `<td>${situacao(t, `${ano}-${pad(i + 1)}`)}</td>`).join('')}
          <td><strong>${Array.from({ length: 12 }, (_, i) => visitasDe(t.id, `${ano}-${pad(i + 1)}`).length ? 1 : 0).reduce((a, b) => a + b, 0)}</strong></td></tr>`).join('')}</tbody></table></div>
      </section>`;
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
      ${fs.length ? `<h4>Fotos e evidências</h4><div class="dir-fotos">${fs.map(f => `<figure><img src="${f.miniatura}" data-foto="${f.id}"><figcaption>${esc(f.legenda || '')}</figcaption></figure>`).join('')}</div>` : ''}
      <div class="form-actions"><button class="btn primary" data-visita-pdf="${v.id}">Baixar PDF</button></div></div>`);
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

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-area],[data-mes],[data-ficha],[data-pdf-geral],[data-ata],[data-ata-pdf],[data-ata-word],[data-visita],[data-visita-pdf],[data-foto]');
    if (!el) return;
    const d = el.dataset;
    if (d.area !== undefined) { st.area = d.area; desenhar(); }
    else if (d.mes) { st.mes = d.mes; desenhar(); window.scrollTo(0, 0); }
    else if (d.ficha !== undefined || d.pdfGeral !== undefined) tarefa(async () => { await PDF.setAssinante(null); await PDF.avaliacao(st.tipo, st.mes, d.ficha); }, 'Gerando PDF…');
    else if (d.ata) verAta(DB.Reunioes.find(r => r.id === d.ata));
    else if (d.ataPdf) tarefa(async () => { await PDF.setAssinante(null); await PDF.ata(reuniaoObj(DB.Reunioes.find(r => r.id === d.ataPdf))); }, 'Gerando PDF…');
    else if (d.ataWord) tarefa(() => baixarAtaWord(reuniaoObj(DB.Reunioes.find(r => r.id === d.ataWord))), 'Gerando Word…');
    else if (d.visita) verVisita(DB.Visitas.find(v => v.id === d.visita));
    else if (d.visitaPdf) tarefa(async () => { await PDF.setAssinante(null); await PDF.visita(DB.Visitas.find(v => v.id === d.visitaPdf)); }, 'Gerando PDF (carregando fotos)…');
    else if (d.foto) zoomFoto(d.foto);
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
