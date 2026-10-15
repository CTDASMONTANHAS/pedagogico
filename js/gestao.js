/* Avaliação dos professores (indicadores objetivos) e dados da prestação de contas. */

/* ================= AVALIAÇÃO DOS PROFESSORES ================= */
const PESOS_AVAL = { conf: 35, freq: 30, ret: 20, reun: 15 };
const NIVEIS_AVAL = [[85, 'Excelente', 'ok'], [70, 'Bom', 'ok'], [50, 'Regular', 'warn'], [0, 'Atenção', 'bad']];
const nivelAval = n => n == null ? ['—', '—', ''] : NIVEIS_AVAL.find(([min]) => n >= min);

/** Indicadores de um professor no período P (de periodoRelatorio). */
function indicadoresProfessor(p, P) {
  const ts = p.turmas.filter(t => P.meses.some(m => iniciou(t, m)));
  const ids = ts.map(t => t.id);
  // 1. Conferência: Em dia = 1, Parcial = 0,5, Pendente = 0 (meses não conferidos ficam de fora)
  let pontos = 0, conferidos = 0, celulas = 0;
  const pendencias = [];
  ts.forEach(t => P.meses.filter(m => iniciou(t, m)).forEach(m => {
    const c = conferencia(t.id, m) || {};
    CONF_ITENS.forEach(([k, l]) => {
      celulas++;
      const v = c[k] || '';
      if (!v) return;
      conferidos++;
      if (v === 'EM_DIA') pontos += 1;
      else { if (v === 'PARCIAL') pontos += 0.5; pendencias.push({ turma: t, mes: m, item: l, status: v }); }
    });
  }));
  const conf = conferidos ? Math.round(100 * pontos / conferidos) : null;
  // 2. Frequência média das turmas
  let P_ = 0, tot = 0;
  DB.Frequencia.forEach(r => { if (ids.includes(r.turma_id) && r.data >= P.de && r.data <= P.ate) { tot++; if (r.status === 'P') P_++; } });
  const freq = pct(P_, tot);
  const aulas = ids.reduce((s, id) => s + datasDaTurma(id, P.de, P.ate).length, 0);
  // 3. Evasão: desligados no período / (ativos + desligados no período)
  const deslig = DB.Alunos.filter(a => ids.includes(a.turma_id) && a.ativo === 'NAO' && (a.data_desligamento || '') >= P.de && (a.data_desligamento || '') <= P.ate);
  const ativos = DB.Alunos.filter(a => ids.includes(a.turma_id) && a.ativo !== 'NAO');
  const base = ativos.length + deslig.length;
  const evasao = base ? Math.round(100 * deslig.length / base) : null;
  // 4. Reuniões realizadas nos meses em que o professor tinha turma
  const mesesProf = P.meses.filter(m => m <= thisMonth() && (!ts.length || ts.some(t => iniciou(t, m))));
  const reunFeitas = mesesProf.filter(m => reunioesDo(p.nome, m).some(r => r.status === 'REALIZADA')).length;
  const reun = mesesProf.length ? Math.round(100 * reunFeitas / mesesProf.length) : null;
  // nota final: média ponderada dos indicadores disponíveis
  const comp = { conf, freq, ret: evasao == null ? null : 100 - evasao, reun };
  let soma = 0, peso = 0;
  Object.entries(PESOS_AVAL).forEach(([k, w]) => { if (comp[k] != null) { soma += comp[k] * w; peso += w; } });
  const nota = peso ? Math.round(soma / peso) : null;
  const alertas = alertasFaltas().filter(x => ids.includes(x.turma.id));
  const ocorr = DB.Ocorrencias.filter(o => ids.includes(o.turma_id) && (o.data_ocorrencia || '') >= P.de && (o.data_ocorrencia || '') <= P.ate);
  return { p, turmas: ts, conf, conferidos, celulas, pendencias, freq, aulas, evasao, deslig, ativos: ativos.length, reun, reunFeitas, mesesProf, nota, nivel: nivelAval(nota), alertas, ocorr };
}

function avaliacaoProfessores(tipo, ref) {
  const P = PDF.periodoRelatorio(tipo, ref);
  const lista = professores().filter(p => p.funcao === 'Professor(a)' && p.turmas.length)
    .map(p => indicadoresProfessor(p, P)).sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1) || a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  return { P, lista };
}

const badgePct = (v, inverso) => {
  if (v == null) return '<span class="muted">—</span>';
  const bom = inverso ? v <= 10 : v >= 85, medio = inverso ? v <= 25 : v >= 70;
  return `<span class="pct ${bom ? 'good' : medio ? 'mid' : 'low'}">${v}%</span>`;
};

ui.avalTipo = ui.avalTipo || 'mensal';
ui.avalRef = ui.avalRef || thisMonth();
routes.avaliacao = () => {
  setHeader('Avaliação dos professores', `<select class="input" data-change="setAvalTipo">${['mensal', 'trimestral', 'semestral', 'anual'].map(t => `<option value="${t}" ${t === ui.avalTipo ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
    <input type="month" class="input" value="${ui.avalRef}" data-change="setAvalRef">
    <button class="btn primary" data-action="pdfAvaliacao">PDF geral</button>`);
  const { P, lista } = avaliacaoProfessores(ui.avalTipo, ui.avalRef);
  const comNota = lista.filter(x => x.nota != null);
  const media = comNota.length ? Math.round(comNota.reduce((s, x) => s + x.nota, 0) / comNota.length) : null;
  view.innerHTML = `
    <div class="kpis">
      ${kpi('Período', P.nome)}
      ${kpi('Professores avaliados', lista.length)}
      ${kpi('Nota média da equipe', media == null ? '—' : media, nivelAval(media)[1])}
      ${kpi('Em atenção (abaixo de 50)', comNota.filter(x => x.nota < 50).length, '', comNota.some(x => x.nota < 50) ? 'k-red' : '')}
    </div>
    <section class="card">
      <div class="card-head"><h3>Indicadores por professor</h3>
        <small class="muted">Nota = conferência ${PESOS_AVAL.conf}% + frequência das turmas ${PESOS_AVAL.freq}% + permanência dos alunos (100% − evasão) ${PESOS_AVAL.ret}% + reuniões ${PESOS_AVAL.reun}%</small></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Professor(a)</th><th>Turmas</th><th title="Itens da conferência em dia (parcial vale meio)">Conferência</th><th>Frequência</th><th>Evasão</th><th>Reuniões</th><th>Nota</th><th></th></tr></thead>
        <tbody>${lista.map(x => `<tr>
          <td><strong>${esc(x.p.nome)}</strong>${x.alertas.length ? ` <span class="flag amber" title="Alunos em alerta de faltas">${x.alertas.length} alerta(s)</span>` : ''}</td>
          <td><small class="muted">${x.turmas.map(t => esc(shortName(t.nome))).join(' · ')}</small></td>
          <td>${badgePct(x.conf)} <small class="muted">${x.conferidos}/${x.celulas}</small></td>
          <td>${badgePct(x.freq)} <small class="muted">${x.aulas} aulas</small></td>
          <td>${badgePct(x.evasao, true)} <small class="muted">${x.deslig.length} saíram</small></td>
          <td>${badgePct(x.reun)} <small class="muted">${x.reunFeitas}/${x.mesesProf.length}</small></td>
          <td><span class="tag ${x.nivel[2]}"><strong>${x.nota ?? '—'}</strong> ${x.nivel[1]}</span></td>
          <td class="row-actions"><button class="btn ghost small" data-action="pdfAvaliacaoProf" data-nome="${esc(x.p.nome)}">Ficha PDF</button>
            <button class="btn ghost small" data-action="novaReuniao" data-prof="${esc(x.p.nome)}">Reunião</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">Conferência: só entram os meses já conferidos (o número mostra conferidos/total). Evasão: alunos desligados no período sobre ativos + desligados. Reuniões: meses com reunião realizada sobre meses do período.</p>
    </section>`;
};
actions.setAvalTipo = el => { ui.avalTipo = el.value; render(); };
actions.setAvalRef = el => { ui.avalRef = el.value || thisMonth(); render(); };
actions.pdfAvaliacao = () => gerarPdf(() => PDF.avaliacao(ui.avalTipo, ui.avalRef));
actions.pdfAvaliacaoProf = el => gerarPdf(() => PDF.avaliacao(ui.avalTipo, ui.avalRef, el.dataset.nome));

/** Quadro resumido dos indicadores mostrado na ata da reunião com o professor. */
function painelIndicadoresAta(nome, mes) {
  const p = professores().find(x => x.nome === nome && x.funcao === 'Professor(a)');
  if (!p || !p.turmas.length) return '';
  const x = indicadoresProfessor(p, PDF.periodoRelatorio('mensal', mes));
  const pend = x.pendencias.map(d => `${shortName(d.turma.nome)}: ${d.item} (${CONF_STATUS[d.status].label.toLowerCase()})`);
  return `<div class="ata-ind"><strong>Indicadores de ${fmtMonth(mes)}</strong> — conferência ${x.conf ?? '—'}% · frequência ${x.freq ?? '—'}% · evasão ${x.evasao ?? '—'}% · nota <strong>${x.nota ?? '—'}</strong> (${x.nivel[1]})
    ${pend.length ? `<br><small>Pendências: ${esc(pend.join('; '))}</small>` : ''}${x.alertas.length ? `<br><small>Alunos em alerta: ${esc(x.alertas.map(a => a.aluno.nome).join(', '))}</small>` : ''}
    <br><button type="button" class="btn ghost small" data-action="ataUsarIndicadores">Inserir nos assuntos tratados</button></div>`;
}
actions.ataUsarIndicadores = () => {
  const f = $('#ataForm'); const v = Object.fromEntries(new FormData(f));
  const p = professores().find(x => x.nome === v.professor);
  if (!p) return;
  const x = indicadoresProfessor(p, PDF.periodoRelatorio('mensal', (v.data || todayISO()).slice(0, 7)));
  const linhas = [
    `Conferência pedagógica: ${x.conf ?? '—'}% dos itens em dia${x.pendencias.length ? '; pendências: ' + x.pendencias.map(d => `${shortName(d.turma.nome)} — ${d.item}`).join('; ') : ''}.`,
    `Frequência média das turmas: ${x.freq ?? '—'}% em ${x.aulas} aula(s) registrada(s).`,
    `Evasão: ${x.deslig.length} aluno(s) desligado(s) no mês${x.evasao != null ? ` (${x.evasao}%)` : ''}.`,
    x.alertas.length ? `Alunos com faltas consecutivas: ${x.alertas.map(a => `${a.aluno.nome} (${a.stats.seqAtual} faltas)`).join(', ')}.` : 'Nenhum aluno em alerta de faltas consecutivas.',
    `Nota do mês: ${x.nota ?? '—'} (${x.nivel[1]}).`,
  ];
  $('#ataItens').insertAdjacentHTML('afterbegin', linhaItem({ titulo: 'Indicadores pedagógicos do mês', texto: linhas.join('\n') }));
  toast('Indicadores inseridos nos assuntos tratados');
};

/* ================= PRESTAÇÃO DE CONTAS ================= */
const FAIXAS_IDADE = [[0, 6, 'até 6 anos'], [7, 10, '7 a 10'], [11, 14, '11 a 14'], [15, 17, '15 a 17'], [18, 29, '18 a 29'], [30, 59, '30 a 59'], [60, 200, '60 ou mais']];
function idadeEm(nasc, ref) {
  if (!nasc || !/^\d{4}-\d{2}-\d{2}/.test(nasc)) return null;
  let i = +ref.slice(0, 4) - +nasc.slice(0, 4);
  if (ref.slice(5, 10) < nasc.slice(5, 10)) i--;
  return i >= 0 && i < 120 ? i : null;
}
const contar = (lista, fn) => { const o = {}; lista.forEach(x => { const k = fn(x) || 'Não informado'; o[k] = (o[k] || 0) + 1; }); return o; };

/** Metas previstas e realizadas de um conjunto de turmas no período. */
function dadosPrestacao({ turmas: ids, de, ate, area }) {
  const ts = ids.map(turma).filter(Boolean);
  const meses = [];
  for (let m = de.slice(0, 7); m <= ate.slice(0, 7) && m <= thisMonth(); m = addMonths(m, 1)) meses.push(m);
  const porTurma = ts.map(t => {
    const mesesT = meses.filter(m => iniciou(t, m));
    const datas = datasDaTurma(t.id, de, ate);
    const regs = DB.Frequencia.filter(r => r.turma_id === t.id && r.data >= de && r.data <= ate);
    const atendidos = [...new Set(regs.filter(r => r.status === 'P').map(r => r.aluno_id))];
    const dur = parseFloat(String(t.duracao_aula || '').replace(',', '.')) || 0;
    const prevMes = parseInt(t.aulas_previstas_mes, 10) || 0;
    return {
      t, mesesT, aulas: datas.length, aulasPrev: prevMes ? prevMes * mesesT.length : null, dur,
      ch: dur ? datas.length * dur : null, chPrev: dur && prevMes ? prevMes * mesesT.length * dur : null,
      vagas: parseInt(t.meta_alunos, 10) || null, atendidos, freq: pct(regs.filter(r => r.status === 'P').length, regs.length),
    };
  });
  const benef = [...new Set(porTurma.flatMap(x => x.atendidos))].map(aluno).filter(Boolean);
  const soma = (k, nulo) => { const v = porTurma.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : nulo; };
  const eventos = DB.Eventos.filter(e => e.status !== 'CANCELADO' && e.data_evento >= de && e.data_evento <= ate && (!area || e.area === area));
  const regsTodos = DB.Frequencia.filter(r => ids.includes(r.turma_id) && r.data >= de && r.data <= ate);
  const mensal = meses.map(m => {
    const rs = regsTodos.filter(r => r.data.slice(0, 7) === m);
    return { m, aulas: ids.reduce((s, id) => s + datasDaTurma(id, m + '-01', m + '-31').length, 0), benef: new Set(rs.filter(r => r.status === 'P').map(r => r.aluno_id)).size, freq: pct(rs.filter(r => r.status === 'P').length, rs.length) };
  });
  const ref = ate < todayISO() ? ate : todayISO();
  const perfil = {
    idade: contar(benef, a => { const i = idadeEm(a.data_nascimento, ref); return i == null ? '' : (FAIXAS_IDADE.find(([x, y]) => i >= x && i <= y) || [])[2]; }),
    sexo: contar(benef, a => a.sexo),
    escola: contar(benef, a => a.tipo_escola),
    bairro: contar(benef, a => (a.bairro || '').trim()),
    area: contar(benef, a => AREAS[(turma(a.turma_id) || {}).area]),
  };
  return {
    ts, meses, porTurma, benef, eventos, mensal, perfil,
    total: {
      vagas: soma('vagas', null), benef: benef.length, aulas: soma('aulas', 0), aulasPrev: soma('aulasPrev', null),
      ch: soma('ch', null), chPrev: soma('chPrev', null), freq: pct(regsTodos.filter(r => r.status === 'P').length, regsTodos.length),
      desligados: DB.Alunos.filter(a => ids.includes(a.turma_id) && a.ativo === 'NAO' && (a.data_desligamento || '') >= de && (a.data_desligamento || '') <= ate).length,
    },
  };
}
