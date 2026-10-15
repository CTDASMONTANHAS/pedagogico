/* Painel da diretoria: avaliação dos professores, somente leitura, com senha própria. */
(() => {
  const $ = s => document.querySelector(s);
  const CHAVE = 'ped_dir_key';
  const lerChave = () => { try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; } };
  const gravarChave = v => { try { v ? localStorage.setItem(CHAVE, v) : localStorage.removeItem(CHAVE); } catch (e) { /* sem storage */ } };
  const graficos = [];

  async function buscar(senha) {
    if (API.demo) return Demo.handle({ action: 'diretoria' });
    const res = await fetch(window.APP_CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'diretoria', key: senha }) });
    const json = await res.json();
    if (!json.ok) { const e = new Error(json.error || 'Erro ao carregar'); e.auth = json.auth === false; throw e; }
    return json.data;
  }

  function carregando(on, txt) { $('#loading').classList.toggle('hidden', !on); $('#loadingText').textContent = txt || 'Carregando…'; }

  async function entrar(senha) {
    carregando(true, 'Carregando dados…');
    try {
      const data = await buscar(senha);
      SHEETS.forEach(s => { DB[s] = (data && data[s]) || []; });
      gravarChave(senha);
      $('#dirLogin').classList.add('hidden');
      $('#dirApp').classList.remove('hidden');
      $('#dirSair').classList.remove('hidden');
      desenhar();
    } catch (e) {
      gravarChave('');
      $('#dirLogin').classList.remove('hidden');
      $('#dirApp').classList.add('hidden');
      $('#dirErro').textContent = e.auth ? 'Senha incorreta.' : e.message;
    } finally { carregando(false); }
  }

  const corNota = n => n == null ? 'var(--muted)' : n >= 70 ? 'var(--ok)' : n >= 50 ? 'var(--warn)' : 'var(--bad)';
  const barra = (rot, v, inverso, extra) => {
    const val = v == null ? null : inverso ? 100 - v : v;
    const cor = val == null ? 'var(--border)' : val >= 85 ? 'var(--ok)' : val >= 70 ? '#6aa84f' : val >= 50 ? 'var(--warn)' : 'var(--bad)';
    return `<div class="dir-bar"><span>${rot}</span><div class="dir-track"><i style="width:${val ?? 0}%;background:${cor}"></i></div>
      <b>${v == null ? '—' : v + '%'}</b><small>${extra || ''}</small></div>`;
  };

  function desenhar() {
    graficos.splice(0).forEach(c => c.destroy());
    const tipo = $('#dirTipo').value, ref = $('#dirRef').value || thisMonth();
    const { P, lista } = avaliacaoProfessores(tipo, ref);
    $('#dirPeriodo').textContent = P.nome;
    const com = lista.filter(x => x.nota != null);
    const media = com.length ? Math.round(com.reduce((s, x) => s + x.nota, 0) / com.length) : null;
    const media3 = (k) => { const v = lista.map(x => x[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    // evolução da nota média nos últimos 6 meses
    const meses = Array.from({ length: 6 }, (_, i) => addMonths(ref, i - 5));
    const evol = meses.map(m => { const l = avaliacaoProfessores('mensal', m).lista.filter(x => x.nota != null); return l.length ? Math.round(l.reduce((s, x) => s + x.nota, 0) / l.length) : null; });
    const k = (rot, val, sub, cor) => `<div class="kpi" ${cor ? `style="border-top-color:${cor}"` : ''}><span>${rot}</span><strong ${cor ? `style="color:${cor}"` : ''}>${val}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#dirView').innerHTML = `
      <div class="kpis">
        ${k('Nota média da equipe', media ?? '—', nivelAval(media)[1], corNota(media))}
        ${k('Professores avaliados', lista.length)}
        ${k('Conferência em dia (média)', media3('conf') == null ? '—' : media3('conf') + '%')}
        ${k('Frequência média das turmas', media3('freq') == null ? '—' : media3('freq') + '%')}
        ${k('Bom ou Excelente', com.filter(x => x.nota >= 70).length, 'nota 70 ou mais', 'var(--ok)')}
        ${k('Em atenção', com.filter(x => x.nota < 50).length, 'nota abaixo de 50', com.some(x => x.nota < 50) ? 'var(--bad)' : '')}
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
    const txt = css.getPropertyValue('--text').trim() || '#333', grid = css.getPropertyValue('--border').trim() || '#ddd';
    Chart.defaults.color = txt;
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

  async function pdf(nome) {
    carregando(true, 'Gerando PDF…');
    try { await PDF.setAssinante(null); await PDF.avaliacao($('#dirTipo').value, $('#dirRef').value || thisMonth(), nome); } catch (e) { alert(e.message); } finally { carregando(false); }
  }

  $('#dirRef').value = addMonths(thisMonth(), -1); // mês anterior: já fechado
  $('#dirTipo').addEventListener('change', desenhar);
  $('#dirRef').addEventListener('change', desenhar);
  $('#dirPdf').addEventListener('click', () => pdf());
  $('#dirView').addEventListener('click', e => { const b = e.target.closest('[data-ficha]'); if (b) pdf(b.dataset.ficha); });
  $('#dirForm').addEventListener('submit', e => { e.preventDefault(); $('#dirErro').textContent = ''; entrar($('#dirSenha').value); });
  $('#dirSair').addEventListener('click', () => { gravarChave(''); location.reload(); });
  const salva = lerChave();
  if (salva || API.demo) entrar(salva); else $('#dirLogin').classList.remove('hidden');
})();
