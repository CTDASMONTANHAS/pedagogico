/* Interface do sistema de gestão pedagógica. */
const $ = s => document.querySelector(s);
const view = $('#view');
const ui = {
  areaTurmas: 'MUSICA', areaConf: '', areaAlertas: '', areaEventos: '', mes: thisMonth(),
  freqTurma: '', freqDe: '', freqAte: '', mostrarDesligados: false,
};
let charts = [];
const actions = {};

/* ---------- infraestrutura ---------- */
function toast(msg, type) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show ' + (type || '');
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast'; }, 3200);
}
function busy(on, text) { $('#loading').classList.toggle('hidden', !on); $('#loadingText').textContent = text || 'Salvando…'; }

async function run(fn, text) {
  busy(true, text);
  try { return await fn(); } catch (e) {
    console.error(e);
    if (e.auth) { logout(); toast('Senha inválida. Entre novamente.', 'error'); } else if (!e.semSenha) toast(e.message || 'Erro', 'error');
    throw e;
  } finally { busy(false); }
}

function upsertLocal(sheet, rec) {
  const i = DB[sheet].findIndex(r => r.id === rec.id);
  if (i >= 0) DB[sheet][i] = Object.assign({}, DB[sheet][i], rec); else DB[sheet].push(rec);
}
async function save(sheet, rec, quiet) {
  const saved = await run(() => API.save(sheet, rec));
  upsertLocal(sheet, saved || rec);
  if (!quiet) toast('Salvo');
  return saved;
}
async function saveMany(sheet, recs) {
  if (!recs.length) return [];
  const saved = await run(() => API.saveMany(sheet, recs));
  saved.forEach(r => upsertLocal(sheet, r));
  return saved;
}
async function remove(sheet, id) {
  await run(() => API.remove(sheet, id), 'Excluindo…');
  DB[sheet] = DB[sheet].filter(r => r.id !== id);
}

async function loadAll() {
  const data = await run(() => API.getAll(), 'Carregando dados da planilha…');
  SHEETS.forEach(s => { DB[s] = (data && data[s]) || []; });
  render();
}

/* ---------- modal e formulários ---------- */
function openModal(title, html, wide) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  $('#modal .modal-card').classList.toggle('wide', !!wide);
  const f = $('#modalBody input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #modalBody textarea, #modalBody select');
  if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }

function field(f, v) {
  const val = v == null ? '' : v;
  const req = f.required ? 'required' : '';
  let input;
  if (f.type === 'select') {
    input = `<select name="${f.name}" ${req}>${f.options.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea name="${f.name}" rows="${f.rows || 3}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  } else if (f.type === 'checks') {
    const sel = String(val).split(',').filter(Boolean);
    input = `<div class="checks">${f.options.map(([k, l]) => `<label class="check"><input type="checkbox" name="${f.name}" value="${k}" ${!sel.length || sel.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>`;
  } else {
    input = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}" ${req} placeholder="${esc(f.placeholder || '')}">`;
  }
  return `<label class="field ${f.full ? 'full' : ''}">${esc(f.label)}${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
}

function openForm(title, fields, values, onSubmit, extraHtml) {
  openModal(title, `<form id="mform" class="form-grid">${fields.map(f => field(f, values[f.name])).join('')}${extraHtml || ''}
    <div class="form-actions full"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form>`);
  $('#mform').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const out = {};
    fields.forEach(f => { out[f.name] = f.type === 'checks' ? fd.getAll(f.name).join(',') : (fd.get(f.name) || '').trim(); });
    try { await onSubmit(out); closeModal(); render(); } catch (e) { /* toast já exibido */ }
  });
}

function confirmBox(msg, label, onYes) {
  openModal('Confirmar', `<p>${msg}</p><div class="form-actions"><button class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn danger" id="cYes">${esc(label || 'Confirmar')}</button></div>`);
  $('#cYes').onclick = async () => { try { await onYes(); closeModal(); render(); } catch (e) { /* toast */ } };
}

/* ---------- componentes ---------- */
const areaBadge = a => `<span class="badge area-${(a || '').toLowerCase()}">${esc(AREAS[a] || a)}</span>`;
const pctBadge = p => p == null ? '<span class="muted">—</span>' : `<span class="pct ${p >= 75 ? 'good' : p >= 50 ? 'mid' : 'low'}">${p}%</span>`;
const seqBadge = n => n >= 3 ? `<span class="flag red">${n} faltas seguidas</span>` : n === 2 ? `<span class="flag amber">2 faltas seguidas</span>` : '';

function areaTabs(key, withAll) {
  const opts = (withAll ? [['', 'Todas']] : []).concat(Object.entries(AREAS));
  return `<div class="tabs">${opts.map(([k, l]) => `<button class="tab ${ui[key] === k ? 'active' : ''} ${k ? 'tab-' + k.toLowerCase() : ''}" data-action="setArea" data-key="${key}" data-val="${k}">${l}</button>`).join('')}</div>`;
}
actions.setArea = el => { ui[el.dataset.key] = el.dataset.val; render(); };

function turmaOptions(sel, withEmpty) {
  return (withEmpty ? '<option value="">Selecione a turma…</option>' : '') + Object.entries(AREAS).map(([k, l]) =>
    `<optgroup label="${l}">${turmasAtivas(k).map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.nome)}${t.professor ? ' — ' + esc(t.professor) : ''}</option>`).join('')}</optgroup>`).join('');
}

function kpi(label, value, sub, cls) {
  return `<div class="kpi ${cls || ''}"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

function chart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#666';
  charts.push(new Chart(el, Object.assign({}, config, { options: Object.assign({ responsive: true, maintainAspectRatio: false }, config.options) })));
}

function setHeader(title, actionsHtml) {
  $('#pageTitle').textContent = title;
  $('#pageActions').innerHTML = actionsHtml || '';
  document.title = `${title} · Gestão Pedagógica`;
}

/* ---------- roteamento ---------- */
const routes = {};
function render() {
  charts.forEach(c => c.destroy()); charts = [];
  const [name, param] = (location.hash.slice(1) || 'painel').split('/');
  const fn = routes[name] || routes.painel;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === (name === 'turma' ? 'turmas' : name === 'evento' ? 'eventos' : name)));
  const al = alertasFaltas();
  $('#navAlertas').textContent = al.length || '';
  $('#navAlertas').className = 'nav-badge' + (al.some(a => a.nivel === 3) ? ' red' : al.length ? ' amber' : '');
  fn(param);
  $('#sidebar').classList.remove('open');
}

/* ================= PAINEL ================= */
routes.painel = () => {
  setHeader('Painel');
  const mes = thisMonth();
  const al = alertasFaltas();
  const ativos = DB.Alunos.filter(a => a.ativo !== 'NAO' && turma(a.turma_id) && turma(a.turma_id).ativa !== 'NAO');
  const conf = resumoConferencia(mes);
  const prox = DB.Eventos.filter(e => e.data_evento >= todayISO() && e.status !== 'CANCELADO').sort((a, b) => a.data_evento.localeCompare(b.data_evento));
  const ini = addMonths(mes, -2) + '-01';
  view.innerHTML = `
    <div class="kpis">
      ${kpi('Turmas de Música', turmasAtivas('MUSICA').length, `${ativos.filter(a => turma(a.turma_id).area === 'MUSICA').length} alunos ativos`, 'k-musica')}
      ${kpi('Turmas de Esporte', turmasAtivas('ESPORTE').length, `${ativos.filter(a => turma(a.turma_id).area === 'ESPORTE').length} alunos ativos`, 'k-esporte')}
      ${kpi(`Conferência de ${MESES[+mes.slice(5) - 1]}`, conf.pct == null ? '—' : conf.pct + '%', `${conf.ok} de ${conf.total} itens em dia`)}
      ${kpi('2 faltas seguidas', al.filter(a => a.nivel === 2).length, 'contatar aluno/família', 'k-amber')}
      ${kpi('3+ faltas seguidas', al.filter(a => a.nivel === 3).length, 'aptos a desligamento', 'k-red')}
      ${kpi('Próximos eventos', prox.length, prox[0] ? `${fmtDate(prox[0].data_evento)} · ${esc(prox[0].municipio)}` : 'nenhum agendado')}
    </div>
    <div class="grid2">
      <section class="card"><h3>Assiduidade por turma <small class="muted">últimos 3 meses</small></h3><div class="chart-box tall"><canvas id="chTurmas"></canvas></div></section>
      <section class="card"><h3>Conferência de ${fmtMonth(mes)}</h3><div class="chart-box tall"><canvas id="chConf"></canvas></div>
        <p class="right"><a href="#conferencia">Abrir conferência →</a></p></section>
    </div>
    <div class="grid2">
      <section class="card"><h3>Alertas de faltas</h3>${al.length ? `<ul class="list">${al.slice(0, 8).map(x => `<li><span>${seqBadge(x.stats.seqAtual)} <strong>${esc(x.aluno.nome)}</strong> <small class="muted">${esc(x.turma.nome)}</small></span><span>${x.contato ? '<span class="tag ok">contatado</span>' : '<span class="tag">sem contato</span>'}</span></li>`).join('')}</ul><p class="right"><a href="#alertas">Ver todos →</a></p>` : '<p class="empty">Nenhum aluno com faltas seguidas.</p>'}</section>
      <section class="card"><h3>Próximos eventos e viagens</h3>${prox.length ? `<ul class="list">${prox.slice(0, 6).map(e => { const p = participantesEvento(e.id); const okA = p.filter(x => isTrue(x.part.autorizacao)).length; return `<li><a href="#evento/${e.id}"><strong>${fmtDate(e.data_evento)}</strong> · ${esc(e.nome)} <small class="muted">${esc(e.municipio)}</small></a><span>${areaBadge(e.area)} <span class="tag ${okA === p.length && p.length ? 'ok' : ''}">${okA}/${p.length} autorizações</span></span></li>`; }).join('')}</ul>` : '<p class="empty">Nenhum evento futuro cadastrado.</p>'}</section>
    </div>`;
  const ts = turmasAtivas().filter(t => statsTurma(t.id, ini).aulas);
  const st = ts.map(t => statsTurma(t.id, ini));
  if (ts.length) {
    const h = Math.max(260, ts.length * 30 + 60);
    document.getElementById('chTurmas').parentElement.style.height = h + 'px';
    chart('chTurmas', {
      type: 'bar',
      data: { labels: ts.map(t => shortName(t.nome)), datasets: [{ label: '% de presença', data: st.map(s => s.pct || 0), backgroundColor: ts.map(t => t.area === 'MUSICA' ? '#7b5cc4' : '#2a8f57'), borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}% · ${st[c.dataIndex].aulas} aulas` } } }, scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } },
    });
  } else document.getElementById('chTurmas').parentElement.outerHTML = '<p class="empty">Nenhuma chamada registrada nos últimos 3 meses.</p>';
  const conta = area => {
    const c = { EM_DIA: 0, PARCIAL: 0, PENDENTE: 0, '': 0 };
    turmasAtivas(area).forEach(t => { const r = conferencia(t.id, mes) || {}; CONF_ITENS.forEach(([k]) => { c[r[k] || '']++; }); });
    return c;
  };
  const cm = conta('MUSICA'), ce = conta('ESPORTE');
  chart('chConf', {
    type: 'bar',
    data: {
      labels: ['Música', 'Esporte'],
      datasets: [['EM_DIA', '#2a8f57'], ['PARCIAL', '#e0a526'], ['PENDENTE', '#d0443e'], ['', '#c9c9c9']].map(([k, color]) => ({ label: CONF_STATUS[k].label, data: [cm[k], ce[k]], backgroundColor: color, stack: 's' })),
    },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 }, title: { display: true, text: 'itens' } } } },
  });
};

/* ================= TURMAS ================= */
const TURMA_FIELDS = [
  { name: 'area', label: 'Área', type: 'select', options: Object.entries(AREAS), required: true },
  { name: 'nome', label: 'Nome da turma', required: true, placeholder: 'Ex.: Violão Iniciante — Manhã' },
  { name: 'modalidade', label: 'Modalidade / instrumento', placeholder: 'Ex.: Violão, Futsal, Vôlei' },
  { name: 'professor', label: 'Professor(a)' },
  { name: 'dias_horario', label: 'Dias e horário', placeholder: 'Ex.: Ter e Qui, 14h–15h30' },
  { name: 'local', label: 'Local' },
];
const ALUNO_FIELDS = [
  { name: 'nome', label: 'Nome completo', required: true, full: true },
  { name: 'data_nascimento', label: 'Data de nascimento', type: 'date' },
  { name: 'responsavel', label: 'Responsável' },
  { name: 'telefone', label: 'Telefone', placeholder: '(27) 9 9999-9999' },
];

routes.turmas = () => {
  setHeader('Turmas e alunos', `<button class="btn primary" data-action="novaTurma">+ Nova turma</button>`);
  const ts = turmasDaArea(ui.areaTurmas);
  view.innerHTML = `${areaTabs('areaTurmas')}
    ${ts.length ? `<div class="cards">${ts.map(t => {
      const al = alunosDaTurma(t.id); const s = statsTurma(t.id); const alr = alertasFaltas(t.area).filter(x => x.turma.id === t.id);
      return `<a class="tcard ${t.ativa === 'NAO' ? 'archived' : ''} area-border-${t.area.toLowerCase()}" href="#turma/${t.id}">
        <div class="tcard-head"><strong>${esc(t.nome)}</strong>${t.ativa === 'NAO' ? '<span class="tag">arquivada</span>' : ''}</div>
        <div class="muted small">${esc([t.modalidade, t.professor].filter(Boolean).join(' · ') || '—')}</div>
        <div class="muted small">${esc(t.dias_horario || '')}</div>
        <div class="tcard-foot"><span>${al.length} alunos</span>${pctBadge(s.pct)}
          ${alr.length ? `<span class="flag ${alr.some(x => x.nivel === 3) ? 'red' : 'amber'}">${alr.length} alerta(s)</span>` : ''}</div></a>`;
    }).join('')}</div>` : `<div class="empty-state"><p>Nenhuma turma de ${AREAS[ui.areaTurmas]} cadastrada.</p><button class="btn primary" data-action="novaTurma">Cadastrar turma</button></div>`}`;
};
actions.novaTurma = () => openForm('Nova turma', TURMA_FIELDS, { area: ui.areaTurmas }, async v => {
  await save('Turmas', Object.assign({ id: uid(), ativa: 'SIM', criado_em: todayISO() }, v));
  ui.areaTurmas = v.area;
});

routes.turma = id => {
  const t = turma(id);
  if (!t) { location.hash = '#turmas'; return; }
  setHeader(t.nome, `<button class="btn ghost" data-action="editTurma" data-id="${id}">Editar turma</button>
    <a class="btn ghost" href="#frequencia" data-action="verFreq" data-id="${id}">Frequência</a>
    <button class="btn primary" data-action="novoAluno" data-id="${id}">+ Aluno</button>`);
  const alunos = alunosDaTurma(id, ui.mostrarDesligados);
  const s = statsTurma(id);
  view.innerHTML = `
    <div class="card info-row">
      ${areaBadge(t.area)}
      <span><small class="muted">Modalidade</small>${esc(t.modalidade || '—')}</span>
      <span><small class="muted">Professor(a)</small>${esc(t.professor || '—')}</span>
      <span><small class="muted">Dias/horário</small>${esc(t.dias_horario || '—')}</span>
      <span><small class="muted">Local</small>${esc(t.local || '—')}</span>
      <span><small class="muted">Aulas registradas</small>${s.aulas}</span>
      <span><small class="muted">Assiduidade</small>${pctBadge(s.pct)}</span>
    </div>
    <section class="card">
      <div class="card-head"><h3>Alunos (${alunosDaTurma(id).length} ativos)</h3>
        <div class="actions"><label class="check small"><input type="checkbox" data-change="toggleDesligados" ${ui.mostrarDesligados ? 'checked' : ''}> mostrar desligados</label>
        <button class="btn ghost small" data-action="alunosLote" data-id="${id}">Adicionar vários</button></div></div>
      ${alunos.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Aluno(a)</th><th>Nascimento</th><th>Responsável</th><th>Telefone</th><th>Presença</th><th>Situação</th><th></th></tr></thead>
        <tbody>${alunos.map(a => { const st = statsAluno(a.id); return `<tr class="${a.ativo === 'NAO' ? 'off' : ''}">
          <td><a href="javascript:void 0" data-action="fichaAluno" data-id="${a.id}"><strong>${esc(a.nome)}</strong></a></td>
          <td>${fmtDate(a.data_nascimento)}</td><td>${esc(a.responsavel)}</td><td>${esc(a.telefone)}</td>
          <td>${pctBadge(st.pct)} <small class="muted">${st.P}/${st.total}</small></td>
          <td>${a.ativo === 'NAO' ? `<span class="tag">desligado ${fmtDate(a.data_desligamento)}</span>` : seqBadge(st.seqAtual) || '<span class="tag ok">regular</span>'}</td>
          <td class="row-actions"><button class="btn ghost small" data-action="editAluno" data-id="${a.id}">Editar</button>
            ${a.ativo === 'NAO' ? `<button class="btn ghost small" data-action="reativarAluno" data-id="${a.id}">Reativar</button>` : `<button class="btn ghost small danger-text" data-action="desligarAluno" data-id="${a.id}">Desligar</button>`}</td></tr>`; }).join('')}</tbody></table></div>`
        : `<p class="empty">Nenhum aluno cadastrado nesta turma.</p>`}
    </section>`;
};
actions.verFreq = el => { ui.freqTurma = el.dataset.id; };
actions.toggleDesligados = el => { ui.mostrarDesligados = el.checked; render(); };
actions.editTurma = el => {
  const t = turma(el.dataset.id);
  const extra = `<label class="field">Situação<select name="ativa"><option value="SIM" ${t.ativa !== 'NAO' ? 'selected' : ''}>Ativa</option><option value="NAO" ${t.ativa === 'NAO' ? 'selected' : ''}>Arquivada</option></select></label>
    <div class="full"><button type="button" class="btn ghost small danger-text" data-action="excluirTurma" data-id="${t.id}">Excluir turma</button></div>`;
  openForm('Editar turma', TURMA_FIELDS, t, async v => { v.ativa = $('#mform [name=ativa]').value; await save('Turmas', Object.assign({}, t, v)); }, extra);
};
actions.excluirTurma = el => {
  const t = turma(el.dataset.id);
  const n = DB.Alunos.filter(a => a.turma_id === t.id).length;
  if (n) { toast('A turma tem alunos. Arquive-a em vez de excluir.', 'error'); return; }
  confirmBox(`Excluir a turma <strong>${esc(t.nome)}</strong>?`, 'Excluir', async () => { await remove('Turmas', t.id); location.hash = '#turmas'; });
};
actions.novoAluno = el => openForm('Novo aluno', ALUNO_FIELDS, {}, v => save('Alunos', Object.assign({ id: uid(), turma_id: el.dataset.id, ativo: 'SIM', criado_em: todayISO() }, v)));
actions.editAluno = el => {
  const a = aluno(el.dataset.id);
  const fields = ALUNO_FIELDS.concat([{ name: 'turma_id', label: 'Turma', type: 'select', options: DB.Turmas.slice().sort(byName).map(t => [t.id, `${AREAS[t.area]} — ${t.nome}`]) }]);
  openForm('Editar aluno', fields, a, v => save('Alunos', Object.assign({}, a, v)));
};
actions.alunosLote = el => {
  openModal('Adicionar vários alunos', `<form id="lote" class="form-grid">
    <label class="field full">Cole um aluno por linha. Opcional: nome; nascimento; responsável; telefone (separados por ; ou tabulação)
    <textarea name="txt" rows="10" required placeholder="Maria da Silva; 12/03/2014; Ana da Silva; (27) 99999-0000&#10;João Souza"></textarea></label>
    <div class="form-actions full"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary">Adicionar</button></div></form>`);
  $('#lote').addEventListener('submit', async ev => {
    ev.preventDefault();
    const tid = el.dataset.id;
    const recs = ev.target.txt.value.split(/\r?\n/).map(l => l.split(/\t|;/).map(s => s.trim())).filter(r => r[0])
      .filter(r => !matchAluno(tid, r[0]) || norm(matchAluno(tid, r[0]).nome) !== norm(r[0]))
      .map(r => ({ id: uid(), turma_id: tid, nome: r[0], data_nascimento: parseDate(r[1]) || '', responsavel: r[2] || '', telefone: r[3] || '', ativo: 'SIM', criado_em: todayISO() }));
    try { await saveMany('Alunos', recs); toast(`${recs.length} aluno(s) adicionados`); closeModal(); render(); } catch (e) { /* toast */ }
  });
};
actions.desligarAluno = el => {
  const a = aluno(el.dataset.id);
  openForm(`Desligar ${a.nome}`, [
    { name: 'data_desligamento', label: 'Data do desligamento', type: 'date', required: true },
    { name: 'motivo_desligamento', label: 'Motivo', type: 'select', options: [['Faltas consecutivas', 'Faltas consecutivas'], ['Pedido da família', 'Pedido da família'], ['Mudança de cidade', 'Mudança de cidade'], ['Outro', 'Outro']] },
  ], { data_desligamento: todayISO(), motivo_desligamento: statsAluno(a.id).seqAtual >= 3 ? 'Faltas consecutivas' : '' }, v => save('Alunos', Object.assign({}, a, v, { ativo: 'NAO' })));
};
actions.reativarAluno = el => { const a = aluno(el.dataset.id); save('Alunos', Object.assign({}, a, { ativo: 'SIM', data_desligamento: '', motivo_desligamento: '' })).then(render); };

actions.fichaAluno = el => {
  const a = aluno(el.dataset.id); const t = turma(a.turma_id); const s = statsAluno(a.id);
  const faltas = registrosAluno(a.id).filter(r => r.status !== 'P').reverse();
  const cont = DB.Contatos.filter(c => c.aluno_id === a.id).sort((x, y) => y.data.localeCompare(x.data));
  openModal(a.nome, `
    <div class="info-row compact">${areaBadge(t.area)}<span><small class="muted">Turma</small>${esc(t.nome)}</span><span><small class="muted">Responsável</small>${esc(a.responsavel || '—')}</span><span><small class="muted">Telefone</small>${esc(a.telefone || '—')}</span></div>
    <div class="kpis mini">${kpi('Presença', s.pct == null ? '—' : s.pct + '%', `${s.P} de ${s.total} aulas`)}${kpi('Faltas', s.F, `${s.J} justificadas`)}${kpi('Faltas seguidas', s.seqAtual, s.seqAtual >= 3 ? 'apto a desligamento' : s.seqAtual === 2 ? 'contatar família' : 'regular', s.seqAtual >= 3 ? 'k-red' : s.seqAtual === 2 ? 'k-amber' : '')}</div>
    <h4>Faltas registradas</h4>${faltas.length ? `<p>${faltas.map(r => `<span class="chip ${r.status}">${fmtDate(r.data)} ${r.status}</span>`).join(' ')}</p>` : '<p class="muted">Nenhuma falta.</p>'}
    <h4>Contatos da secretaria</h4>${cont.length ? `<ul class="list">${cont.map(c => `<li><span><strong>${fmtDate(c.data)}</strong> · ${esc(c.resultado)} ${c.motivo ? '— ' + esc(c.motivo) : ''}<br><small class="muted">${esc(c.observacoes)}</small></span><button class="btn ghost small" data-action="excluirContato" data-id="${c.id}">Excluir</button></li>`).join('')}</ul>` : '<p class="muted">Nenhum contato registrado.</p>'}
    <div class="form-actions"><button class="btn primary" data-action="registrarContato" data-id="${a.id}">Registrar contato</button></div>`, true);
};

/* ================= CONFERÊNCIA ================= */
routes.conferencia = () => {
  setHeader('Conferência mensal dos professores', `<input type="month" class="input" value="${ui.mes}" data-change="setMes">
    <button class="btn primary" data-action="pdfConferencia">Gerar PDF</button>`);
  const ts = turmasAtivas(ui.areaConf);
  const r = resumoConferencia(ui.mes, ui.areaConf);
  const meses = [5, 4, 3, 2, 1, 0].map(i => addMonths(ui.mes, -i));
  const sel = (t, k, v) => `<select class="st-select ${(CONF_STATUS[v || ''] || CONF_STATUS['']).cls}" data-change="setConf" data-turma="${t.id}" data-item="${k}">
    ${Object.entries(CONF_STATUS).map(([s, o]) => `<option value="${s}" ${s === (v || '') ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
  view.innerHTML = `${areaTabs('areaConf', true)}
    <div class="kpis">
      ${kpi('Referência', fmtMonth(ui.mes))}
      ${kpi('Itens em dia', r.pct == null ? '—' : r.pct + '%', `${r.ok} de ${r.total}`)}
      ${kpi('Itens pendentes / não conferidos', r.pend, '', r.pend ? 'k-amber' : '')}
      ${kpi('Turmas', r.turmas)}
    </div>
    <section class="card">
      <div class="card-head"><h3>Checklist de ${fmtMonth(ui.mes)}</h3>
        <div class="actions"><button class="btn ghost small" data-action="marcarTudo">Marcar não conferidos como “Em dia”</button></div></div>
      <p class="muted small">Para cada turma, confira no sistema de registro se o professor fez: plano de aula mensal, relatório das aulas, registro de chamada e fechamento do mês. As alterações são salvas automaticamente.</p>
      ${ts.length ? `<div class="table-wrap"><table class="table conf">
        <thead><tr><th>Turma</th><th>Professor(a)</th>${CONF_ITENS.map(([, l]) => `<th>${l}</th>`).join('')}<th>Observações</th></tr></thead>
        <tbody>${Object.keys(AREAS).filter(a => !ui.areaConf || a === ui.areaConf).map(area => {
          const lista = turmasAtivas(area);
          if (!lista.length) return '';
          return `<tr class="group"><td colspan="7">${AREAS[area]}</td></tr>` + lista.map(t => {
            const c = conferencia(t.id, ui.mes) || {};
            return `<tr><td><strong>${esc(t.nome)}</strong></td><td>${esc(t.professor || '—')}</td>
              ${CONF_ITENS.map(([k]) => `<td>${sel(t, k, c[k])}</td>`).join('')}
              <td><input class="input obs" value="${esc(c.observacoes || '')}" placeholder="—" data-change="setConfObs" data-turma="${t.id}"></td></tr>`;
          }).join('');
        }).join('')}</tbody></table></div>` : '<p class="empty">Cadastre as turmas primeiro.</p>'}
    </section>
    <section class="card">
      <h3>Histórico dos últimos 6 meses</h3>
      <div class="table-wrap"><table class="table hist"><thead><tr><th>Turma</th>${meses.map(m => `<th>${MESES[+m.slice(5) - 1].slice(0, 3)}/${m.slice(2, 4)}</th>`).join('')}</tr></thead>
      <tbody>${ts.map(t => `<tr><td>${areaBadge(t.area)} ${esc(t.nome)}</td>${meses.map(m => {
        const c = conferencia(t.id, m) || {};
        const ok = CONF_ITENS.filter(([k]) => c[k] === 'EM_DIA').length;
        const bad = CONF_ITENS.filter(([k]) => c[k] === 'PENDENTE').length;
        const none = CONF_ITENS.every(([k]) => !c[k]);
        return `<td><span class="hist-cell ${none ? 'st-none' : ok === 4 ? 'st-ok' : bad ? 'st-bad' : 'st-warn'}" title="${ok}/4 em dia">${none ? '—' : ok + '/4'}</span></td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>
    </section>`;
};
actions.setMes = el => { ui.mes = el.value || thisMonth(); render(); };
function confRecord(tid) {
  return Object.assign({ id: uid(), turma_id: tid, mes: ui.mes }, conferencia(tid, ui.mes) || {});
}
actions.setConf = async el => {
  const rec = confRecord(el.dataset.turma);
  rec[el.dataset.item] = el.value; rec.conferido_em = todayISO();
  el.className = 'st-select ' + CONF_STATUS[el.value].cls;
  await save('Conferencias', rec, true);
  toast('Conferência salva');
};
actions.setConfObs = async el => {
  const rec = confRecord(el.dataset.turma);
  rec.observacoes = el.value; rec.conferido_em = todayISO();
  await save('Conferencias', rec, true); toast('Observação salva');
};
actions.marcarTudo = async () => {
  const recs = turmasAtivas(ui.areaConf).map(t => {
    const rec = confRecord(t.id);
    CONF_ITENS.forEach(([k]) => { if (!rec[k]) rec[k] = 'EM_DIA'; });
    rec.conferido_em = todayISO();
    return rec;
  });
  await saveMany('Conferencias', recs); toast('Atualizado'); render();
};
actions.pdfConferencia = () => gerarPdf(() => PDF.conferencia(ui.mes, ui.areaConf));

/* ================= FREQUÊNCIA ================= */
routes.frequencia = () => {
  if (!ui.freqTurma || !turma(ui.freqTurma)) ui.freqTurma = (turmasAtivas()[0] || {}).id || '';
  const t = turma(ui.freqTurma);
  setHeader('Frequência e assiduidade', t ? `<button class="btn ghost" data-action="lancarChamada">Lançar chamada</button>
    <button class="btn ghost" data-action="importarChamada">Importar relatório</button>
    <button class="btn primary" data-action="pdfFrequencia">Gerar PDF</button>` : '');
  if (!t) { view.innerHTML = '<div class="empty-state"><p>Cadastre turmas para registrar a frequência.</p><a class="btn primary" href="#turmas">Ir para turmas</a></div>'; return; }
  const de = ui.freqDe, ate = ui.freqAte;
  const datas = datasDaTurma(t.id, de, ate);
  const alunos = alunosDaTurma(t.id, true).filter(a => a.ativo !== 'NAO' || registrosAluno(a.id, de, ate).length);
  const stats = alunos.map(a => ({ a, s: statsAluno(a.id, de, ate) }));
  const st = statsTurma(t.id, de, ate);
  const al = stats.filter(x => x.a.ativo !== 'NAO' && x.s.seqAtual >= 2);
  view.innerHTML = `
    <div class="filters card">
      <label>Turma<select data-change="setFreqTurma">${turmaOptions(t.id)}</select></label>
      <label>De<input type="date" class="input" value="${de}" data-change="setFreqDe"></label>
      <label>Até<input type="date" class="input" value="${ate}" data-change="setFreqAte"></label>
      <div class="quick">${[['Mês atual', 0], ['Mês passado', -1], ['Últimos 3 meses', -2], ['Tudo', null]].map(([l, n]) => `<button class="btn ghost small" data-action="periodo" data-n="${n}">${l}</button>`).join('')}</div>
    </div>
    <div class="kpis">
      ${kpi('Aulas registradas', st.aulas)}
      ${kpi('Assiduidade da turma', st.pct == null ? '—' : st.pct + '%', `${st.presencas} presenças em ${st.registros} registros`)}
      ${kpi('2 faltas seguidas', al.filter(x => x.s.seqAtual === 2).length, 'contatar', 'k-amber')}
      ${kpi('3+ faltas seguidas', al.filter(x => x.s.seqAtual >= 3).length, 'aptos a desligamento', 'k-red')}
    </div>
    ${datas.length ? `
    <div class="grid2">
      <section class="card"><h3>Assiduidade por aluno</h3><div class="chart-box" style="height:${Math.max(240, stats.length * 26 + 70)}px"><canvas id="chAlunos"></canvas></div></section>
      <section class="card"><h3>Presentes x faltosos por aula</h3><div class="chart-box" style="height:${Math.max(240, stats.length * 26 + 70)}px"><canvas id="chAulas"></canvas></div></section>
    </div>
    <section class="card">
      <div class="card-head"><h3>Mapa de chamada</h3><small class="muted">Clique numa célula para alternar P → F → J → vazio</small></div>
      <div class="table-wrap"><table class="table matrix">
        <thead><tr><th class="sticky">Aluno(a)</th>${datas.map(d => `<th title="${fmtDate(d)}">${fmtDateShort(d)}</th>`).join('')}<th>%</th><th>Seguidas</th></tr></thead>
        <tbody>${stats.map(({ a, s }) => `<tr class="${a.ativo === 'NAO' ? 'off' : ''}"><td class="sticky"><a href="javascript:void 0" data-action="fichaAluno" data-id="${a.id}">${esc(a.nome)}</a></td>
          ${datas.map(d => { const r = DB.Frequencia.find(x => x.aluno_id === a.id && x.data === d); return `<td class="cell ${r ? r.status : ''}" data-action="cycle" data-aluno="${a.id}" data-data="${d}">${r ? r.status : '·'}</td>`; }).join('')}
          <td>${pctBadge(s.pct)}</td><td>${seqBadge(s.seqAtual) || s.seqAtual}</td></tr>`).join('')}</tbody></table></div>
    </section>` : `<div class="empty-state"><p>Nenhuma chamada registrada para esta turma no período.</p><button class="btn primary" data-action="importarChamada">Importar relatório de presenças</button></div>`}`;
  if (datas.length) {
    chart('chAlunos', chartAssiduidadeConfig(stats));
    const cont = st => datas.map(d => DB.Frequencia.filter(r => r.turma_id === t.id && r.data === d && r.status === st).length);
    chart('chAulas', {
      type: 'bar',
      data: { labels: datas.map(fmtDateShort), datasets: [
        { label: 'Presentes', data: cont('P'), backgroundColor: '#2a8f57', stack: 's' },
        { label: 'Justificadas', data: cont('J'), backgroundColor: '#e0a526', stack: 's' },
        { label: 'Faltas', data: cont('F'), backgroundColor: '#d0443e', stack: 's' }] },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } },
    });
  }
};
actions.setFreqTurma = el => { ui.freqTurma = el.value; render(); };
actions.setFreqDe = el => { ui.freqDe = el.value; render(); };
actions.setFreqAte = el => { ui.freqAte = el.value; render(); };
actions.periodo = el => {
  if (el.dataset.n === 'null') { ui.freqDe = ''; ui.freqAte = ''; } else {
    const n = +el.dataset.n; const m = thisMonth();
    ui.freqDe = addMonths(m, n === -2 ? -2 : n) + '-01';
    ui.freqAte = n === -1 ? addMonths(m, 0) + '-00' : '';
    if (n === -1) { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 0); ui.freqAte = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  }
  render();
};
actions.cycle = async el => {
  const { aluno: aid, data } = el.dataset;
  const r = DB.Frequencia.find(x => x.aluno_id === aid && x.data === data);
  const next = { '': 'P', P: 'F', F: 'J', J: '' }[r ? r.status : ''];
  if (!next) { await remove('Frequencia', r.id); } else await save('Frequencia', Object.assign({ id: uid(), turma_id: ui.freqTurma, aluno_id: aid, data }, r || {}, { status: next }), true);
  render();
};
actions.pdfFrequencia = () => gerarPdf(() => PDF.frequenciaTurma(ui.freqTurma, ui.freqDe, ui.freqAte));

actions.lancarChamada = () => {
  const t = turma(ui.freqTurma);
  const alunos = alunosDaTurma(t.id);
  if (!alunos.length) { toast('Cadastre os alunos da turma primeiro.', 'error'); return; }
  const rowsHtml = d => alunos.map(a => {
    const r = DB.Frequencia.find(x => x.aluno_id === a.id && x.data === d);
    const v = r ? r.status : 'P';
    return `<tr><td>${esc(a.nome)}</td>${['P', 'F', 'J'].map(s => `<td><label class="radio ${s}"><input type="radio" name="a_${a.id}" value="${s}" ${v === s ? 'checked' : ''}>${s}</label></td>`).join('')}</tr>`;
  }).join('');
  openModal(`Lançar chamada — ${t.nome}`, `<form id="chamada">
    <label class="field">Data da aula<input type="date" name="data" value="${todayISO()}" required></label>
    <div class="table-wrap"><table class="table"><thead><tr><th>Aluno(a)</th><th>Presente</th><th>Falta</th><th>Justif.</th></tr></thead><tbody id="chamadaRows">${rowsHtml(todayISO())}</tbody></table></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary">Salvar chamada</button></div></form>`, true);
  $('#chamada [name=data]').addEventListener('change', e => { $('#chamadaRows').innerHTML = rowsHtml(e.target.value); });
  $('#chamada').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target); const d = fd.get('data');
    const regs = alunos.map(a => ({ aluno_id: a.id, data: d, status: fd.get('a_' + a.id) || 'P' }));
    try {
      await run(() => API.replaceFrequencia(t.id, [d], regs));
      DB.Frequencia = DB.Frequencia.filter(r => !(r.turma_id === t.id && r.data === d)).concat(regs.map(r => Object.assign({ id: uid(), turma_id: t.id }, r)));
      toast('Chamada salva'); closeModal(); render();
    } catch (e) { /* toast */ }
  });
};

actions.importarChamada = () => {
  const t = turma(ui.freqTurma);
  openModal(`Importar relatório de presenças`, `<form id="imp" class="form-grid">
    <label class="field">Turma<select name="turma">${turmaOptions(t.id)}</select></label>
    <label class="field">Ano (para datas sem ano)<input type="number" name="ano" value="${new Date().getFullYear()}"></label>
    <label class="field full">Cole a tabela do relatório (copie do Excel/Planilha/PDF)
      <textarea name="txt" rows="10" placeholder="Aluno&#9;01/10&#9;03/10&#9;08/10&#10;Maria da Silva&#9;P&#9;F&#9;F&#10;João Souza&#9;P&#9;P&#9;J"></textarea>
      <small>Matriz (nomes nas linhas, datas nas colunas, valores P / F / J) ou lista "Nome; Data; Status". Reimportar as mesmas datas substitui a chamada anterior.</small></label>
    <div id="impPrev" class="full"></div>
    <div class="form-actions full"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button type="button" class="btn ghost" id="impCheck">Pré-visualizar</button><button class="btn primary" id="impGo" disabled>Importar</button></div></form>`, true);
  let parsed = null;
  const preview = () => {
    const f = $('#imp');
    const tid = f.turma.value;
    parsed = parseChamada(f.txt.value, +f.ano.value);
    if (parsed.erro) { $('#impPrev').innerHTML = `<p class="error">${parsed.erro}</p>`; $('#impGo').disabled = true; return; }
    const novos = parsed.nomes.filter(n => !matchAluno(tid, n));
    const F = parsed.regs.filter(r => r.status === 'F').length;
    $('#impPrev').innerHTML = `<div class="notice"><strong>${parsed.regs.length}</strong> registros · <strong>${parsed.datas.length}</strong> aulas (${parsed.datas.map(fmtDateShort).join(', ')}) · <strong>${parsed.nomes.length}</strong> alunos · ${F} faltas
      ${novos.length ? `<p class="warn">${novos.length} nome(s) não encontrados na turma serão cadastrados: ${novos.map(esc).join(', ')}</p>` : '<p class="ok-text">Todos os alunos foram reconhecidos.</p>'}
      ${parsed.avisos.length ? `<details><summary>${parsed.avisos.length} aviso(s)</summary>${parsed.avisos.map(esc).join('<br>')}</details>` : ''}</div>`;
    $('#impGo').disabled = false;
  };
  $('#impCheck').onclick = preview;
  $('#imp').addEventListener('submit', async ev => {
    ev.preventDefault();
    preview(); if (!parsed || parsed.erro) return;
    const tid = $('#imp').turma.value;
    try {
      const novos = parsed.nomes.filter(n => !matchAluno(tid, n)).map(n => ({ id: uid(), turma_id: tid, nome: n, ativo: 'SIM', criado_em: todayISO() }));
      await saveMany('Alunos', novos);
      const regs = parsed.regs.map(r => ({ aluno_id: matchAluno(tid, r.nome).id, data: r.data, status: r.status }));
      await run(() => API.replaceFrequencia(tid, parsed.datas, regs), 'Importando…');
      DB.Frequencia = DB.Frequencia.filter(r => !(r.turma_id === tid && parsed.datas.includes(r.data))).concat(regs.map(r => Object.assign({ id: uid(), turma_id: tid }, r)));
      ui.freqTurma = tid;
      toast(`${regs.length} registros importados`); closeModal(); render();
    } catch (e) { /* toast */ }
  });
};

/* ================= ALERTAS ================= */
routes.alertas = () => {
  setHeader('Alertas de faltas consecutivas', `<button class="btn primary" data-action="pdfAlertas">Gerar PDF para a secretaria</button>`);
  const lista = alertasFaltas(ui.areaAlertas);
  const bloco = (nivel, titulo, desc, cls) => {
    const it = lista.filter(x => x.nivel === nivel);
    return `<section class="card alert-${cls}"><div class="card-head"><h3>${titulo} <span class="count">${it.length}</span></h3><small class="muted">${desc}</small></div>
      ${it.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Aluno(a)</th><th>Turma</th><th>Responsável / telefone</th><th>Faltas</th><th>Contato da secretaria</th><th></th></tr></thead><tbody>
      ${it.map(x => `<tr><td><a href="javascript:void 0" data-action="fichaAluno" data-id="${x.aluno.id}"><strong>${esc(x.aluno.nome)}</strong></a></td>
        <td>${areaBadge(x.turma.area)} ${esc(x.turma.nome)}</td>
        <td>${esc(x.aluno.responsavel || '—')}<br><small>${x.aluno.telefone ? `<a href="https://wa.me/55${x.aluno.telefone.replace(/\D/g, '').replace(/^55/, '')}" target="_blank" rel="noopener">${esc(x.aluno.telefone)}</a>` : '<span class="muted">sem telefone</span>'}</small></td>
        <td>${seqBadge(x.stats.seqAtual)}<br><small class="muted">${x.stats.faltasSeq.map(fmtDateShort).join(', ')}</small></td>
        <td>${x.contato ? `<span class="tag ok">${fmtDate(x.contato.data)}</span> ${esc(x.contato.resultado)}${x.contato.motivo ? `<br><small>${esc(x.contato.motivo)}</small>` : ''}` : '<span class="tag">não realizado</span>'}</td>
        <td class="row-actions"><button class="btn ghost small" data-action="registrarContato" data-id="${x.aluno.id}">Registrar contato</button>
          ${nivel === 3 ? `<button class="btn ghost small danger-text" data-action="desligarAluno" data-id="${x.aluno.id}">Desligar</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Nenhum aluno nesta situação.</p>'}</section>`;
  };
  view.innerHTML = `${areaTabs('areaAlertas', true)}
    <p class="muted small">Contam-se as faltas não justificadas seguidas a partir da última aula registrada. Uma presença ou falta justificada zera a sequência.</p>
    ${bloco(3, 'Aptos a desligamento — 3 ou mais faltas seguidas', 'Avaliar desligamento da turma', 'red')}
    ${bloco(2, 'Atenção — 2 faltas seguidas', 'Secretaria deve contatar o aluno ou a família', 'amber')}`;
};
actions.registrarContato = el => {
  const a = aluno(el.dataset.id); const s = statsAluno(a.id);
  openForm(`Contato — ${a.nome}`, [
    { name: 'data', label: 'Data do contato', type: 'date', required: true },
    { name: 'resultado', label: 'Resultado', type: 'select', options: [['Contato realizado', 'Contato realizado'], ['Sem resposta', 'Sem resposta'], ['Retornará às aulas', 'Retornará às aulas'], ['Vai desistir', 'Vai desistir'], ['Recado deixado', 'Recado deixado']] },
    { name: 'motivo', label: 'Motivo das faltas', placeholder: 'Ex.: doença, viagem, horário escolar…' },
    { name: 'observacoes', label: 'Observações', type: 'textarea', full: true },
  ], { data: todayISO() }, v => save('Contatos', Object.assign({ id: uid(), aluno_id: a.id, alerta: String(s.seqAtual) }, v)));
};
actions.excluirContato = el => confirmBox('Excluir este registro de contato?', 'Excluir', () => remove('Contatos', el.dataset.id));
actions.pdfAlertas = () => gerarPdf(() => PDF.alertas(ui.areaAlertas));

/* ================= EVENTOS ================= */
const EVENTO_FIELDS = [
  { name: 'area', label: 'Área', type: 'select', options: Object.entries(AREAS), required: true },
  { name: 'nome', label: 'Nome do evento', required: true, placeholder: 'Ex.: Festival de Música de Venda Nova' },
  { name: 'municipio', label: 'Município de destino', required: true },
  { name: 'local', label: 'Local' },
  { name: 'data_evento', label: 'Data do evento', type: 'date', required: true },
  { name: 'horario_saida', label: 'Horário de saída', type: 'time' },
  { name: 'data_retorno', label: 'Data de retorno', type: 'date' },
  { name: 'transporte', label: 'Transporte', placeholder: 'Ex.: Ônibus da prefeitura' },
  { name: 'responsavel', label: 'Responsável pela viagem' },
  { name: 'status', label: 'Situação', type: 'select', options: [['PLANEJADO', 'Planejado'], ['CONFIRMADO', 'Confirmado'], ['REALIZADO', 'Realizado'], ['CANCELADO', 'Cancelado']] },
  { name: 'documentos_exigidos', label: 'Documentos exigidos dos alunos', type: 'checks', options: DOCS_EVENTO, full: true },
  { name: 'observacoes', label: 'Observações', type: 'textarea', full: true },
];
const STATUS_EV = { PLANEJADO: 'Planejado', CONFIRMADO: 'Confirmado', REALIZADO: 'Realizado', CANCELADO: 'Cancelado' };

routes.eventos = () => {
  setHeader('Eventos e viagens', `<button class="btn primary" data-action="novoEvento">+ Novo evento</button>`);
  const evs = DB.Eventos.filter(e => !ui.areaEventos || e.area === ui.areaEventos);
  const fut = evs.filter(e => e.data_evento >= todayISO()).sort((a, b) => a.data_evento.localeCompare(b.data_evento));
  const pas = evs.filter(e => e.data_evento < todayISO()).sort((a, b) => b.data_evento.localeCompare(a.data_evento));
  const card = e => {
    const p = participantesEvento(e.id); const docs = docsDoEvento(e);
    const tot = p.length * docs.length; const ok = p.reduce((n, x) => n + docs.filter(([k]) => isTrue(x.part[k])).length, 0);
    const dias = Math.round((new Date(e.data_evento) - new Date(todayISO())) / 864e5);
    return `<a class="ecard area-border-${(e.area || '').toLowerCase()}" href="#evento/${e.id}">
      <div class="edate"><strong>${e.data_evento.slice(8, 10)}</strong><span>${MESES[+e.data_evento.slice(5, 7) - 1].slice(0, 3)}</span></div>
      <div class="ebody"><strong>${esc(e.nome)}</strong><div class="muted small">${esc(e.municipio)}${e.local ? ' · ' + esc(e.local) : ''}</div>
        <div class="tcard-foot">${areaBadge(e.area)}<span class="tag">${STATUS_EV[e.status] || 'Planejado'}</span><span>${p.length} aluno(s)</span>
        ${p.length ? `<span class="tag ${ok === tot ? 'ok' : 'warn'}">docs ${pct(ok, tot)}%</span>` : ''}${dias >= 0 && dias <= 15 ? `<span class="flag amber">em ${dias} dia(s)</span>` : ''}</div></div></a>`;
  };
  view.innerHTML = `${areaTabs('areaEventos', true)}
    <h3 class="section-title">Próximos</h3>${fut.length ? `<div class="cards">${fut.map(card).join('')}</div>` : '<p class="empty">Nenhum evento futuro.</p>'}
    ${pas.length ? `<h3 class="section-title">Realizados / anteriores</h3><div class="cards">${pas.map(card).join('')}</div>` : ''}`;
};
actions.novoEvento = () => openForm('Novo evento', EVENTO_FIELDS, { area: ui.areaEventos || 'MUSICA', status: 'PLANEJADO' }, async v => {
  const rec = await save('Eventos', Object.assign({ id: uid() }, v));
  location.hash = '#evento/' + rec.id;
});

routes.evento = id => {
  const e = DB.Eventos.find(x => x.id === id);
  if (!e) { location.hash = '#eventos'; return; }
  setHeader(e.nome, `<button class="btn ghost" data-action="editEvento" data-id="${id}">Editar</button>
    <button class="btn ghost" data-action="pdfAutorizacoes" data-id="${id}">Autorizações (PDF)</button>
    <button class="btn primary" data-action="pdfEvento" data-id="${id}">Lista e documentação (PDF)</button>`);
  const parts = participantesEvento(id); const docs = docsDoEvento(e);
  const completos = parts.filter(p => docs.every(([k]) => isTrue(p.part[k]))).length;
  view.innerHTML = `
    <div class="card info-row">${areaBadge(e.area)}
      <span><small class="muted">Data</small>${fmtDate(e.data_evento)}${e.horario_saida ? ' · saída ' + esc(e.horario_saida) : ''}</span>
      <span><small class="muted">Destino</small>${esc(e.municipio)}${e.local ? ' — ' + esc(e.local) : ''}</span>
      <span><small class="muted">Retorno</small>${fmtDate(e.data_retorno) || '—'}</span>
      <span><small class="muted">Transporte</small>${esc(e.transporte || '—')}</span>
      <span><small class="muted">Responsável</small>${esc(e.responsavel || '—')}</span>
      <span><small class="muted">Situação</small>${STATUS_EV[e.status] || 'Planejado'}</span></div>
    ${e.observacoes ? `<p class="card">${esc(e.observacoes)}</p>` : ''}
    <div class="kpis">${kpi('Participantes', parts.length)}${kpi('Documentação completa', `${completos}/${parts.length}`, '', completos === parts.length && parts.length ? '' : 'k-amber')}
      ${docs.map(([k, l]) => kpi(l, `${parts.filter(p => isTrue(p.part[k])).length}/${parts.length}`)).join('')}</div>
    <section class="card"><div class="card-head"><h3>Participantes e documentos</h3><button class="btn primary small" data-action="addParticipantes" data-id="${id}">+ Adicionar alunos</button></div>
      ${parts.length ? `<div class="table-wrap"><table class="table docs"><thead><tr><th>Aluno(a)</th><th>Turma</th><th>Responsável / telefone</th>${docs.map(([, l]) => `<th>${l}</th>`).join('')}<th>Obs.</th><th></th></tr></thead><tbody>
      ${parts.map(p => `<tr class="${docs.every(([k]) => isTrue(p.part[k])) ? 'done' : ''}"><td><strong>${esc(p.aluno.nome)}</strong><br><small class="muted">${fmtDate(p.aluno.data_nascimento)}</small></td><td>${esc(p.turma ? p.turma.nome : '')}</td>
        <td>${esc(p.aluno.responsavel || '—')}<br><small>${esc(p.aluno.telefone || '')}</small></td>
        ${docs.map(([k]) => `<td class="center"><input type="checkbox" class="doc-check" data-change="toggleDoc" data-id="${p.part.id}" data-doc="${k}" ${isTrue(p.part[k]) ? 'checked' : ''}></td>`).join('')}
        <td><input class="input obs" value="${esc(p.part.observacoes || '')}" data-change="obsPart" data-id="${p.part.id}" placeholder="—"></td>
        <td><button class="btn ghost small danger-text" data-action="removerPart" data-id="${p.part.id}">Remover</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Nenhum aluno adicionado. Use “Adicionar alunos”.</p>'}</section>
    <p><button class="btn ghost small danger-text" data-action="excluirEvento" data-id="${id}">Excluir evento</button></p>`;
};
actions.editEvento = el => { const e = DB.Eventos.find(x => x.id === el.dataset.id); openForm('Editar evento', EVENTO_FIELDS, e, v => save('Eventos', Object.assign({}, e, v))); };
actions.excluirEvento = el => confirmBox('Excluir este evento e a lista de participantes?', 'Excluir', async () => {
  const ids = DB.EventoParticipantes.filter(p => p.evento_id === el.dataset.id).map(p => p.id);
  if (ids.length) { await run(() => API.removeMany('EventoParticipantes', ids)); DB.EventoParticipantes = DB.EventoParticipantes.filter(p => !ids.includes(p.id)); }
  await remove('Eventos', el.dataset.id); location.hash = '#eventos';
});
actions.toggleDoc = async el => {
  const p = DB.EventoParticipantes.find(x => x.id === el.dataset.id);
  await save('EventoParticipantes', Object.assign({}, p, { [el.dataset.doc]: el.checked ? 'SIM' : 'NAO' }), true);
  render();
};
actions.obsPart = async el => { const p = DB.EventoParticipantes.find(x => x.id === el.dataset.id); await save('EventoParticipantes', Object.assign({}, p, { observacoes: el.value })); };
actions.removerPart = el => confirmBox('Remover este aluno do evento?', 'Remover', () => remove('EventoParticipantes', el.dataset.id));
actions.addParticipantes = el => {
  const e = DB.Eventos.find(x => x.id === el.dataset.id);
  const ja = new Set(participantesEvento(e.id).map(p => p.aluno.id));
  const ts = turmasAtivas(e.area).concat(turmasAtivas().filter(t => t.area !== e.area));
  openModal('Adicionar alunos ao evento', `<form id="addp">
    <input class="input full-w" id="addpBusca" placeholder="Buscar aluno…">
    <div class="pick">${ts.map(t => { const al = alunosDaTurma(t.id).filter(a => !ja.has(a.id)); if (!al.length) return ''; return `<fieldset><legend>${areaBadge(t.area)} ${esc(t.nome)} <button type="button" class="btn ghost small" data-action="marcarTurma" data-t="${t.id}">marcar todos</button></legend>
      ${al.map(a => `<label class="check pick-item" data-n="${esc(norm(a.nome))}"><input type="checkbox" name="al" value="${a.id}" data-t="${t.id}"> ${esc(a.nome)}</label>`).join('')}</fieldset>`; }).join('') || '<p class="empty">Todos os alunos ativos já estão no evento.</p>'}</div>
    <div class="form-actions"><button type="button" class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary">Adicionar selecionados</button></div></form>`, true);
  $('#addpBusca').addEventListener('input', ev => { const q = norm(ev.target.value); document.querySelectorAll('.pick-item').forEach(l => { l.style.display = !q || l.dataset.n.includes(q) ? '' : 'none'; }); });
  $('#addp').addEventListener('submit', async ev => {
    ev.preventDefault();
    const ids = new FormData(ev.target).getAll('al');
    const recs = ids.map(aid => { const r = { id: uid(), evento_id: e.id, aluno_id: aid, observacoes: '' }; DOCS_EVENTO.forEach(([k]) => { r[k] = 'NAO'; }); return r; });
    try { await saveMany('EventoParticipantes', recs); toast(`${recs.length} aluno(s) adicionados`); closeModal(); render(); } catch (e2) { /* toast */ }
  });
};
actions.marcarTurma = el => { const boxes = [...document.querySelectorAll(`#addp input[data-t="${el.dataset.t}"]`)]; const all = boxes.every(b => b.checked); boxes.forEach(b => { b.checked = !all; }); };
actions.pdfEvento = el => gerarPdf(() => PDF.eventoLista(el.dataset.id));
actions.pdfAutorizacoes = el => run(() => PDF.autorizacoes(el.dataset.id, false), 'Gerando PDF…');

/* ================= RELATÓRIOS ================= */
routes.relatorios = () => {
  setHeader('Relatórios em PDF');
  const areaSel = n => `<select name="${n}"><option value="">Música e Esporte</option>${Object.entries(AREAS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`;
  const evOpts = DB.Eventos.slice().sort((a, b) => b.data_evento.localeCompare(a.data_evento)).map(e => `<option value="${e.id}">${fmtDate(e.data_evento)} — ${esc(e.nome)}</option>`).join('');
  view.innerHTML = `<p class="muted">Todos os relatórios saem na folha timbrada do Instituto (logo, cabeçalho e rodapé com endereço), Ao gerar, você escolhe quem assina — cadastre as assinaturas em <a href="#assinaturas">Assinaturas</a>.</p>
  <div class="reports">
    <form class="card report" data-report="conferencia"><h3>Conferência pedagógica mensal</h3><p class="muted small">Situação de plano de aula, relatório de aulas, chamada e fechamento por turma + lista de pendências por professor.</p>
      <label>Mês<input type="month" name="mes" value="${ui.mes}" class="input"></label><label>Área${areaSel('area')}</label><button class="btn primary">Gerar PDF</button></form>
    <form class="card report" data-report="frequencia"><h3>Frequência da turma</h3><p class="muted small">Gráfico de assiduidade, resumo por aluno e mapa de chamada.</p>
      <label>Turma<select name="turma">${turmaOptions(ui.freqTurma, true)}</select></label><div class="row2"><label>De<input type="date" name="de" class="input"></label><label>Até<input type="date" name="ate" class="input"></label></div><button class="btn primary">Gerar PDF</button></form>
    <form class="card report" data-report="geral"><h3>Assiduidade geral</h3><p class="muted small">Comparativo de presença entre turmas, com alertas por turma.</p>
      <label>Área${areaSel('area')}</label><div class="row2"><label>De<input type="date" name="de" class="input"></label><label>Até<input type="date" name="ate" class="input"></label></div><button class="btn primary">Gerar PDF</button></form>
    <form class="card report" data-report="alertas"><h3>Faltas consecutivas (secretaria)</h3><p class="muted small">Alunos com 2 faltas seguidas (contatar) e 3+ (aptos a desligamento), com telefones e contatos feitos.</p>
      <label>Área${areaSel('area')}</label><button class="btn primary">Gerar PDF</button></form>
    <form class="card report" data-report="evento"><h3>Evento: participantes e documentação</h3><p class="muted small">Lista nominal com a situação de cada documento e as pendências.</p>
      <label>Evento<select name="evento" required>${evOpts || '<option value="">Nenhum evento</option>'}</select></label><button class="btn primary">Gerar PDF</button></form>
    <form class="card report" data-report="autorizacoes"><h3>Termos de autorização</h3><p class="muted small">Uma página por aluno para o responsável assinar.</p>
      <label>Evento<select name="evento" required>${evOpts || '<option value="">Nenhum evento</option>'}</select></label><label class="check"><input type="checkbox" name="pend"> só quem ainda não entregou</label><button class="btn primary">Gerar PDF</button></form>
    <form class="card report" data-report="turmas"><h3>Turmas e alunos</h3><p class="muted small">Relação nominal de alunos ativos por turma, com contatos e presença.</p>
      <label>Área${areaSel('area')}</label><button class="btn primary">Gerar PDF</button></form>
  </div>`;
  view.querySelectorAll('form.report').forEach(f => f.addEventListener('submit', ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const gen = {
      conferencia: () => PDF.conferencia(v.mes || thisMonth(), v.area),
      frequencia: () => { if (!v.turma) throw new Error('Selecione a turma'); return PDF.frequenciaTurma(v.turma, v.de, v.ate); },
      geral: () => PDF.assiduidadeGeral(v.area, v.de, v.ate),
      alertas: () => PDF.alertas(v.area),
      evento: () => { if (!v.evento) throw new Error('Cadastre um evento'); return PDF.eventoLista(v.evento); },
      autorizacoes: () => { if (!v.evento) throw new Error('Cadastre um evento'); return PDF.autorizacoes(v.evento, !!v.pend); },
      turmas: () => PDF.turmasAlunos(v.area),
    }[f.dataset.report];
    if (f.dataset.report === 'autorizacoes') run(gen, 'Gerando PDF…').catch(() => {}); // assinada pelo responsável do aluno
    else gerarPdf(gen);
  }));
};

/* ================= ASSINATURAS ================= */
routes.assinaturas = () => {
  setHeader('Assinaturas dos relatórios');
  view.innerHTML = `<p class="muted">A assinatura escolhida ao gerar um relatório sai sobre a linha de assinatura, com o nome e o cargo abaixo. Envie uma foto ou scan da assinatura (o fundo branco é removido automaticamente) ou desenhe com o mouse ou o dedo.</p>
    <div class="cards sig-cards">${assinaturas().map((a, i) => `
      <section class="card sig-card">
        <h3>${esc(a.nome)}</h3>
        <label class="field">Cargo / função (sai abaixo do nome)
          <input class="input" value="${esc(a.cargo || '')}" placeholder="Ex.: Coordenador(a) Pedagógico(a)" data-change="sigCargo" data-i="${i}"></label>
        <div class="sig-preview">${a.imagem ? `<img src="${a.imagem}" alt="Assinatura de ${esc(a.nome)}">` : '<span class="muted">Nenhuma assinatura cadastrada</span>'}</div>
        <div class="actions">
          <label class="btn ghost small">Enviar imagem<input type="file" accept="image/*" class="hidden" data-change="sigUpload" data-i="${i}"></label>
          <button class="btn ghost small" data-action="sigDesenhar" data-i="${i}">Desenhar</button>
          ${a.imagem ? `<button class="btn ghost small danger-text" data-action="sigRemover" data-i="${i}">Remover</button>` : ''}
        </div>
      </section>`).join('')}</div>`;
};

function salvarAssinatura(i, campos) {
  const a = assinaturas()[i];
  return save('Assinaturas', Object.assign({ id: a.id || uid(), nome: a.nome, cargo: a.cargo || '', imagem: a.imagem || '' }, campos, { atualizado_em: todayISO() }));
}
actions.sigCargo = el => salvarAssinatura(+el.dataset.i, { cargo: el.value.trim() });
actions.sigRemover = el => confirmBox('Remover esta assinatura?', 'Remover', () => salvarAssinatura(+el.dataset.i, { imagem: '' }));
actions.sigUpload = async el => {
  const file = el.files[0];
  if (!file) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const dataUrl = prepararAssinatura(img, true);
  if (!dataUrl) { toast('Não encontrei traços na imagem. Use fundo branco e caneta escura.', 'error'); return; }
  await salvarAssinatura(+el.dataset.i, { imagem: dataUrl });
  render();
};
actions.sigDesenhar = el => {
  const i = +el.dataset.i;
  openModal(`Desenhar assinatura — ${assinaturas()[i].nome}`, `<p class="muted small">Assine no quadro abaixo com o mouse ou o dedo.</p>
    <canvas id="sigPad" width="900" height="300" class="sig-pad"></canvas>
    <div class="form-actions"><button class="btn ghost" id="sigLimpar">Limpar</button><button class="btn ghost" data-action="closeModal">Cancelar</button><button class="btn primary" id="sigSalvar">Salvar assinatura</button></div>`, true);
  const c = $('#sigPad'), ctx = c.getContext('2d');
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10204a';
  let drawing = false;
  const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { drawing = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
  c.addEventListener('pointermove', e => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
  c.addEventListener('pointerup', () => { drawing = false; });
  $('#sigLimpar').onclick = () => ctx.clearRect(0, 0, c.width, c.height);
  $('#sigSalvar').onclick = async () => {
    const dataUrl = prepararAssinatura(c, false);
    if (!dataUrl) { toast('Desenhe a assinatura primeiro.', 'error'); return; }
    try { await salvarAssinatura(i, { imagem: dataUrl }); closeModal(); render(); } catch (e) { /* toast */ }
  };
};

/**
 * Recorta a assinatura, deixa o fundo transparente e reduz o tamanho
 * (a célula da planilha aceita no máximo 50 mil caracteres).
 */
function prepararAssinatura(src, removerFundo) {
  const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
  const scale0 = Math.min(1, 1400 / W);
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale0); c.height = Math.round(H * scale0);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const k = (y * c.width + x) * 4;
      if (removerFundo) {
        const lum = 0.299 * p[k] + 0.587 * p[k + 1] + 0.114 * p[k + 2];
        // fundo claro some; traço vira tinta azul-escura com opacidade proporcional
        const a = lum > 190 ? 0 : Math.min(255, Math.round((190 - lum) * 2.2));
        p[k] = 16; p[k + 1] = 32; p[k + 2] = 74; p[k + 3] = Math.min(p[k + 3], a);
      }
      if (p[k + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  ctx.putImageData(d, 0, 0);
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  for (let maxW = 700; maxW >= 200; maxW -= 100) {
    const s = Math.min(1, maxW / (x1 - x0 + 1));
    const o = document.createElement('canvas');
    o.width = Math.max(1, Math.round((x1 - x0 + 1) * s)); o.height = Math.max(1, Math.round((y1 - y0 + 1) * s));
    o.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, o.width, o.height);
    const url = o.toDataURL('image/png');
    if (url.length < 45000) return url;
  }
  return null;
}

/** Pergunta quem assina e gera o PDF. A última escolha fica lembrada neste navegador. */
function gerarPdf(gen) {
  const lista = assinaturas();
  let ultimo = '';
  try { ultimo = localStorage.getItem('ped_assinante') || ''; } catch (e) { /* sem storage */ }
  if (!lista.some(a => a.nome === ultimo) && ultimo !== '_nenhum') ultimo = lista[0].nome;
  openModal('Quem assina o relatório?', `<form id="sigPick" class="sig-pick">
    ${lista.map(a => `<label class="sig-opt"><input type="radio" name="s" value="${esc(a.nome)}" ${a.nome === ultimo ? 'checked' : ''}>
      <span><strong>${esc(a.nome)}</strong><small class="muted">${esc(a.cargo || 'Coordenação Pedagógica')}</small></span>
      ${a.imagem ? `<img src="${a.imagem}" alt="">` : '<small class="muted">sem imagem — sai só o nome</small>'}</label>`).join('')}
    <label class="sig-opt"><input type="radio" name="s" value="_nenhum" ${ultimo === '_nenhum' ? 'checked' : ''}><span><strong>Sem assinatura</strong><small class="muted">linha em branco para assinar à mão</small></span></label>
    <div class="form-actions"><a href="#assinaturas" class="btn ghost" data-action="closeModal">Gerenciar assinaturas</a><button class="btn primary">Gerar PDF</button></div></form>`);
  $('#sigPick').addEventListener('submit', async ev => {
    ev.preventDefault();
    const v = new FormData(ev.target).get('s');
    try { localStorage.setItem('ped_assinante', v); } catch (e) { /* sem storage */ }
    closeModal();
    try {
      await run(async () => { await PDF.setAssinante(lista.find(a => a.nome === v) || null); await gen(); }, 'Gerando PDF…');
    } catch (e) { /* toast já exibido */ }
  });
}

/* ---------- eventos globais ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action] && el.dataset.action !== 'closeModal') return;
  if (el.dataset.action === 'closeModal') { closeModal(); if (el.tagName !== 'A') ev.preventDefault(); return; }
  if (el.tagName === 'A' && el.getAttribute('href') === 'javascript:void 0') ev.preventDefault();
  Promise.resolve(actions[el.dataset.action](el, ev)).catch(() => {});
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) Promise.resolve(actions[el.dataset.change](el, ev)).catch(() => {});
});
$('#modalClose').onclick = closeModal;
$('#modal').addEventListener('mousedown', ev => { if (ev.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeModal(); });
$('#btnMenu').onclick = () => $('#sidebar').classList.toggle('open');
$('#btnReload').onclick = () => loadAll().catch(() => {});
$('#btnLogout').onclick = () => logout();
window.addEventListener('hashchange', render);

/* ---------- login ---------- */
function logout() {
  API.key = '';
  if (API.demo) return;
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
}
let criandoSenha = false;
function modoCriarSenha() {
  criandoSenha = true;
  $('#login').classList.remove('hidden'); $('#app').classList.add('hidden');
  document.querySelector('.login-card .muted').textContent = 'Primeiro acesso: crie a senha que a coordenação vai usar (mínimo 6 caracteres).';
  $('#loginKey').setAttribute('autocomplete', 'new-password');
  $('#loginKey2').parentElement.classList.remove('hidden');
  document.querySelector('#loginForm button').textContent = 'Criar senha e entrar';
}
$('#loginForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const k = $('#loginKey').value.trim();
  $('#loginErr').textContent = '';
  if (criandoSenha) {
    if (k.length < 6) { $('#loginErr').textContent = 'Use pelo menos 6 caracteres.'; return; }
    if (k !== $('#loginKey2').value.trim()) { $('#loginErr').textContent = 'As senhas não conferem.'; return; }
  }
  API.key = k;
  try {
    if (criandoSenha) { await run(() => API.definirSenha(), 'Criando senha…'); criandoSenha = false; }
    await start();
  } catch (e) {
    if (e.semSenha) { modoCriarSenha(); API.key = ''; return; }
    $('#loginErr').textContent = e.auth ? 'Senha incorreta.' : (e.message || 'Falha ao conectar.'); API.key = '';
  }
});

async function start() {
  const data = await run(() => API.getAll(), 'Carregando dados da planilha…');
  SHEETS.forEach(s => { DB[s] = (data && data[s]) || []; });
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#demoBanner').classList.toggle('hidden', !API.demo);
  $('#modeLabel').textContent = API.demo ? 'Modo demonstração' : 'Conectado à planilha';
  $('#btnLogout').classList.toggle('hidden', API.demo);
  render();
}

(function boot() {
  if (API.demo || API.key) start().catch(e => { if (e.semSenha) modoCriarSenha(); else $('#login').classList.remove('hidden'); });
  else {
    $('#login').classList.remove('hidden');
    // Detecta o primeiro acesso (senha ainda não criada) já ao abrir
    API.ping().catch(e => { if (e.semSenha) modoCriarSenha(); });
  }
})();
